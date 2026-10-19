import type { Point } from "./model";

export type RoomPeer = { viewing: boolean; synchronized: boolean };
export type RoomSyncState = {
  channel: string;
  selfId: string;
  active: boolean;
  status: "idle" | "connecting" | "ready" | "error";
  error: string;
  positions: Record<string, Point>;
  peers: Record<string, RoomPeer>;
};
export const emptyRoomSync = (): RoomSyncState => ({
  channel: "",
  selfId: "",
  active: false,
  status: "idle",
  error: "",
  positions: {},
  peers: {},
});
export type SharedPosition = Point & {
  id: string;
  clock: number;
  writer: string;
};
export const roomIdentity = (id: unknown): id is string =>
  typeof id === "string" && /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id);
export function readSharedPosition(value: unknown): SharedPosition | undefined {
  if (!value || typeof value !== "object") return;
  const p = value as SharedPosition;
  if (
    roomIdentity(p.id) &&
    Number.isSafeInteger(p.clock) &&
    p.clock >= 1 &&
    p.clock <= 1000000000 &&
    typeof p.writer === "string" &&
    /^[\w:-]{1,160}$/.test(p.writer) &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.y) &&
    p.x >= 0.015 &&
    p.x <= 0.985 &&
    p.y >= 0.015 &&
    p.y <= 0.985
  )
    return { id: p.id, x: p.x, y: p.y, clock: p.clock, writer: p.writer };
}
export const newerPosition = (
  next: SharedPosition,
  previous?: SharedPosition,
) =>
  !previous ||
  next.clock > previous.clock ||
  (next.clock === previous.clock && next.writer > previous.writer);
