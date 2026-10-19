import localforage from "localforage";
import { type RoomScene, cleanScene } from "./model";

const assets = localforage.createInstance({
  name: "stoat-living-room",
  storeName: "images",
  driver: localforage.INDEXEDDB,
});
const MAX_IMAGE = 12 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export async function storeImage(
  blob: Blob,
): Promise<{ id: string; aspect: number }> {
  if (!IMAGE_TYPES.includes(blob.type) || blob.size > MAX_IMAGE || !blob.size)
    throw new Error("Escolha uma imagem PNG, JPEG ou WebP de até 12 MB.");
  const image = await createImageBitmap(blob);
  const aspect = image.width / image.height;
  const tooLarge = image.width * image.height > 40_000_000;
  image.close();
  if (tooLarge) throw new Error("A imagem deve ter até 40 megapixels.");
  const id = crypto.randomUUID();
  await assets.setItem(id, blob);
  return { id, aspect };
}
export const readImage = (id: string) => assets.getItem<Blob>(id);
function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(blob);
  });
}
/** Portable JSON package embeds the binary asset only during export. */
export async function exportRoom(scene: RoomScene, name: string) {
  const image =
    scene.background.kind === "image" && scene.background.assetId
      ? await readImage(scene.background.assetId)
      : undefined;
  if (scene.background.kind === "image" && !image)
    throw new Error(
      "A imagem desta sala não foi encontrada. Selecione-a novamente antes de exportar.",
    );
  const portable = cleanScene(scene);
  if (portable.background.kind !== "image")
    portable.background.assetId = undefined;
  portable.assignments = {}; // Seats are portable; local account/channel assignments are not.
  const blob = new Blob(
    [
      JSON.stringify({
        format: "stoat-living-room",
        version: 1,
        name,
        scene: portable,
        image: image ? await dataUrl(image) : undefined,
      }),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 60) || "sala"}.stoat-room.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function importRoom(
  file: File,
): Promise<{ scene: RoomScene; name: string }> {
  if (file.size > 18 * 1024 * 1024)
    throw new Error("O pacote deve ter até 18 MB.");
  const value = JSON.parse(await file.text());
  if (
    value?.format !== "stoat-living-room" ||
    value.version !== 1 ||
    !value.scene ||
    typeof value.scene !== "object"
  )
    throw new Error("Este arquivo não é um preset Living Room compatível.");
  const scene = cleanScene(value.scene);
  scene.assignments = {};
  if (scene.background.kind === "image") {
    if (
      typeof value.image !== "string" ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.image)
    )
      throw new Error("O pacote não contém uma imagem válida.");
    const [header, encoded] = value.image.split(",");
    const binary = atob(encoded),
      bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const saved = await storeImage(
      new Blob([bytes], { type: header.slice(5, header.indexOf(";")) }),
    );
    scene.background.assetId = saved.id;
  } else scene.background.assetId = undefined;
  return {
    scene,
    name:
      typeof value.name === "string"
        ? value.name.slice(0, 80)
        : "Sala importada",
  };
}
