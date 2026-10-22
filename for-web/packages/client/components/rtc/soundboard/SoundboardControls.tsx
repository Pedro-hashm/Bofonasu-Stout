import { Music2 } from "lucide-solid";
import { createSignal, createUniqueId, Show } from "solid-js";
import { useSoundboard } from "./Soundboard";
import { SoundboardQuickMenu } from "./SoundboardQuickMenu";
import "./soundboard.css";

/** Same entry point in the full call and compact call controls. */
export function SoundboardButton() {
  const b = useSoundboard();
  const [anchor, setAnchor] = createSignal<HTMLButtonElement>();
  const id = createUniqueId();
  return (
    <Show when={b}>
      {(board) => (
        <>
          <button
            type="button"
            class="call-control"
            aria-label={`Efeitos sonoros${board().newSounds().length ? ` · ${board().newSounds().length} novos` : ""}`}
            title="Sons recentes"
            aria-haspopup="dialog"
            aria-expanded={!!anchor()}
            aria-controls={anchor() ? id : undefined}
            onClick={(event) =>
              setAnchor(anchor() ? undefined : event.currentTarget)
            }
          >
            <span class="sb-control-icon">
              <Music2 />
              <Show when={board().newSounds().length}>
                <i />
              </Show>
            </span>
          </button>
          <Show when={anchor()} keyed>
            {(button) => (
              <SoundboardQuickMenu
                anchor={button}
                id={id}
                onClose={() => setAnchor(undefined)}
              />
            )}
          </Show>
        </>
      )}
    </Show>
  );
}
