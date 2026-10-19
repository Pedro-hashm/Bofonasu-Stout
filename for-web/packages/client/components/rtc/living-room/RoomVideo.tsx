import type { TrackReference } from "@livekit/components-core";
import {
  type Track,
  type TrackPublication,
  RemoteTrackPublication,
  TrackEvent,
} from "livekit-client";
import {
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

type VideoLease = { count: number; release?: ReturnType<typeof setTimeout> };
const viewers = new WeakMap<RemoteTrackPublication, VideoLease>();

/** Renderer handoffs must not briefly unsubscribe an otherwise visible publication. */
function acquireVideo(publication: RemoteTrackPublication) {
  const lease = viewers.get(publication) ?? { count: 0 };
  clearTimeout(lease.release);
  lease.count++;
  viewers.set(publication, lease);
  queueMicrotask(() => {
    if (!lease.count) return;
    if (!publication.isDesired) publication.setSubscribed(true);
    if (!publication.isEnabled) publication.setEnabled(true);
  });
  return () => {
    if (--lease.count) return;
    lease.release = setTimeout(() => {
      if (lease.count) return;
      viewers.delete(publication);
      // The normal call view may have taken over the same track. It manages
      // its own subscription, so never cancel it while an element is attached.
      if (
        !publication.track?.attachedElements.some(
          (element) => element.isConnected,
        ) &&
        publication.isDesired
      )
        publication.setSubscribed(false);
    }, 200);
  };
}
/** Video only. Audio stays owned by RoomAudioManager, including screen-share audio. */
export function RoomVideo(props: {
  reference: TrackReference;
  fit: "contain" | "cover";
  onDimensions?: (width: number, height: number) => void;
}) {
  let video!: HTMLVideoElement;
  const [track, setTrack] = createSignal<Track>();
  // Track-reference wrappers change on SDK events; the publication itself is
  // stable. Subscription ownership follows its identity, not wrapper objects.
  const publication = createMemo(() => props.reference.publication);
  createEffect(() => {
    const current: TrackPublication = publication();
    const update = () => setTrack(current.track);
    const clear = () => setTrack(undefined);
    current.on(TrackEvent.Subscribed, update);
    current.on(TrackEvent.Unsubscribed, clear);
    update();
    const release =
      current instanceof RemoteTrackPublication
        ? acquireVideo(current)
        : undefined;
    onCleanup(() => {
      current.off(TrackEvent.Subscribed, update);
      current.off(TrackEvent.Unsubscribed, clear);
      release?.();
    });
  });
  const [blocked, setBlocked] = createSignal(false);
  function resume() {
    if (!video?.srcObject) return;
    video.muted = true;
    void video
      .play()
      .then(() => setBlocked(false))
      .catch((error: unknown) => {
        // A pending play is normally interrupted when the SDK replaces a track.
        if (error instanceof DOMException && error.name === "NotAllowedError")
          setBlocked(true);
      });
  }
  createEffect(() => {
    const current = track();
    if (!current) return;
    current.attach(video);
    // A video element must never play a duplicate of the shared audio mixer.
    video.muted = true;
    resume();
    onCleanup(() => current.detach(video));
  });
  onMount(() => {
    const resumeVisible = () => {
      if (document.visibilityState === "visible") resume();
    };
    document.addEventListener("visibilitychange", resumeVisible);
    onCleanup(() =>
      document.removeEventListener("visibilitychange", resumeVisible),
    );
  });
  return (
    <video
      ref={video}
      autoplay
      playsinline
      muted
      onCanPlay={resume}
      onLoadedMetadata={() => {
        resume();
        props.onDimensions?.(video.videoWidth, video.videoHeight);
      }}
      on:resize={() =>
        props.onDimensions?.(video.videoWidth, video.videoHeight)
      }
      onClick={() => {
        if (blocked()) resume();
      }}
      title={blocked() ? "Clique para reproduzir a transmissão" : undefined}
      style={{
        "object-fit": props.fit,
        "grid-area": "1/1",
        width: "100%",
        height: "100%",
        "min-width": 0,
        "min-height": 0,
      }}
    />
  );
}
