import localforage from "localforage";
import { type SoundBackend, projectURL } from "./backend";
import type { SoundEffect } from "./model";

const files = localforage.createInstance({
  name: "bofonasu-soundboard",
  storeName: "files",
  driver: localforage.INDEXEDDB,
});
export const settings = localforage.createInstance({
  name: "bofonasu-soundboard",
  storeName: "settings",
  driver: localforage.INDEXEDDB,
});
export const accountKey = (account: string) =>
  `${new URL(projectURL).hostname}:${account}`;
const key = (account: string, sound: SoundEffect) =>
  `${accountKey(account)}:${sound.id}:${sound.sha256}`;
export async function digest(blob: Blob) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
/** Deduplicate concurrent downloads, verify the bytes and retain originals in IndexedDB. */
export function createSoundCache(
  account: string,
  backend: SoundBackend,
  changed: () => void,
) {
  const inflight = new Map<string, Promise<Blob>>();
  return {
    async available(sounds: SoundEffect[]) {
      const keys = new Set(await files.keys());
      return sounds.filter((s) => keys.has(key(account, s))).map((s) => s.id);
    },
    async get(sound: SoundEffect, offline = false): Promise<Blob> {
      const id = key(account, sound);
      const stored = await files.getItem<Blob>(id);
      if (stored && stored.size === sound.bytes) return stored;
      if (offline)
        throw new Error("Baixe este efeito antes de ouvir sem conexão.");
      const existing = inflight.get(id);
      if (existing) return existing;
      const request = (async () => {
        const { data, error } = await backend.storage
          .from("soundboard")
          .download(sound.storage_path);
        if (error || !data)
          throw new Error(
            "Não foi possível baixar este efeito. Tente novamente.",
          );
        if (data.size !== sound.bytes || (await digest(data)) !== sound.sha256)
          throw new Error(
            "O arquivo recebido está incompleto ou mudou. Atualize a biblioteca.",
          );
        try {
          await files.setItem(id, data);
          changed();
        } catch {
          throw new Error(
            "Sem espaço para salvar o efeito. Libere espaço no dispositivo.",
          );
        }
        return data;
      })();
      inflight.set(id, request);
      try {
        return await request;
      } finally {
        inflight.delete(id);
      }
    },
    async put(sound: SoundEffect, file: Blob) {
      await files.setItem(key(account, sound), file);
      changed();
    },
    async clear() {
      for (const id of await files.keys())
        if (id.startsWith(`${accountKey(account)}:`))
          await files.removeItem(id);
      changed();
    },
    async prune(sounds: SoundEffect[]) {
      const keep = new Set(sounds.map((s) => key(account, s)));
      for (const id of await files.keys())
        if (id.startsWith(`${accountKey(account)}:`) && !keep.has(id))
          await files.removeItem(id);
    },
  };
}
