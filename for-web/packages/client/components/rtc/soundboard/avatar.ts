import type { SoundBackend } from "./backend";
import { settings } from "./cache";

export const AVATAR_BUCKET = "soundboard-avatars";
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export type SharedAvatar = {
  id: 1;
  avatar_path: string | null;
  revision: number;
};
export const avatarPath = (path: unknown): path is string =>
  typeof path === "string" &&
  /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\.(png|jpg|webp|gif)$/i.test(
    path,
  );
export function readAvatar(input: unknown): SharedAvatar | undefined {
  if (!input || typeof input !== "object") return;
  const p = input as SharedAvatar;
  if (
    p.id === 1 &&
    (p.avatar_path === null || avatarPath(p.avatar_path)) &&
    Number.isSafeInteger(p.revision) &&
    p.revision >= 0
  )
    return p;
}

/** Validate image bytes, then retain the original GIF so animation is preserved. */
export async function avatarImage(file: File) {
  if (!file.size || file.size > MAX_AVATAR_BYTES)
    throw new Error("Escolha PNG, JPEG, WebP ou GIF de até 5 MB.");
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = new TextDecoder().decode(header);
  const format =
    header[0] === 0x89 && ascii.slice(1, 4) === "PNG"
      ? { extension: "png", mime: "image/png" }
      : header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
        ? { extension: "jpg", mime: "image/jpeg" }
        : /^GIF8[79]a/.test(ascii)
          ? { extension: "gif", mime: "image/gif" }
          : ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP"
            ? { extension: "webp", mime: "image/webp" }
            : undefined;
  if (!format) throw new Error("A imagem precisa ser PNG, JPEG, WebP ou GIF.");
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new Error(
      "Não foi possível abrir esta imagem. Escolha outro arquivo.",
    );
  }
  const pixels = image.width * image.height;
  image.close();
  if (pixels > 16000000)
    throw new Error("Use uma imagem com até 16 megapixels.");
  return format;
}

export type CachedAvatar = { path: string; blob: Blob };
export const cachedAvatarKey = (account: string) => `${account}:shared-avatar`;
export async function loadAvatarFile(
  backend: SoundBackend,
  key: string,
  path: string,
): Promise<Blob> {
  const saved = await settings.getItem<CachedAvatar>(cachedAvatarKey(key));
  if (
    saved?.path === path &&
    saved.blob instanceof Blob &&
    saved.blob.size <= MAX_AVATAR_BYTES &&
    saved.blob.size > 0
  )
    return saved.blob;
  const { data, error } = await backend.storage
    .from(AVATAR_BUCKET)
    .download(path);
  if (error || !data)
    throw new Error(
      "Não foi possível carregar a foto compartilhada. Tente atualizar a biblioteca.",
    );
  if (!data.size || data.size > MAX_AVATAR_BYTES)
    throw new Error("A foto recebida excede 5 MB.");
  await settings.setItem(cachedAvatarKey(key), { path, blob: data });
  return data;
}
