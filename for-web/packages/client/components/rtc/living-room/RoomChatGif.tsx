import { createSignal, Match, Show, Switch } from "solid-js";
import type { RoomChatMedia } from "./roomChatMedia";

/** GIF providers also deliver silent looping videos; never play their audio. */
export function RoomChatGif(props: {
  media: RoomChatMedia;
  onLoad: () => void;
}) {
  const [failed, setFailed] = createSignal(false);
  return (
    <a
      class="lr-chat-gif"
      href={props.media.link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Abrir ${props.media.label}`}
    >
      <Show
        when={!failed()}
        fallback={<span>GIF indisponível · abrir link</span>}
      >
        <Switch>
          <Match when={props.media.kind === "video"}>
            <video
              src={props.media.src}
              poster={props.media.poster}
              autoplay
              muted
              loop
              playsinline
              preload="metadata"
              onLoadedData={() => props.onLoad()}
              onError={() => {
                setFailed(true);
                props.onLoad();
              }}
            />
          </Match>
          <Match when={props.media.kind === "image"}>
            <img
              src={props.media.src}
              alt={props.media.label}
              onLoad={() => props.onLoad()}
              onError={() => {
                setFailed(true);
                props.onLoad();
              }}
            />
          </Match>
        </Switch>
      </Show>
    </a>
  );
}
