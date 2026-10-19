import { Music2 } from "lucide-solid";
import { createEffect, createSignal, Show } from "solid-js";
import { useSoundboard } from "./Soundboard";
import "./soundboard.css";

/** Original image bytes preserve GIF animation; failed images retain a usable icon. */
export function SoundboardAvatar(props: { preview?: string }) {
  const board = useSoundboard();
  const url = () => props.preview ?? board?.avatarUrl();
  const [failed, setFailed] = createSignal(false);
  createEffect(() => {
    url();
    setFailed(false);
  });
  return (
    <span class="sb-avatar" aria-hidden="true">
      <Show when={url() && !failed()} fallback={<Music2 size={23} />}>
        <img
          src={url()}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
        />
      </Show>
    </span>
  );
}
