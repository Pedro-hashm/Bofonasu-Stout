import { CallControlButton } from "@revolt/ui/components/features/voice/callCard/CallControlButton";
import { Music2 } from "lucide-solid";
import { Show } from "solid-js";
import { useSoundboard } from "./Soundboard";
import "./soundboard.css";

/** Same entry point in the full call and compact call controls. */
export function SoundboardButton() {
  const b = useSoundboard();
  return (
    <Show when={b}>
      {(board) => (
        <CallControlButton
          label={`Efeitos sonoros${board().newSounds().length ? ` · ${board().newSounds().length} novos` : ""}`}
          pressed={board().open()}
          onClick={() => board().setOpen(true)}
        >
          <span class="sb-control-icon">
            <Music2 />
            <Show when={board().newSounds().length}>
              <i />
            </Show>
          </span>
        </CallControlButton>
      )}
    </Show>
  );
}
