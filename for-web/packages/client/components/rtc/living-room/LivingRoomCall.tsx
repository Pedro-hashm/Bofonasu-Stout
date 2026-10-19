import {
  getTrackReferenceId,
  isTrackReference,
} from "@livekit/components-core";
import { useClient } from "@revolt/client";
import { useSmartParams } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import { Track } from "livekit-client";
import { createMemo } from "solid-js";
import type { RoomGuest, RoomStream } from "./RoomScene";
import { RoomWorkspace } from "./RoomStudio";
import { useRoomChat } from "./useRoomChat";

export function LivingRoomCall() {
  const voice = useVoice();
  const client = useClient();
  const state = useState();
  const params = useSmartParams();
  const chat = useRoomChat(
    () =>
      state.livingRoom.scene.chat.source === "current"
        ? (client().channels.get(params().channelId ?? "") ?? voice.channel())
        : voice.channel(),
    () => state.livingRoom.scene.chat.visible,
  );
  const displayName = (id: string) =>
    client().users.get(id)?.displayName ?? "Participante";
  const guests = createMemo<RoomGuest[]>(() => {
    const unique = new Map<string, RoomGuest>();
    for (const ref of voice.vidTracks()) {
      const p = ref.participant;
      unique.set(p.identity, {
        id: p.identity,
        name: displayName(p.identity),
        self: p.isLocal,
        participant: p,
      });
    }
    return [...unique.values()];
  });
  const streams = createMemo<RoomStream[]>(() =>
    voice
      .vidTracks()
      .filter(isTrackReference)
      .filter(
        (ref) =>
          ref.source === Track.Source.ScreenShare ||
          (ref.source === Track.Source.Camera && !ref.publication.isMuted),
      )
      .filter((ref) => ref.participant.isLocal || !ref.publication.isMuted)
      .map((ref) => ({
        id: getTrackReferenceId(ref),
        owner: ref.participant.identity,
        label: `${displayName(ref.participant.identity)} · ${ref.source === Track.Source.Camera ? "Câmera" : "Tela"}`,
        reference: ref,
        camera: ref.source === Track.Source.Camera,
      })),
  );
  return (
    <RoomWorkspace
      guests={guests()}
      streams={streams()}
      channel={voice.channel()?.id ?? "call"}
      chat={chat()}
    />
  );
}
