import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import { ArrowUpRight, LoaderCircle, Play, X } from "lucide-solid";
import {
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { useSoundboard } from "./Soundboard";
import "./soundboard.css";

/** Native top-layer popover never takes space from the call or gets clipped by the scene. */
export function SoundboardQuickMenu(props: {
  anchor: HTMLButtonElement;
  id: string;
  onClose: () => void;
}) {
  const board = useSoundboard();
  const heading = createUniqueId();
  const [pendingId, setPendingId] = createSignal("");
  let menu!: HTMLDivElement;
  const recent = createMemo(() => {
    const sounds = board?.sounds() ?? [];
    const used = (board?.prefs().recent ?? []).flatMap((id) => {
      const sound = sounds.find((s) => s.id === id);
      return sound ? [sound] : [];
    });
    const newest = [...sounds].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
    );
    return [
      ...new Map(
        [...used, ...newest].map((sound) => [sound.id, sound]),
      ).values(),
    ].slice(0, 4);
  });
  const unavailable = () =>
    !board?.connected() ||
    !board.online() ||
    !board.enabled() ||
    board.commandBusy();
  onMount(() => {
    const anchor = props.anchor;
    let alive = true;
    menu.showPopover();
    const stop = autoUpdate(anchor, menu, () => {
      void computePosition(anchor, menu, {
        strategy: "fixed",
        placement: "right-start",
        middleware: [offset(12), flip(), shift({ padding: 10 })],
      }).then(({ x, y }) => {
        if (alive)
          Object.assign(menu.style, {
            left: `${x}px`,
            top: `${y}px`,
            visibility: "visible",
          });
      });
    });
    (
      menu.querySelector<HTMLButtonElement>(".sb-quick-sound:not(:disabled)") ??
      menu.querySelector<HTMLButtonElement>(".sb-quick-library")
    )?.focus({ preventScroll: true });
    onCleanup(() => {
      alive = false;
      stop();
      const restoreFocus =
        menu.contains(document.activeElement) ||
        document.activeElement === document.body;
      if (menu.isConnected) menu.hidePopover();
      if (restoreFocus && anchor.isConnected)
        anchor.focus({ preventScroll: true });
    });
  });
  return (
    <div
      ref={menu}
      id={props.id}
      class="sb-quick"
      popover="auto"
      role="dialog"
      aria-labelledby={heading}
      onToggle={(event) => {
        if (event.newState === "closed") props.onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          props.onClose();
        }
      }}
    >
      <header>
        <div>
          <strong id={heading}>Recentes</strong>
          <small>Tocar para a chamada</small>
        </div>
        <button
          type="button"
          class="sb-quick-close"
          aria-label="Fechar sons recentes"
          onClick={() => props.onClose()}
        >
          <X size={16} />
        </button>
      </header>
      <div class="sb-quick-list">
        <For
          each={recent()}
          fallback={
            <p class="sb-quick-empty">
              Sua biblioteca ainda não tem efeitos. Adicione pelo painel
              completo.
            </p>
          }
        >
          {(sound) => (
            <button
              type="button"
              class="sb-quick-sound"
              disabled={unavailable()}
              title={sound.name}
              aria-label={`Tocar ${sound.name} para a chamada`}
              data-playing={board?.current()?.id === sound.id}
              onClick={async () => {
                setPendingId(sound.id);
                try {
                  await board?.command("play", sound);
                } finally {
                  setPendingId("");
                }
              }}
            >
              <span class="sb-quick-play">
                <Show
                  when={pendingId() === sound.id}
                  fallback={<Play size={15} fill="currentColor" />}
                >
                  <LoaderCircle size={15} class="sb-spin" />
                </Show>
              </span>
              <span class="sb-quick-name">{sound.name}</span>
              <small>{Math.ceil(sound.duration)}s</small>
            </button>
          )}
        </For>
      </div>
      <Show when={board?.error()}>
        <p class="sb-quick-error" role="alert">
          {board?.error()}
        </p>
      </Show>
      <Show when={!board?.connected() || !board?.online()}>
        <p class="sb-quick-empty">
          Reconecte a biblioteca para tocar para todos.
        </p>
      </Show>
      <button
        type="button"
        class="sb-quick-library"
        onClick={() => {
          props.onClose();
          board?.setOpen(true);
        }}
      >
        Abrir painel completo
        <ArrowUpRight size={16} />
      </button>
    </div>
  );
}
