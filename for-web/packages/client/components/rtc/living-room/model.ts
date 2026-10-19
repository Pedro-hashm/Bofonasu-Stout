export type Point = { x: number; y: number };
export type Corners = [Point, Point, Point, Point];
export type RoomChatSettings = {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  temporary: boolean;
  duration: number;
  limit: number;
  opacity: number;
  fontSize: number;
  source: "call" | "current";
};
export type RoomScene = {
  aspect: number;
  background: {
    kind: "studio" | "image" | "color";
    color: string;
    assetId?: string;
  };
  seats: Point[];
  assignments: Record<string, number>;
  listener: Point;
  speaker: Point;
  avatarSize: number;
  names: "hover" | "always" | "never";
  accent: string;
  chat: RoomChatSettings;
  screen: {
    aspect: number;
    corners: Corners;
    mode: "single" | "grid" | "focus";
    fit: "contain" | "cover";
    idle: "panel" | "transparent" | "clock";
    layer: "front" | "back";
    radius: number;
    border: number;
    color: string;
    glow: number;
    shadow: number;
    gap: number;
    columns: number;
    cameras: boolean;
  };
  spatial: {
    enabled: boolean;
    method: "hrtf" | "stereo";
    width: number;
    distance: number;
  };
};
export type RoomPreset = { id: string; name: string; scene: RoomScene };
export const DEFAULT_CORNERS: Corners = [
  { x: 0.2, y: 0.045 },
  { x: 0.8, y: 0.045 },
  { x: 0.8, y: 0.645 },
  { x: 0.2, y: 0.645 },
];
export function defaultSeat(index: number): Point {
  const columns = 6;
  if (index >= 12) {
    const halton = (n: number, base: number) => {
      let value = 0,
        fraction = 1;
      while (n > 0) {
        fraction /= base;
        value += fraction * (n % base);
        n = Math.floor(n / base);
      }
      return value;
    };
    return {
      x: 0.08 + halton(index - 11, 2) * 0.84,
      y: 0.68 + halton(index - 11, 3) * 0.24,
    };
  }
  return {
    x: 0.12 + (index % columns) * 0.152,
    y: 0.72 + Math.floor(index / columns) * 0.15,
  };
}
export function defaultScene(): RoomScene {
  return {
    aspect: 16 / 9,
    background: { kind: "studio", color: "#121324" },
    seats: Array.from({ length: 12 }, (_, i) => defaultSeat(i)),
    assignments: {},
    listener: { x: 0.5, y: 0.94 },
    speaker: { x: 0.82, y: 0.82 },
    avatarSize: 64,
    names: "hover",
    accent: "#93e7c0",
    chat: {
      visible: true,
      x: 0.035,
      y: 0.18,
      width: 0.3,
      height: 0.46,
      temporary: true,
      duration: 12,
      limit: 5,
      opacity: 0,
      fontSize: 18,
      source: "call",
    },
    screen: {
      aspect: 16 / 9,
      corners: DEFAULT_CORNERS.map((p) => ({ ...p })) as Corners,
      mode: "single",
      fit: "contain",
      idle: "panel",
      layer: "back",
      radius: 8,
      border: 2,
      color: "#7474b5",
      glow: 0.3,
      shadow: 0.5,
      gap: 8,
      columns: 0,
      cameras: true,
    },
    spatial: { enabled: false, method: "hrtf", width: 0.65, distance: 0.15 },
  };
}
export const clamp = (v: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, v));
const record = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const number = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? clamp(v, min, max) : fallback;
const color = (v: unknown, fallback: string) =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
function choice<T extends string>(
  v: unknown,
  choices: readonly T[],
  fallback: T,
): T {
  return choices.includes(v as T) ? (v as T) : fallback;
}
function point(v: unknown, fallback: Point): Point {
  const p = record(v);
  return {
    x: number(p.x, fallback.x, 0.015, 0.985),
    y: number(p.y, fallback.y, 0.015, 0.985),
  };
}
/** Convex, clockwise, non-degenerate screen; prevents inverted/singular warps. */
export function validCorners(points: Point[]): points is Corners {
  if (points.length !== 4) return false;
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = points[i],
      b = points[(i + 1) % 4],
      c = points[(i + 2) % 4];
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) < 0.0004)
      return false;
    area += a.x * b.y - b.x * a.y;
  }
  return area > 0.008;
}
export function cleanScene(value: unknown): RoomScene {
  const d = defaultScene(),
    v = record(value),
    bg = record(v.background),
    s = record(v.screen),
    a = record(v.spatial),
    chat = record(v.chat);
  const corners = Array.isArray(s.corners)
    ? s.corners.map((p, i) => point(p, d.screen.corners[i % 4]))
    : d.screen.corners;
  const seats =
    Array.isArray(v.seats) && v.seats.length
      ? v.seats.slice(0, 80).map((p, i) => point(p, defaultSeat(i)))
      : d.seats;
  const assignments: Record<string, number> = {};
  for (const [key, index] of Object.entries(record(v.assignments)).slice(
    0,
    1000,
  )) {
    if (
      /^[\w:-]{1,160}$/.test(key) &&
      Number.isInteger(index) &&
      Number(index) >= 0 &&
      Number(index) < seats.length
    )
      assignments[key] = Number(index);
  }
  return {
    aspect: number(v.aspect, d.aspect, 0.25, 4),
    background: {
      kind: choice(bg.kind, ["studio", "image", "color"], "studio"),
      color: color(bg.color, d.background.color),
      assetId:
        typeof bg.assetId === "string" && /^[\w-]{1,100}$/.test(bg.assetId)
          ? bg.assetId
          : undefined,
    },
    seats,
    assignments,
    listener: point(v.listener, d.listener),
    speaker: point(v.speaker, d.speaker),
    avatarSize: number(v.avatarSize, d.avatarSize, 28, 120),
    names: choice(v.names, ["hover", "always", "never"], "hover"),
    accent: color(v.accent, d.accent),
    chat: {
      visible: typeof chat.visible === "boolean" ? chat.visible : true,
      width: number(chat.width, d.chat.width, 0.15, 0.8),
      height: number(chat.height, d.chat.height, 0.15, 0.85),
      x: number(
        chat.x,
        d.chat.x,
        0.015,
        0.985 - number(chat.width, d.chat.width, 0.15, 0.8),
      ),
      y: number(
        chat.y,
        d.chat.y,
        0.015,
        0.985 - number(chat.height, d.chat.height, 0.15, 0.85),
      ),
      temporary: typeof chat.temporary === "boolean" ? chat.temporary : true,
      duration: number(chat.duration, 12, 3, 120),
      limit: Math.round(number(chat.limit, 5, 1, 15)),
      opacity: number(chat.opacity, 0, 0, 0.95),
      fontSize: number(chat.fontSize, 18, 12, 30),
      source: choice(chat.source, ["call", "current"], "call"),
    },
    screen: {
      aspect: number(s.aspect, 16 / 9, 0.5, 4),
      corners: validCorners(corners) ? corners : d.screen.corners,
      mode: choice(s.mode, ["single", "grid", "focus"], "single"),
      fit: choice(s.fit, ["contain", "cover"], "contain"),
      idle: choice(s.idle, ["panel", "transparent", "clock"], "panel"),
      layer: choice(s.layer, ["front", "back"], "back"),
      radius: number(s.radius, 8, 0, 80),
      border: number(s.border, 2, 0, 20),
      color: color(s.color, d.screen.color),
      glow: number(s.glow, 0.3, 0, 1),
      shadow: number(s.shadow, 0.5, 0, 1),
      gap: number(s.gap, 8, 0, 40),
      columns: Math.round(number(s.columns, 0, 0, 6)),
      cameras: typeof s.cameras === "boolean" ? s.cameras : true,
    },
    spatial: {
      enabled: a.enabled === true,
      method: choice(a.method, ["hrtf", "stereo"], "hrtf"),
      width: number(a.width, 0.65, 0, 1),
      distance: number(a.distance, 0.15, 0, 0.5),
    },
  };
}
export function scenePoint(
  scene: RoomScene,
  channel: string,
  id: string,
  self = false,
): Point {
  if (self) return scene.listener;
  const index = scene.assignments[`${channel}:${id}`];
  return scene.seats[index] ?? { x: 0.5, y: 0.75 };
}
/** Homography from a unit square to the four selected screen corners. */
export function screenMatrix(
  corners: Corners,
  width: number,
  height: number,
  screenWidth: number,
  screenHeight: number,
): string {
  const [p0, p1, p2, p3] = corners.map((p) => ({
    x: p.x * width,
    y: p.y * height,
  }));
  const dx1 = p1.x - p2.x,
    dx2 = p3.x - p2.x,
    dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y,
    dy2 = p3.y - p2.y,
    dy3 = p0.y - p1.y + p2.y - p3.y;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = Math.abs(det) < 1e-8 ? 0 : (dx3 * dy2 - dx2 * dy3) / det;
  const h = Math.abs(det) < 1e-8 ? 0 : (dx1 * dy3 - dx3 * dy1) / det;
  const a = p1.x - p0.x + g * p1.x,
    b = p3.x - p0.x + h * p3.x;
  const d = p1.y - p0.y + g * p1.y,
    e = p3.y - p0.y + h * p3.y;
  return `matrix3d(${a / screenWidth},${d / screenWidth},0,${g / screenWidth},${b / screenHeight},${e / screenHeight},0,${h / screenHeight},0,0,1,0,${p0.x},${p0.y},0,1)`;
}
