type Lane = "shared" | "preview";
export type SpatialSettings = {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  distance: number;
  method: "hrtf" | "stereo";
};

/** Independent effects mixer: never captures or republishes microphone audio. */
export class SoundboardAudio {
  private context?: AudioContext;
  private output?: HTMLAudioElement;
  private gain?: GainNode;
  private panner?: PannerNode;
  private previewGain?: GainNode;
  private nodes = new Map<Lane, AudioBufferSourceNode>();
  private generations = { shared: 0, preview: 0 };
  private buffers = new Map<string, AudioBuffer>();
  private closed = false;
  private sink = "";
  constructor(
    private onBlocked: (blocked: boolean) => void,
    private onReady: () => void,
  ) {}
  private init() {
    if (this.closed) throw new Error("A reprodução foi encerrada.");
    if (this.context) return this.context;
    const context = (this.context = new AudioContext({
      latencyHint: "interactive",
    }));
    this.gain = context.createGain();
    this.previewGain = context.createGain();
    this.panner = context.createPanner();
    this.panner.rolloffFactor = 0;
    this.panner.positionZ.value = -2;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -6;
    compressor.knee.value = 6;
    compressor.ratio.value = 6;
    const destination = context.createMediaStreamDestination();
    this.gain.connect(this.panner).connect(compressor);
    this.previewGain.connect(compressor);
    compressor.connect(destination);
    this.output = new Audio();
    this.output.srcObject = destination.stream;
    this.onReady();
    return context;
  }
  async unlock() {
    try {
      const context = this.init();
      await context.resume();
      await this.output!.play();
      this.onBlocked(context.state !== "running");
    } catch {
      if (!this.closed) this.onBlocked(true);
    }
  }
  async settings(volume: number, sink: string, spatial: SpatialSettings) {
    if (!this.context || this.closed) return;
    const now = this.context.currentTime;
    const distance = Math.hypot(spatial.x, spatial.y);
    const angle = spatial.enabled
      ? Math.atan2(spatial.x, -spatial.y) * spatial.width
      : 0;
    this.panner!.panningModel =
      spatial.method === "hrtf" ? "HRTF" : "equalpower";
    this.panner!.positionX.setTargetAtTime(Math.sin(angle) * 2, now, 0.035);
    this.panner!.positionZ.setTargetAtTime(-Math.cos(angle) * 2, now, 0.035);
    this.gain!.gain.setTargetAtTime(
      volume *
        (spatial.enabled
          ? 1 - spatial.distance * Math.min(1, distance / 0.85)
          : 1),
      now,
      0.02,
    );
    this.previewGain!.gain.setTargetAtTime(volume, now, 0.02);
    if (sink !== this.sink && this.output?.setSinkId) {
      try {
        await this.output.setSinkId(sink || "default");
        this.sink = sink;
      } catch {
        this.sink = "";
        throw new Error(
          "Não foi possível selecionar a saída dos efeitos. Confira o dispositivo de áudio.",
        );
      }
    }
  }
  async duration(file: Blob) {
    const buffer = await this.init().decodeAudioData(await file.arrayBuffer());
    return buffer.duration;
  }
  async play(
    file: Blob,
    start: number,
    lane: Lane,
    ended: () => void,
    key: string,
  ) {
    this.stop(lane);
    const generation = this.generations[lane];
    const context = this.init();
    let buffer = this.buffers.get(key);
    if (!buffer) {
      buffer = await context.decodeAudioData(await file.arrayBuffer());
      if (this.closed || generation !== this.generations[lane]) return;
      let bytes = 0;
      for (const b of this.buffers.values())
        bytes += b.length * b.numberOfChannels * 4;
      if (
        bytes + buffer.length * buffer.numberOfChannels * 4 >
        32 * 1024 * 1024
      )
        this.buffers.clear();
      this.buffers.set(key, buffer);
    }
    if (this.closed || generation !== this.generations[lane]) return;
    const elapsed = lane === "preview" ? 0 : (Date.now() - start) / 1000;
    if (elapsed >= buffer.duration) {
      ended();
      return;
    }
    const node = context.createBufferSource();
    node.buffer = buffer;
    node.connect(lane === "shared" ? this.gain! : this.previewGain!);
    node.onended = () => {
      node.disconnect();
      if (this.nodes.get(lane) === node) {
        this.nodes.delete(lane);
        ended();
      }
    };
    this.nodes.set(lane, node);
    node.start(
      context.currentTime + Math.max(0, -elapsed),
      Math.max(0, elapsed),
    );
    if (context.state !== "running" || this.output?.paused)
      this.onBlocked(true);
  }
  stop(lane: Lane) {
    this.generations[lane]++;
    const node = this.nodes.get(lane);
    this.nodes.delete(lane);
    if (node) {
      node.onended = null;
      node.stop();
      node.disconnect();
    }
  }
  close() {
    this.closed = true;
    this.stop("shared");
    this.stop("preview");
    this.buffers.clear();
    this.output?.pause();
    if (this.output) this.output.srcObject = null;
    void this.context?.close().catch(() => {});
  }
}
