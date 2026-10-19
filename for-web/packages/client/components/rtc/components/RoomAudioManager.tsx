import {
  type TrackReference,
  getTrackReferenceId,
  isLocal,
  trackReferencesObservable,
} from "@livekit/components-core";
import { useState } from "@revolt/state";
import { Key } from "@solid-primitives/keyed";
import {
  RemoteAudioTrack,
  RemoteTrackPublication,
  RoomEvent,
  Track,
} from "livekit-client";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import { useSpatialMicrophone } from "../living-room/spatialAudio";
import { useVoice } from "../state";

/** Own playback independently of participant tiles, portals and visual analysers. */
export function RoomAudioManager() {
  const voice = useVoice();
  const state = useState();
  const [blocked, setBlocked] = createSignal(false);
  const [tracks, setTracks] = createSignal<TrackReference[]>([]);
  createEffect(() => {
    const room = voice.room();
    if (!room) return;
    const subscription = trackReferencesObservable(
      room,
      [
        Track.Source.Microphone,
        Track.Source.ScreenShareAudio,
        Track.Source.Unknown,
      ],
      { onlySubscribed: false },
    ).subscribe(({ trackReferences }) => setTracks(trackReferences));
    onCleanup(() => subscription.unsubscribe());
  });
  const remoteTracks = createMemo(() =>
    tracks().filter(
      (ref) =>
        !isLocal(ref.participant) && ref.publication.kind === Track.Kind.Audio,
    ),
  );

  createEffect(() => {
    for (const ref of remoteTracks()) {
      const publication = ref.publication as RemoteTrackPublication;
      if (!publication.isDesired) publication.setSubscribed(true);
    }
    if (state.livingRoom.enabled)
      state.livingRoom.assign(voice.channel()?.id ?? "call", [
        ...new Set(remoteTracks().map((ref) => ref.participant.identity)),
      ]);
  });

  let resuming = false;
  async function resumeAudio() {
    const room = voice.room();
    if (!room || resuming) return;
    resuming = true;
    try {
      await room.startAudio();
      setBlocked(!room.canPlaybackAudio);
    } catch {
      setBlocked(true);
    } finally {
      resuming = false;
    }
  }

  onMount(() => {
    const room = voice.room();
    if (!room) return;
    const playbackChanged = () => setBlocked(!room.canPlaybackAudio);
    const interaction = () => {
      if (!room.canPlaybackAudio) void resumeAudio();
    };
    room.on(RoomEvent.AudioPlaybackStatusChanged, playbackChanged);
    document.addEventListener("pointerdown", interaction, true);
    document.addEventListener("keydown", interaction, true);
    void resumeAudio();
    onCleanup(() => {
      room.off(RoomEvent.AudioPlaybackStatusChanged, playbackChanged);
      document.removeEventListener("pointerdown", interaction, true);
      document.removeEventListener("keydown", interaction, true);
    });
  });

  createEffect(() => {
    const room = voice.room();
    const device = state.voice.preferredAudioOutputDevice;
    if (!room || !device) return;
    void room.switchActiveDevice("audiooutput", device).catch(async (error) => {
      console.warn(
        "Could not select the saved voice output; using the default output.",
        error,
      );
      await room.switchActiveDevice("audiooutput", "default").catch(() => {});
    });
  });

  return (
    <>
      <div style={{ display: "none" }} data-call-audio>
        <Key each={remoteTracks()} by={getTrackReferenceId}>
          {(ref) => (
            <RemoteCallAudio
              reference={ref()}
              volume={
                state.voice.outputVolume *
                (ref().source === Track.Source.ScreenShareAudio
                  ? state.voice.getScreenShareVolume(ref().participant.identity)
                  : state.voice.getUserVolume(ref().participant.identity))
              }
              muted={
                voice.deafen() ||
                (ref().source === Track.Source.ScreenShareAudio &&
                  state.livingRoom.enabled &&
                  state.livingRoom.watching?.channel === voice.channel()?.id &&
                  !state.livingRoom.watching?.owners.includes(
                    ref().participant.identity,
                  )) ||
                (ref().source === Track.Source.ScreenShareAudio
                  ? state.voice.getScreenShareMuted(ref().participant.identity)
                  : state.voice.getUserMuted(ref().participant.identity))
              }
            />
          )}
        </Key>
      </div>
      <Show when={blocked() && !voice.deafen() && state.voice.outputVolume > 0}>
        <Portal mount={document.getElementById("floating") ?? document.body}>
          <button
            type="button"
            onClick={() => void resumeAudio()}
            style={{
              position: "fixed",
              right: "20px",
              bottom: "76px",
              "z-index": 45,
              padding: "12px 16px",
              "border-radius": "var(--borderRadius-md)",
              border: "1px solid var(--md-sys-color-outline)",
              background: "var(--md-sys-color-primary)",
              color: "var(--md-sys-color-on-primary)",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            Ativar áudio da chamada
          </button>
        </Portal>
      </Show>
    </>
  );
}

function RemoteCallAudio(props: {
  reference: TrackReference;
  volume: number;
  muted: boolean;
}) {
  const voice = useVoice();
  const state = useState();
  const publication = () =>
    props.reference.publication as RemoteTrackPublication;
  const [track, setTrack] = createSignal<RemoteAudioTrack>();
  let element!: HTMLAudioElement;
  useSpatialMicrophone(
    track,
    voice.room,
    state.livingRoom,
    () => props.reference.participant.identity,
    () => voice.channel()?.id ?? "call",
    () => props.reference.source === Track.Source.Microphone,
  );

  createEffect(() => {
    const pub = publication();
    const update = () =>
      setTrack(
        pub.audioTrack instanceof RemoteAudioTrack ? pub.audioTrack : undefined,
      );
    // The SDK emits unsubscribed before clearing publication.audioTrack.
    const clear = () => setTrack(undefined);
    pub.on("subscribed", update);
    pub.on("unsubscribed", clear);
    update();
    onCleanup(() => {
      pub.off("subscribed", update);
      pub.off("unsubscribed", clear);
    });
  });
  createEffect(() => {
    const current = track();
    if (!current || props.muted) return;
    current.attach(element);
    onCleanup(() => {
      current.detach(element);
    });
  });
  createEffect(() => {
    const current = track();
    publication().setEnabled(!props.muted);
    if (!current) return;
    const volume = Number.isFinite(props.volume)
      ? Math.max(0, Math.min(9, props.volume))
      : 1;
    // RemoteAudioTrack uses the room's shared Web Audio gain, including >100%.
    // Do not write muted/volume onto the HTML element or create another mixer.
    current.setVolume(props.muted ? 0 : volume);
  });
  return (
    <audio
      ref={element}
      autoplay
      data-participant={props.reference.participant.identity}
    />
  );
}
