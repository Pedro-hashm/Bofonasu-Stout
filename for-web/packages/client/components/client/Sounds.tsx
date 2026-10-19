import { Sounds, useState } from "@revolt/state";
import type { SoundName } from "@revolt/state/stores/Sounds";
import {
  createContext,
  JSXElement,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";
import cameraOff from "../../src/assets/sounds/camera_off.wav";
import cameraOn from "../../src/assets/sounds/camera_on.wav";
import deafen from "../../src/assets/sounds/deafen.wav";
import message from "../../src/assets/sounds/message.wav";
import mute from "../../src/assets/sounds/mute.wav";
import ringtoneIncoming from "../../src/assets/sounds/ringtone_incoming.wav";
import ringtoneOutgoing from "../../src/assets/sounds/ringtone_outgoing.wav";
import streamEnd from "../../src/assets/sounds/stream_end.wav";
import streamStart from "../../src/assets/sounds/stream_start.wav";
import streamViewerJoin from "../../src/assets/sounds/stream_viewer_join.wav";
import streamViewerLeave from "../../src/assets/sounds/stream_viewer_leave.wav";
import uiClick from "../../src/assets/sounds/ui_click.wav";
import undeafen from "../../src/assets/sounds/undeafen.wav";
import unmute from "../../src/assets/sounds/unmute.wav";
import userJoinVoice from "../../src/assets/sounds/user_join_voice.wav";
import userLeaveVoice from "../../src/assets/sounds/user_leave_voice.wav";
import userMoved from "../../src/assets/sounds/user_moved.wav";

const ASSETS: Record<SoundName, string> = {
  cameraOff,
  cameraOn,
  deafen,
  message,
  mute,
  ringtoneIncoming,
  ringtoneOutgoing,
  streamEnd,
  streamStart,
  streamViewerJoin,
  streamViewerLeave,
  uiClick,
  undeafen,
  unmute,
  userJoinVoice,
  userLeaveVoice,
  userMoved,
};

/** Cached local audio, unlocked by user interaction before async call actions finish. */
export class SoundController {
  readonly soundState: Sounds;
  node?: HTMLAudioElement;
  lastPlayedSound?: SoundName;
  private context?: AudioContext;
  private disposed = false;
  private buffers = new Map<SoundName, AudioBuffer>();
  private loading = new Map<SoundName, Promise<AudioBuffer | undefined>>();
  private active = new Set<AudioBufferSourceNode>();
  private elements = new Set<HTMLAudioElement>();
  private lastClick = -Infinity;
  private warned = false;

  constructor(soundState: Sounds) {
    this.soundState = soundState;
    this.playSound = this.playSound.bind(this);
    this.unlock = this.unlock.bind(this);
  }
  private getContext() {
    if (
      !this.context &&
      !this.disposed &&
      typeof AudioContext !== "undefined"
    ) {
      try {
        this.context = new AudioContext({ latencyHint: "interactive" });
      } catch {
        /* HTML audio fallback */
      }
    }
    return this.context;
  }
  private load(name: SoundName): Promise<AudioBuffer | undefined> {
    const cached = this.buffers.get(name);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(name);
    if (pending) return pending;
    const context = this.getContext();
    if (!context) return Promise.resolve(undefined);
    const promise = fetch(ASSETS[name])
      .then((response) => {
        if (!response.ok) throw new Error(`Sound asset ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        if (!this.disposed) this.buffers.set(name, buffer);
        return buffer;
      })
      .catch(() => undefined)
      .finally(() => this.loading.delete(name));
    this.loading.set(name, promise);
    return promise;
  }
  preload() {
    for (const name of Object.keys(ASSETS) as SoundName[]) void this.load(name);
  }
  unlock() {
    const context = this.getContext();
    if (context?.state === "suspended") void context.resume().catch(() => {});
  }
  isPlaying(): boolean {
    return (
      this.active.size > 0 ||
      [...this.elements].some((node) => !node.paused && !node.ended)
    );
  }
  canPlay(name: SoundName): boolean {
    return (
      !this.disposed &&
      this.soundState.enabled(name) &&
      this.soundState.volume > 0
    );
  }
  private gain(name: SoundName) {
    return this.soundState.volume * (name === "uiClick" ? 0.35 : 1);
  }
  private playBuffer(name: SoundName, buffer: AudioBuffer) {
    const context = this.context;
    if (!context || context.state !== "running" || this.disposed) return false;
    if (this.active.size >= 8) {
      if (name === "uiClick") return false;
      this.active.values().next().value?.stop();
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = this.gain(name);
    source.connect(gain).connect(context.destination);
    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
    return true;
  }
  private playElement(name: SoundName) {
    if (this.disposed || this.soundState.volume <= 0) return;
    const node = new Audio(ASSETS[name]);
    node.volume = this.gain(name);
    this.node = node;
    this.elements.add(node);
    const done = () => this.elements.delete(node);
    node.addEventListener("ended", done, { once: true });
    node.addEventListener("error", done, { once: true });
    void node.play().catch(() => {
      done();
      if (!this.warned && !this.disposed) {
        this.warned = true;
        console.warn(
          "Sound playback was blocked. Interact with the app to enable audio.",
        );
      }
    });
  }
  playSound(name: SoundName, force = false): boolean {
    if (
      this.disposed ||
      (!force && !this.canPlay(name)) ||
      this.soundState.volume <= 0
    )
      return false;
    const now = performance.now();
    if (name === "uiClick") {
      if (now - this.lastClick < 45) return false;
      this.lastClick = now;
    }
    this.lastPlayedSound = name;
    this.unlock();
    const buffer = this.buffers.get(name);
    if (buffer && this.playBuffer(name, buffer)) return true;
    void this.load(name).then((loaded) => {
      // Don't replay stale interactions after an asset or autoplay delay.
      if (
        this.disposed ||
        (!force && !this.canPlay(name)) ||
        performance.now() - now > (name === "uiClick" ? 300 : 2000)
      )
        return;
      if (!loaded || !this.playBuffer(name, loaded)) this.playElement(name);
    });
    return true;
  }
  dispose() {
    this.disposed = true;
    for (const source of this.active) source.stop();
    for (const node of this.elements) node.pause();
    this.active.clear();
    this.elements.clear();
    this.buffers.clear();
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => {});
  }
}

const soundContext = createContext(null! as SoundController);
const CLICK_TARGETS =
  'button, a, [role="button"], [role="tab"], [role="menuitem"], [role="switch"], input[type="checkbox"], input[type="radio"]';
export function SoundContext(props: { children: JSXElement }) {
  const { sounds } = useState();
  const controller = new SoundController(sounds);
  onMount(() => {
    controller.preload();
    const click = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const path = event
        .composedPath()
        .filter((node): node is Element => node instanceof Element);
      if (
        path.some((element) =>
          element.matches('[data-ui-sound="off"], [aria-disabled="true"]'),
        )
      )
        return;
      const target = path.find((element) => element.matches(CLICK_TARGETS));
      if (!target || target.matches(":disabled")) return;
      controller.playSound("uiClick");
    };
    // Capture also covers portalled tools, settings and menu controls.
    document.addEventListener("pointerdown", controller.unlock, true);
    document.addEventListener("keydown", controller.unlock, true);
    document.addEventListener("click", click, true);
    onCleanup(() => {
      document.removeEventListener("pointerdown", controller.unlock, true);
      document.removeEventListener("keydown", controller.unlock, true);
      document.removeEventListener("click", click, true);
    });
  });
  onCleanup(() => controller.dispose());
  return (
    <soundContext.Provider value={controller}>
      {props.children}
    </soundContext.Provider>
  );
}
export function useSound(): SoundController {
  return useContext(soundContext);
}
