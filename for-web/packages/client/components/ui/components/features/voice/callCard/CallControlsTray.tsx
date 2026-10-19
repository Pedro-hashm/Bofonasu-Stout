import { ChevronUp } from "lucide-solid";
import { type JSX, createSignal, createUniqueId, Show } from "solid-js";
import "./callControls.css";

/** Collapses only the controls; participant/video trees stay mounted and gain space. */
export function CallControlsTray(props: {
  children: (hide: () => void) => JSX.Element;
}) {
  const [hidden, setHidden] = createSignal(false);
  const id = createUniqueId();
  let content!: HTMLDivElement;
  let restore: HTMLButtonElement | undefined;
  function hide() {
    setHidden(true);
    queueMicrotask(() => restore?.focus({ preventScroll: true }));
  }
  function show() {
    setHidden(false);
    queueMicrotask(() =>
      content
        .querySelector<HTMLButtonElement>("button:not([disabled])")
        ?.focus({ preventScroll: true }),
    );
  }
  return (
    <div class="call-controls-tray" data-hidden={hidden()}>
      <div
        ref={content}
        id={id}
        class="call-controls-tray-body"
        inert={hidden()}
        aria-hidden={hidden()}
      >
        {props.children(hide)}
      </div>
      <Show when={hidden()}>
        <button
          ref={restore}
          type="button"
          class="call-controls-tray-restore"
          title="Mostrar bandeja de controles"
          aria-label="Mostrar bandeja de controles"
          aria-controls={id}
          aria-expanded={false}
          onClick={show}
        >
          <ChevronUp size={16} />
        </button>
      </Show>
    </div>
  );
}
