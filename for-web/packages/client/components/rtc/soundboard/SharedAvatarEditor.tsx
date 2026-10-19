import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import { avatarImage } from "./avatar";
import type { Soundboard } from "./Soundboard";
import { SoundboardAvatar } from "./SoundboardAvatar";

export function SharedAvatarEditor(props: { board: Soundboard }) {
  const [file, setFile] = createSignal<File>();
  const [preview, setPreview] = createSignal<string>();
  const [error, setError] = createSignal("");
  const [validating, setValidating] = createSignal(false);
  let generation = 0;
  onCleanup(() => generation++);
  createEffect(() => {
    const selected = file();
    const url = selected ? URL.createObjectURL(selected) : undefined;
    setPreview(url);
    onCleanup(() => {
      if (url) URL.revokeObjectURL(url);
    });
  });
  async function choose(selected?: File) {
    const ticket = ++generation;
    setError("");
    setFile(undefined);
    setValidating(false);
    if (!selected) return;
    setValidating(true);
    try {
      await avatarImage(selected);
      if (ticket === generation) setFile(selected);
    } catch (e) {
      if (ticket === generation)
        setError(e instanceof Error ? e.message : "Imagem inválida.");
    } finally {
      if (ticket === generation) setValidating(false);
    }
  }
  const disabled = () =>
    props.board.working() ||
    validating() ||
    props.board.status() !== "ready" ||
    !props.board.online();
  return (
    <section
      class="sb-avatar-editor"
      aria-label="Imagem compartilhada dos efeitos"
    >
      <div class="sb-avatar-preview">
        <SoundboardAvatar preview={preview()} />
      </div>
      <div class="sb-avatar-fields">
        <strong>Foto ou GIF · para todos</strong>
        <p>
          Aparece na chamada e no Room. Qualquer membro da biblioteca pode
          alterar.
        </p>
        <div class="sb-avatar-actions">
          <label class="sb-button" aria-disabled={disabled()}>
            Escolher foto ou GIF
            <input
              class="sb-sr"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={disabled()}
              onChange={(e) => {
                void choose(e.currentTarget.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
          </label>
          <Show when={file()}>
            <button
              type="button"
              class="sb-button sb-primary"
              disabled={disabled()}
              onClick={async () => {
                await props.board.setAvatar(file());
                if (!props.board.error()) setFile(undefined);
              }}
            >
              Salvar para todos
            </button>
            <button
              type="button"
              class="sb-link"
              disabled={disabled()}
              onClick={() => setFile(undefined)}
            >
              Cancelar
            </button>
          </Show>
          <Show when={props.board.avatarProfile()?.avatar_path}>
            <button
              type="button"
              class="sb-link"
              disabled={disabled()}
              onClick={() => void props.board.setAvatar()}
            >
              Restaurar ícone
            </button>
          </Show>
        </div>
        <small>
          PNG, JPEG, WebP ou GIF · até 5 MB. GIFs mantêm a animação.
        </small>
        <Show when={error()}>
          <p role="alert">{error()}</p>
        </Show>
      </div>
    </section>
  );
}
