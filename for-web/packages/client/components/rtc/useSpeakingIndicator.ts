import { Participant, ParticipantEvent, Track } from "livekit-client";
import { Accessor, createSignal, onCleanup, Setter } from "solid-js";

const SAMPLE_INTERVAL_MS = 20;
const RELEASE_MS = 140;
const ATTACK_RMS = 0.008;
const RELEASE_RMS = 0.004;

interface Monitor {
  participant: Participant;
  users: number;
  speaking: Accessor<boolean>;
  setSpeaking: Setter<boolean>;
  source?: MediaStreamAudioSourceNode;
  analyser?: AnalyserNode;
  mediaTrack?: MediaStreamTrack;
  analysisTrack?: MediaStreamTrack;
  samples: Float32Array<ArrayBuffer>;
  lastActivity: number;
  noiseFloor: number;
  retryAfter: number;
  serverChanged: () => void;
}

// A participant may appear in several views. Share one analyser per participant
// and one context/timer for the whole call, rather than sampling once per tile.
const monitors = new Map<Participant, Monitor>();
let context: AudioContext | undefined;
let unavailable = false;
let timer: ReturnType<typeof setInterval> | undefined;

function resumeContext() {
  if (context?.state === "suspended") void context.resume().catch(() => {});
}

function getContext() {
  if (!context && !unavailable) {
    try {
      context = new AudioContext({ latencyHint: "interactive" });
      resumeContext();
    } catch {
      unavailable = true;
    }
  }
  return context;
}

function detach(monitor: Monitor) {
  monitor.source?.disconnect();
  monitor.analyser?.disconnect();
  monitor.analysisTrack?.stop();
  monitor.analysisTrack = undefined;
  monitor.source = undefined;
  monitor.analyser = undefined;
  monitor.mediaTrack = undefined;
  monitor.lastActivity = -Infinity;
  monitor.noiseFloor = 0.001;
  // Only stop our private clone. The call's original track belongs to LiveKit.
}

function serverFallback(monitor: Monitor) {
  const publication = monitor.participant.getTrackPublication(
    Track.Source.Microphone,
  );
  monitor.setSpeaking(
    !!publication && !publication.isMuted && monitor.participant.isSpeaking,
  );
}

function sample(monitor: Monitor, now: number) {
  const publication = monitor.participant.getTrackPublication(
    Track.Source.Microphone,
  );
  const track = publication?.track;
  const mediaTrack = track?.mediaStreamTrack;
  if (
    !publication ||
    publication.isMuted ||
    track?.isMuted ||
    mediaTrack?.readyState === "ended" ||
    mediaTrack?.enabled === false
  ) {
    detach(monitor);
    monitor.setSpeaking(false);
    return;
  }
  if (!mediaTrack) {
    detach(monitor);
    serverFallback(monitor);
    return;
  }

  // Also catches device changes, reconnects and replacement of the processed
  // local track. LocalTrack.mediaStreamTrack exposes the processed microphone.
  if (mediaTrack !== monitor.mediaTrack) {
    detach(monitor);
    if (now < monitor.retryAfter) {
      serverFallback(monitor);
      return;
    }
    const audioContext = getContext();
    if (audioContext && audioContext.state !== "closed") {
      try {
        monitor.analysisTrack = mediaTrack.clone();
        const source = audioContext.createMediaStreamSource(
          new MediaStream([monitor.analysisTrack]),
        );
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = monitor.samples.length;
        analyser.smoothingTimeConstant = 0;
        // No connection to destination: this observes audio without playing
        // another copy or changing volume, noise suppression or permissions.
        monitor.source = source;
        monitor.analyser = analyser;
        source.connect(analyser);
        monitor.mediaTrack = mediaTrack;
      } catch {
        detach(monitor);
        monitor.retryAfter = now + 1000;
      }
    }
  }
  if (!monitor.analyser || context?.state !== "running") {
    serverFallback(monitor);
    return;
  }

  monitor.analyser.getFloatTimeDomainData(monitor.samples);
  let energy = 0;
  for (const value of monitor.samples) energy += value * value;
  const rms = Math.sqrt(energy / monitor.samples.length);
  // Learn quiet background levels without learning the speaker's louder voice.
  // Otherwise low-level hiss could hold the release threshold open forever.
  if (rms < ATTACK_RMS) monitor.noiseFloor += (rms - monitor.noiseFloor) * 0.08;
  // Immediate attack, lower release threshold and a short hold through pauses.
  // When audio sampling works, server events cannot extend or delay this state.
  const threshold = monitor.speaking()
    ? Math.max(RELEASE_RMS, monitor.noiseFloor * 1.8)
    : Math.max(ATTACK_RMS, monitor.noiseFloor * 3);
  if (rms >= threshold) monitor.lastActivity = now;
  monitor.setSpeaking(now - monitor.lastActivity <= RELEASE_MS);
}

function start() {
  if (timer !== undefined) return;
  window.addEventListener("pointerdown", resumeContext, true);
  window.addEventListener("keydown", resumeContext, true);
  document.addEventListener("visibilitychange", resumeContext);
  timer = setInterval(() => {
    const now = performance.now();
    for (const monitor of monitors.values()) {
      try {
        sample(monitor, now);
      } catch {
        detach(monitor);
        monitor.retryAfter = now + 1000;
        serverFallback(monitor);
      }
    }
  }, SAMPLE_INTERVAL_MS);
}

function stop() {
  clearInterval(timer);
  timer = undefined;
  window.removeEventListener("pointerdown", resumeContext, true);
  window.removeEventListener("keydown", resumeContext, true);
  document.removeEventListener("visibilitychange", resumeContext);
  const previous = context;
  context = undefined;
  unavailable = false;
  if (previous && previous.state !== "closed")
    void previous.close().catch(() => {});
}

/** Audio-driven UI feedback; the SDK remains the fallback if Web Audio cannot run. */
export function useSpeakingIndicator(
  participant: Participant,
): Accessor<boolean> {
  let monitor = monitors.get(participant);
  if (!monitor) {
    const [speaking, setSpeaking] = createSignal(false);
    const next: Monitor = {
      participant,
      users: 0,
      speaking,
      setSpeaking,
      samples: new Float32Array(512),
      lastActivity: -Infinity,
      noiseFloor: 0.001,
      retryAfter: 0,
      serverChanged: () => {
        if (!next.analyser || context?.state !== "running")
          serverFallback(next);
      },
    };
    monitor = next;
    monitors.set(participant, next);
    participant.on(ParticipantEvent.IsSpeakingChanged, next.serverChanged);
  }
  const current = monitor;
  current.users++;
  start();
  onCleanup(() => {
    if (monitors.get(participant) !== current) return;
    if (--current.users > 0) return;
    participant.off(ParticipantEvent.IsSpeakingChanged, current.serverChanged);
    detach(current);
    monitors.delete(participant);
    if (!monitors.size) stop();
  });
  return current.speaking;
}

if (import.meta.hot)
  import.meta.hot.dispose(() => {
    for (const monitor of monitors.values()) {
      monitor.participant.off(
        ParticipantEvent.IsSpeakingChanged,
        monitor.serverChanged,
      );
      detach(monitor);
    }
    monitors.clear();
    stop();
  });
