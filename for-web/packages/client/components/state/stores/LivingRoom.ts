import {
  type Corners,
  type Point,
  type RoomChatSettings,
  type RoomPreset,
  type RoomScene,
  clamp,
  cleanScene,
  defaultScene,
  defaultSeat,
  scenePoint,
  validCorners,
} from "@revolt/rtc/living-room/model";
import {
  type RoomSyncState,
  emptyRoomSync,
} from "@revolt/rtc/living-room/syncModel";
import { type Accessor, type Setter, batch, createSignal } from "solid-js";
import { reconcile } from "solid-js/store";
import { AbstractStore } from ".";
import { State } from "..";

export type TypeLivingRoom = {
  version: 1;
  enabled: boolean;
  synchronized: boolean;
  activePreset: string;
  dirty: boolean;
  scene: RoomScene;
  presets: RoomPreset[];
};
export class LivingRoom extends AbstractStore<"livingRoom", TypeLivingRoom> {
  #sync: Accessor<RoomSyncState>;
  #setSync: Setter<RoomSyncState>;
  #viewing: Accessor<string | undefined>;
  #setViewing: Setter<string | undefined>;
  #views = new Map<string, number>();
  #moveShared?: (id: string, point: Point) => void;
  #watching: Accessor<{ channel: string; owners: string[] } | undefined>;
  #setWatching: Setter<{ channel: string; owners: string[] } | undefined>;
  constructor(state: State) {
    super(state, "livingRoom");
    const [sync, setSync] = createSignal(emptyRoomSync());
    this.#sync = sync;
    this.#setSync = setSync;
    const [viewing, setViewing] = createSignal<string>();
    this.#viewing = viewing;
    this.#setViewing = setViewing;
    const [watching, setWatching] = createSignal<{
      channel: string;
      owners: string[];
    }>();
    this.#watching = watching;
    this.#setWatching = setWatching;
  }
  hydrate() {
    this.#setWatching(undefined);
  }
  get synchronized() {
    return this.get().synchronized;
  }
  set synchronized(value: boolean) {
    this.set("synchronized", value);
  }
  get syncState() {
    return this.#sync();
  }
  setSyncState(value: RoomSyncState) {
    this.#setSync(value);
  }
  bindSharedMove(handler?: (id: string, point: Point) => void) {
    this.#moveShared = handler;
  }
  get viewing() {
    return this.#viewing();
  }
  enterView(channel: string) {
    this.#views.set(channel, (this.#views.get(channel) ?? 0) + 1);
    this.#setViewing(channel);
    return () => {
      const remaining = (this.#views.get(channel) ?? 1) - 1;
      if (remaining > 0) this.#views.set(channel, remaining);
      else this.#views.delete(channel);
      this.#setViewing(this.#views.keys().next().value);
    };
  }
  point(channel: string, id: string, self = false): Point {
    const sync = this.syncState;
    if (
      this.synchronized &&
      sync.active &&
      sync.channel === channel &&
      sync.positions[id]
    )
      return sync.positions[id];
    return scenePoint(this.scene, channel, id, self);
  }
  listenerPoint(channel: string): Point {
    return this.point(channel, this.syncState.selfId, true);
  }
  get watching() {
    return this.#watching();
  }
  watch(channel: string, owners: string[]) {
    const previous = this.watching;
    if (
      previous?.channel === channel &&
      previous.owners.join("|") === owners.join("|")
    )
      return;
    this.#setWatching({ channel, owners });
  }
  default(): TypeLivingRoom {
    return {
      version: 1,
      enabled: false,
      synchronized: false,
      activePreset: "default",
      dirty: false,
      scene: defaultScene(),
      presets: [],
    };
  }
  clean(input: Partial<TypeLivingRoom>): TypeLivingRoom {
    if (!input || typeof input !== "object") return this.default();
    const presets: RoomPreset[] = [];
    for (const p of Array.isArray(input.presets)
      ? input.presets.slice(0, 50)
      : []) {
      if (
        !p ||
        typeof p.id !== "string" ||
        !/^[\w-]{1,100}$/.test(p.id) ||
        p.id === "default" ||
        presets.some((x) => x.id === p.id)
      )
        continue;
      presets.push({
        id: p.id,
        name: typeof p.name === "string" ? p.name.slice(0, 80) : "Minha sala",
        scene: cleanScene(p.scene),
      });
    }
    return {
      version: 1,
      enabled: input.enabled === true,
      synchronized: input.synchronized === true,
      dirty: input.dirty === true,
      activePreset: presets.some((p) => p.id === input.activePreset)
        ? input.activePreset!
        : "default",
      scene: cleanScene(input.scene),
      presets,
    };
  }
  get enabled() {
    return this.get().enabled;
  }
  set enabled(value: boolean) {
    this.set("enabled", value);
  }
  get scene() {
    return this.get().scene;
  }
  get presets() {
    return this.get().presets;
  }
  get activePreset() {
    return this.get().activePreset;
  }
  get dirty() {
    return this.get().dirty;
  }
  update(patch: Partial<RoomScene>) {
    batch(() => {
      this.set("scene", reconcile(cleanScene({ ...this.scene, ...patch })));
      this.set("dirty", true);
    });
  }
  screen(patch: Partial<RoomScene["screen"]>) {
    this.update({ screen: { ...this.scene.screen, ...patch } });
  }
  spatial(patch: Partial<RoomScene["spatial"]>) {
    this.update({ spatial: { ...this.scene.spatial, ...patch } });
  }
  positionSpeaker(point: Point) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    batch(() => {
      this.set("scene", "speaker", {
        x: clamp(point.x, 0.045, 0.955),
        y: clamp(point.y, 0.06, 0.94),
      });
      if (!this.dirty) this.set("dirty", true);
    });
  }
  chat(patch: Partial<RoomChatSettings>) {
    this.update({ chat: { ...this.scene.chat, ...patch } });
  }
  positionChat(rect: Pick<RoomChatSettings, "x" | "y" | "width" | "height">) {
    if (!Object.values(rect).every(Number.isFinite)) return;
    const width = clamp(rect.width, 0.15, 0.8),
      height = clamp(rect.height, 0.15, 0.85);
    const next = {
      width,
      height,
      x: clamp(rect.x, 0.015, 0.985 - width),
      y: clamp(rect.y, 0.015, 0.985 - height),
    };
    batch(() => {
      this.set("scene", "chat", next);
      if (!this.dirty) this.set("dirty", true);
    });
  }
  assign(channel: string, identities: string[]) {
    const assignments = { ...this.scene.assignments },
      seats = [...this.scene.seats];
    let changed = false;
    const used = new Set(
      Object.entries(assignments)
        .filter(([k]) => k.startsWith(`${channel}:`))
        .map(([, v]) => v),
    );
    for (const id of identities) {
      const key = `${channel}:${id}`;
      if (assignments[key] !== undefined) continue;
      let slot = 0;
      while (used.has(slot)) slot++;
      if (slot >= 80) continue;
      if (!seats[slot]) seats[slot] = defaultSeat(slot);
      assignments[key] = slot;
      used.add(slot);
      changed = true;
    }
    if (changed)
      batch(() => {
        this.set("scene", "assignments", reconcile(assignments));
        this.set("scene", "seats", reconcile(seats));
      });
  }
  move(channel: string, id: string, position: Point, self = false) {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
    if (
      this.synchronized &&
      this.syncState.active &&
      this.syncState.channel === channel &&
      this.#moveShared
    ) {
      this.#moveShared(id, {
        x: clamp(position.x, 0.015, 0.985),
        y: clamp(position.y, 0.015, 0.985),
      });
      return;
    }
    const slot = this.scene.assignments[`${channel}:${id}`];
    const current = self ? this.scene.listener : this.scene.seats[slot];
    if (!current) return;
    const next = {
      x: clamp(position.x, 0.015, 0.985),
      y: clamp(position.y, 0.015, 0.985),
    };
    if (current.x === next.x && current.y === next.y) return;
    // Pointer updates only touch the moved point, rather than cleaning/cloning the scene.
    batch(() => {
      if (self) this.set("scene", "listener", next);
      else this.set("scene", "seats", slot, next);
      if (!this.dirty) this.set("dirty", true);
    });
  }
  positionScreen(corners: Corners) {
    if (
      !validCorners(corners) ||
      !corners.every(
        (p) =>
          Number.isFinite(p.x) &&
          Number.isFinite(p.y) &&
          p.x >= 0.015 &&
          p.x <= 0.985 &&
          p.y >= 0.015 &&
          p.y <= 0.985,
      )
    )
      return;
    if (
      corners.every(
        (p, i) =>
          p.x === this.scene.screen.corners[i].x &&
          p.y === this.scene.screen.corners[i].y,
      )
    )
      return;
    batch(() => {
      this.set("scene", "screen", "corners", reconcile(corners));
      if (!this.dirty) this.set("dirty", true);
    });
  }
  apply(id: string) {
    const scene =
      id === "default"
        ? defaultScene()
        : this.presets.find((p) => p.id === id)?.scene;
    if (!scene) return;
    batch(() => {
      this.set("scene", cleanScene(scene));
      this.set("activePreset", id);
      this.set("dirty", false);
    });
  }
  save(name: string, replace = false) {
    const title = name.trim().slice(0, 80) || "Minha sala";
    const id =
      replace && this.activePreset !== "default"
        ? this.activePreset
        : crypto.randomUUID();
    const presets = this.presets.filter((p) => p.id !== id);
    if (presets.length >= 50)
      throw new Error(
        "Limite de 50 presets. Exclua um preset para salvar outro.",
      );
    presets.push({ id, name: title, scene: cleanScene(this.scene) });
    batch(() => {
      this.set("presets", presets);
      this.set("activePreset", id);
      this.set("dirty", false);
    });
  }
  rename(name: string) {
    if (this.activePreset === "default" || !name.trim()) return;
    this.set(
      "presets",
      (p) => p.id === this.activePreset,
      "name",
      name.trim().slice(0, 80),
    );
  }
  remove(id: string) {
    this.set(
      "presets",
      this.presets.filter((p) => p.id !== id),
    );
    if (this.activePreset === id) this.apply("default");
  }
}
