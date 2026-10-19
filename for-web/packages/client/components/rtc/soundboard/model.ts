/** Validated wire data. Never accept arbitrary playback URLs from an event. */
export type SoundEffect = {
  id: string;
  owner_id: string;
  name: string;
  tags: string[];
  storage_path: string;
  sha256: string;
  mime: string;
  bytes: number;
  duration: number;
  created_at: string;
};
export type Playback = {
  channel_id: string;
  version: number;
  enabled: boolean;
  sound_id: string | null;
  started_at: string | null;
  issued_at: string;
  actor_name: string;
  event_id: string;
};
export type SoundPreferences = {
  volume: number;
  muted: boolean;
  spatial: boolean;
  favorites: string[];
  recent: string[];
  seenAt: number;
};
export const defaults = (): SoundPreferences => ({
  volume: 0.65,
  muted: false,
  spatial: true,
  favorites: [],
  recent: [],
  seenAt: 0,
});
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(v);
export function readSound(v: unknown): SoundEffect | undefined {
  if (!v || typeof v !== "object") return;
  const s = v as SoundEffect & { deleted_at?: string };
  if (
    s.deleted_at ||
    !uuid(s.id) ||
    !uuid(s.owner_id) ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    s.name.length > 80 ||
    !Array.isArray(s.tags) ||
    s.tags.length > 8 ||
    !s.tags.every((t) => typeof t === "string" && t.length <= 200) ||
    typeof s.sha256 !== "string" ||
    !/^[a-f\d]{64}$/.test(s.sha256) ||
    typeof s.storage_path !== "string" ||
    !s.storage_path.startsWith(`${s.owner_id}/${s.id}.`) ||
    !/\.(mp3|wav|ogg|webm|m4a|flac)$/.test(s.storage_path) ||
    s.storage_path.split("/").length !== 2 ||
    ![
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/webm",
      "audio/mp4",
      "audio/flac",
    ].includes(s.mime) ||
    !Number.isFinite(s.duration) ||
    s.duration <= 0 ||
    s.duration > 60 ||
    !Number.isInteger(s.bytes) ||
    s.bytes < 1 ||
    s.bytes > 10485760 ||
    !Number.isFinite(Date.parse(s.created_at))
  )
    return;
  return s;
}
export function readPlayback(v: unknown): Playback | undefined {
  if (!v || typeof v !== "object") return;
  const p = v as Playback;
  if (
    typeof p.channel_id !== "string" ||
    !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(p.channel_id) ||
    !Number.isSafeInteger(p.version) ||
    p.version < 0 ||
    typeof p.enabled !== "boolean" ||
    !(p.sound_id === null || uuid(p.sound_id)) ||
    !(
      p.started_at === null ||
      (typeof p.started_at === "string" &&
        Number.isFinite(Date.parse(p.started_at)))
    ) ||
    !Number.isFinite(Date.parse(p.issued_at)) ||
    typeof p.actor_name !== "string" ||
    !uuid(p.event_id)
  )
    return;
  return p;
}
export const searchText = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
export const formatBytes = (n: number) =>
  n < 1048576 ? `${Math.ceil(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;
