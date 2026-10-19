import type { LivingRoom } from "@revolt/state/stores/LivingRoom";
import { RemoteAudioTrack, Room } from "livekit-client";
import { type Accessor, createEffect, onCleanup } from "solid-js";
import { clamp } from "./model";

const contexts = new WeakMap<Room, AudioContext>();
export function createCallAudioContext(): AudioContext | undefined {
  try {
    return new AudioContext({ latencyHint: "interactive" });
  } catch {
    return undefined;
  }
}
export function registerCallAudioContext(
  room: Room,
  context: AudioContext | undefined,
) {
  if (context) contexts.set(room, context);
}
export function releaseCallAudioContext(room: Room) {
  const context = contexts.get(room);
  contexts.delete(room);
  if (context && context.state !== "closed")
    void context.close().catch(() => {});
}

/**
 * Isolates LiveKit's experimental plugin API. Uses the same resumable playback
 * context as the SDK; never captures, re-publishes, or plays another audio copy.
 */
export function useSpatialMicrophone(
  track: Accessor<RemoteAudioTrack | undefined>,
  room: Accessor<Room | undefined>,
  settings: LivingRoom,
  identity: Accessor<string>,
  channel: Accessor<string>,
  microphone: Accessor<boolean>,
) {
  createEffect(() => {
    const current = track(),
      currentRoom = room();
    const context = currentRoom && contexts.get(currentRoom);
    if (!current || !context || context.state === "closed" || !microphone())
      return;
    const panner = context.createPanner(),
      gain = context.createGain();
    panner.panningModel = "equalpower";
    panner.distanceModel = "inverse";
    panner.rolloffFactor = 0; // Distance is deliberately limited by our gain below.
    panner.coneInnerAngle = 360;
    panner.coneOuterAngle = 360;
    panner.positionZ.value = -2;
    let installed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function rewire(nodes: AudioNode[]) {
      // SDK reconstruction must also restore an explicit zero volume.
      const volume = current!.getVolume();
      panner.disconnect();
      gain.disconnect();
      current!.setWebAudioPlugins(nodes);
      current!.setVolume(volume);
    }
    createEffect(() => {
      const enabled = settings.enabled && settings.scene.spatial.enabled;
      clearTimeout(timer);
      const now = context.currentTime;
      if (!enabled) {
        if (!installed) return;
        panner.positionX.setTargetAtTime(0, now, 0.035);
        panner.positionZ.setTargetAtTime(-2, now, 0.035);
        gain.gain.setTargetAtTime(1, now, 0.035);
        timer = setTimeout(() => {
          rewire([]);
          installed = false;
        }, 180);
        return;
      }
      const scene = settings.scene,
        audio = scene.spatial;
      const position = settings.point(channel(), identity());
      const listener = settings.listenerPoint(channel());
      const dx = position.x - listener.x;
      const dy = (position.y - listener.y) / scene.aspect;
      const separation = Math.hypot(dx, dy);
      const angle = separation < 0.001 ? 0 : Math.atan2(dx, -dy) * audio.width;
      panner.panningModel = audio.method === "hrtf" ? "HRTF" : "equalpower";
      panner.positionX.setTargetAtTime(Math.sin(angle) * 2, now, 0.035);
      panner.positionZ.setTargetAtTime(-Math.cos(angle) * 2, now, 0.035);
      // At maximum distance setting, voices retain at least 50% amplitude.
      gain.gain.setTargetAtTime(
        1 - audio.distance * clamp(separation / 0.85),
        now,
        0.035,
      );
      if (!installed) {
        try {
          rewire([panner, gain]);
          installed = true;
        } catch (error) {
          console.warn(
            "Spatial audio unavailable; keeping normal voice playback.",
            error,
          );
          rewire([]);
        }
      }
    });
    onCleanup(() => {
      clearTimeout(timer);
      if (installed) rewire([]);
      panner.disconnect();
      gain.disconnect();
    });
  });
}
