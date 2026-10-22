import { AbstractStore } from ".";
import { State } from "..";

export const SOUND_NAMES = [
  "deafen",
  "message",
  "mute",
  "ringtoneIncoming",
  "ringtoneOutgoing",
  "streamEnd",
  "streamStart",
  "streamViewerJoin",
  "streamViewerLeave",
  "undeafen",
  "unmute",
  "userJoinVoice",
  "userLeaveVoice",
  "userMoved",
  "cameraOn",
  "cameraOff",
] as const;
export type SoundName = (typeof SOUND_NAMES)[number];
export type TypeSounds = Record<SoundName, boolean> & { volume: number };

export class Sounds extends AbstractStore<"sounds", TypeSounds> {
  constructor(state: State) {
    super(state, "sounds");
  }
  hydrate(): void {}
  default(): TypeSounds {
    return {
      ...Object.fromEntries(SOUND_NAMES.map((name) => [name, true])),
      volume: 0.7,
    } as TypeSounds;
  }
  clean(input: Partial<TypeSounds>): TypeSounds {
    input = input && typeof input === "object" ? input : {};
    const result = this.default();
    for (const name of SOUND_NAMES) {
      if (typeof input[name] === "boolean") result[name] = input[name];
    }
    if (typeof input.volume === "number" && Number.isFinite(input.volume)) {
      result.volume = Math.max(0, Math.min(1, input.volume));
    }
    return result;
  }
  get volume() {
    return this.get().volume;
  }
  setVolume(value: number) {
    if (Number.isFinite(value))
      this.set("volume", Math.max(0, Math.min(1, value)));
  }
  enabled(name: SoundName): boolean {
    return this.get()[name];
  }
  toggle(name: SoundName) {
    return this.set(name, !this.enabled(name));
  }
}
