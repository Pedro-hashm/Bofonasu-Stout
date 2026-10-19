import { useState } from "@revolt/state";
import { GripHorizontal, Move, Pin, PinOff, X } from "lucide-solid";
import {
  type JSX,
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { RoomChatGif } from "./RoomChatGif";
import type { RoomChatFeed } from "./useRoomChat";

export const previewChat = (): RoomChatFeed => ({
  channelName: "geral · prévia",
  messages: [
    {
      id: "sample-1",
      author: "Ana",
      text: "Essa sala ficou muito boa!",
      createdAt: Date.now(),
      shownAt: Date.now(),
    },
    {
      id: "sample-2",
      author: "Luca",
      text: "Vou começar a apresentação 👀",
      createdAt: Date.now(),
      shownAt: Date.now(),
    },
    {
      id: "sample-3",
      author: "Mia",
      text: "Já estou assistindo!",
      createdAt: Date.now(),
      shownAt: Date.now(),
    },
  ],
});

export function RoomChatOverlay(props: {
  feed: RoomChatFeed;
  editing?: boolean;
  scale: number;
  onMove: JSX.EventHandler<HTMLButtonElement, PointerEvent>;
  onResize: JSX.EventHandler<HTMLButtonElement, PointerEvent>;
  onKeyMove: JSX.EventHandler<HTMLButtonElement, KeyboardEvent>;
  onKeyResize: JSX.EventHandler<HTMLButtonElement, KeyboardEvent>;
}) {
  const { livingRoom: room } = useState();
  const config = () => room.scene.chat;
  const [now, setNow] = createSignal(Date.now());
  const [hovered, setHovered] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  const [following, setFollowing] = createSignal(true);
  let body!: HTMLDivElement;
  const followLatest = () => {
    if (!hovered() || following())
      queueMicrotask(() => (body.scrollTop = body.scrollHeight));
  };
  const reveal = () =>
    props.editing || hovered() || focused() || !config().temporary;
  const recent = createMemo(() => props.feed.messages.slice(-config().limit));
  const shown = createMemo(() =>
    recent().filter(
      (m) => reveal() || now() - m.shownAt < config().duration * 1000,
    ),
  );
  onMount(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    onCleanup(() => clearInterval(timer));
  });
  createEffect(() => {
    const ids = shown()
      .map((m) => m.id)
      .join("|");
    if (ids) followLatest();
  });
  return (
    <section
      class="lr-room-chat"
      data-editing={props.editing}
      data-has-messages={shown().length > 0}
      data-visible={config().visible}
      style={{
        left: `${config().x * 100}%`,
        top: `${config().y * 100}%`,
        width: `${config().width * 100}%`,
        height: `${config().height * 100}%`,
        "--lr-chat-opacity": config().opacity,
        "font-size": `${Math.max(10, config().fontSize * Math.max(0.65, props.scale))}px`,
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocusIn={() => setFocused(true)}
      onFocusOut={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setFocused(false);
      }}
      aria-label={`Chat · ${props.feed.channelName}`}
    >
      <header class="lr-chat-header">
        <Show when={props.editing}>
          <button
            type="button"
            class="lr-chat-drag"
            onPointerDown={(e) => props.onMove(e)}
            onKeyDown={(e) => props.onKeyMove(e)}
            aria-label="Mover chat; use as setas para ajustar"
          >
            <Move size={13} />
          </button>
        </Show>
        <span title={props.feed.channelName}>#{props.feed.channelName}</span>
        <button
          type="button"
          title={
            config().temporary
              ? "Manter mensagens visíveis"
              : "Mostrar mensagens momentaneamente"
          }
          aria-label={
            config().temporary
              ? "Manter mensagens visíveis"
              : "Mostrar mensagens momentaneamente"
          }
          aria-pressed={!config().temporary}
          onClick={() => room.chat({ temporary: !config().temporary })}
        >
          <Show when={config().temporary} fallback={<PinOff size={13} />}>
            <Pin size={13} />
          </Show>
        </button>
        <button
          type="button"
          title="Ocultar chat"
          aria-label="Ocultar chat"
          onClick={() => room.chat({ visible: false })}
        >
          <X size={13} />
        </button>
      </header>
      <div
        ref={body}
        class="lr-chat-body"
        onScroll={() =>
          setFollowing(
            body.scrollHeight - body.scrollTop - body.clientHeight < 30,
          )
        }
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Últimas mensagens"
      >
        <Show
          when={config().visible}
          fallback={
            <p class="lr-chat-placeholder">
              Chat oculto · ative no editor ou no botão de chat da sala.
            </p>
          }
        >
          <For each={shown()}>
            {(message) => (
              <article
                class="lr-chat-message"
                style={{
                  opacity: reveal()
                    ? 1
                    : Math.min(
                        1,
                        Math.max(
                          0,
                          (message.shownAt + config().duration * 1000 - now()) /
                            1000,
                        ),
                      ),
                }}
              >
                <strong>{message.author}</strong>
                <time datetime={new Date(message.createdAt).toISOString()}>
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
                <Show
                  when={
                    !message.media?.some(
                      (media) => message.text.trim() === media.link,
                    ) && !(message.media?.length && message.text === "[Anexo]")
                  }
                >
                  <p>{message.text}</p>
                </Show>
                <For each={message.media}>
                  {(media) => (
                    <RoomChatGif media={media} onLoad={followLatest} />
                  )}
                </For>
              </article>
            )}
          </For>
          <Show when={!recent().length && (props.editing || reveal())}>
            <p class="lr-chat-placeholder">
              {props.feed.status || "As próximas mensagens aparecem aqui."}
            </p>
          </Show>
        </Show>
      </div>
      <Show when={props.editing}>
        <button
          type="button"
          class="lr-chat-resize"
          onPointerDown={(e) => props.onResize(e)}
          onKeyDown={(e) => props.onKeyResize(e)}
          aria-label="Redimensionar chat; use as setas para ajustar"
        >
          <GripHorizontal size={15} />
        </button>
      </Show>
    </section>
  );
}
