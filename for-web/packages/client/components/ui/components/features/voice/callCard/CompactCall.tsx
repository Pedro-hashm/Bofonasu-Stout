import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
} from "@floating-ui/dom";
import { UserContextMenu } from "@revolt/app";
import { useUser } from "@revolt/markdown/users";
import { useVoice } from "@revolt/rtc";
import { useSpeakingIndicator } from "@revolt/rtc/useSpeakingIndicator";
import { Avatar } from "@revolt/ui/components/design";
import { type Participant, Track } from "livekit-client";
import {
  ChevronUp,
  Ellipsis,
  Maximize2,
  MonitorPlay,
  Radio,
} from "lucide-solid";
import {
  type JSX,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";
import { useIsMuted } from "solid-livekit-components";
import "../speakingIndicator.css";
import "./compactCall.css";
import { VoiceCallCardActions } from "./VoiceCallCardActions";

export const isCompactCallSize = (width: number, height: number) =>
  (width < 520 && height < 360) || height < 230;

/** The small slot is a connection panel; expanding restores the full call view. */
export function CompactCall(props: {
  onExpand: () => void;
  tools: (hide: () => void) => JSX.Element;
}) {
  const voice = useVoice();
  const participants = createMemo(() => [
    ...new Map(
      voice.vidTracks().map((t) => [t.participant.identity, t.participant]),
    ).values(),
  ]);
  const streams = () =>
    voice.vidTracks().filter((t) => t.source === Track.Source.ScreenShare)
      .length;
  return (
    <CompactCallFrame
      channel={voice.channel()?.name ?? "Chamada"}
      status={
        voice.state() === "CONNECTED"
          ? "Voz conectada"
          : voice.state() === "CONNECTING"
            ? "Conectando…"
            : voice.state() === "DISCONNECTED"
              ? "Desconectado"
              : "Reconectando…"
      }
      count={participants().length}
      streams={streams()}
      onExpand={props.onExpand}
      tools={props.tools}
      actions={<VoiceCallCardActions size="compact" />}
    >
      <For each={participants().slice(0, 4)}>
        {(p) => <CompactPeer participant={p} onExpand={props.onExpand} />}
      </For>
    </CompactCallFrame>
  );
}

function CompactPeer(props: {
  participant: Participant;
  onExpand: () => void;
}) {
  const participant = untrack(() => props.participant);
  const user = useUser(participant.identity);
  const speaking = useSpeakingIndicator(participant);
  const muted = useIsMuted({ participant, source: Track.Source.Microphone });
  return (
    <span
      use:floating={{
        contextMenu: () => (
          <UserContextMenu user={user().user!} member={user().member} inVoice />
        ),
      }}
    >
      <CompactCallAvatar
        name={user().username}
        avatar={user().avatar}
        speaking={speaking()}
        muted={muted() ?? false}
        onClick={props.onExpand}
      />
    </span>
  );
}

export function CompactCallAvatar(props: {
  name: string;
  avatar?: string;
  speaking?: boolean;
  muted?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      class="compact-call-avatar voice-speaking-indicator"
      data-speaking={props.speaking}
      aria-label={`${props.name}${props.muted ? " · microfone mutado" : ""}`}
      title={`${props.name}${props.muted ? " · microfone mutado" : ""}`}
      onClick={() => props.onClick()}
    >
      <Avatar
        size={24}
        shape="circle"
        src={props.avatar}
        fallback={props.name}
        interactive={false}
      />
    </button>
  );
}

/** Shared with the local preview so it exercises the production compact layout. */
export function CompactCallFrame(props: {
  channel: string;
  status: string;
  count: number;
  streams: number;
  onExpand: () => void;
  tools: (hide: () => void) => JSX.Element;
  actions: JSX.Element;
  children: JSX.Element;
}) {
  const [anchor, setAnchor] = createSignal<HTMLButtonElement>();
  const [hidden, setHidden] = createSignal(false);
  const id = createUniqueId();
  return (
    <div class="compact-call" aria-label="Chamada compacta">
      <header class="compact-call-header">
        <Radio size={19} class="compact-call-signal" />
        <div>
          <strong>{props.status}</strong>
          <span title={props.channel}>{props.channel}</span>
        </div>
        <button
          type="button"
          class="compact-call-tool"
          title="Expandir chamada"
          aria-label="Expandir chamada"
          onClick={() => props.onExpand()}
        >
          <Maximize2 size={16} />
        </button>
        <button
          type="button"
          class="compact-call-tool"
          title="Opções da chamada"
          aria-label="Opções da chamada"
          aria-haspopup="dialog"
          aria-expanded={!!anchor()}
          aria-controls={anchor() ? id : undefined}
          onClick={(e) => setAnchor(anchor() ? undefined : e.currentTarget)}
        >
          <Ellipsis size={18} />
        </button>
      </header>
      <div class="compact-call-presence">
        <div
          class="compact-call-avatars"
          aria-label={`${props.count} ${props.count === 1 ? "participante" : "participantes"}`}
        >
          {props.children}
          <Show when={props.count > 4}>
            <button
              class="compact-call-count"
              title="Ver todos os participantes"
              aria-label={`Ver os ${props.count} participantes`}
              onClick={() => props.onExpand()}
            >
              +{props.count - 4}
            </button>
          </Show>
        </div>
        <button
          type="button"
          class="compact-call-streams"
          aria-label={
            props.streams
              ? `Ver ${props.streams} ${props.streams === 1 ? "apresentação" : "apresentações"}`
              : "Ver participantes"
          }
          onClick={() => props.onExpand()}
        >
          <Show
            when={props.streams}
            fallback={<span>{props.count} na sala</span>}
          >
            <MonitorPlay size={14} />
            <span>
              {props.streams} {props.streams === 1 ? "ao vivo" : "lives"}
            </span>
          </Show>
        </button>
      </div>
      <div class="compact-call-actions" hidden={hidden()}>
        {props.actions}
      </div>
      <Show when={hidden()}>
        <button
          class="compact-call-restore"
          onClick={() => setHidden(false)}
          aria-label="Mostrar bandeja de controles"
        >
          <ChevronUp size={14} /> Controles
        </button>
      </Show>
      <Show when={anchor()} keyed>
        {(button) => (
          <CompactOptions
            anchor={button}
            id={id}
            onClose={() => setAnchor(undefined)}
          >
            {props.tools(() => setHidden(true))}
          </CompactOptions>
        )}
      </Show>
    </div>
  );
}

function CompactOptions(props: {
  anchor: HTMLButtonElement;
  id: string;
  onClose: () => void;
  children: JSX.Element;
}) {
  let menu!: HTMLDivElement;
  onMount(() => {
    let alive = true;
    const anchor = props.anchor;
    menu.showPopover();
    const stop = autoUpdate(anchor, menu, () => {
      void computePosition(anchor, menu, {
        strategy: "fixed",
        placement: "top-end",
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        if (alive)
          Object.assign(menu.style, {
            left: `${x}px`,
            top: `${y}px`,
            visibility: "visible",
          });
      });
    });
    menu.querySelector<HTMLButtonElement>("button")?.focus();
    onCleanup(() => {
      alive = false;
      stop();
      const restore =
        menu.contains(document.activeElement) ||
        document.activeElement === document.body;
      if (menu.isConnected) menu.hidePopover();
      if (restore && anchor.isConnected) anchor.focus({ preventScroll: true });
    });
  });
  return (
    <div
      ref={menu}
      id={props.id}
      class="compact-call-options"
      popover="auto"
      role="dialog"
      aria-label="Opções da chamada"
      onToggle={(e) => {
        if (e.newState === "closed") props.onClose();
      }}
      onClick={(e) => {
        if ((e.target as Element).closest("button")) props.onClose();
      }}
    >
      {props.children}
    </div>
  );
}
