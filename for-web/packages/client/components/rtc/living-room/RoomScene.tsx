import type { TrackReference } from "@livekit/components-core";
import { UserContextMenu } from "@revolt/app";
import { useUser } from "@revolt/markdown/users";
import { useSpeakingIndicator } from "@revolt/rtc/useSpeakingIndicator";
import { useState } from "@revolt/state";
import { Avatar } from "@revolt/ui/components/design";
import "@revolt/ui/components/features/voice/speakingIndicator.css";
import { animateEntrance } from "@revolt/ui/lib/motion";
import { Key } from "@solid-primitives/keyed";
import { type Participant, ParticipantEvent } from "livekit-client";
import {
  Armchair,
  Link2,
  Maximize2,
  MicOff,
  Monitor,
  Move,
  Video,
  Volume2,
} from "lucide-solid";
import {
  type JSX,
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";
import { Portal } from "solid-js/web";
import { useSoundboard } from "../soundboard/Soundboard";
import { SoundboardAvatar } from "../soundboard/SoundboardAvatar";
import { SoundboardQuickMenu } from "../soundboard/SoundboardQuickMenu";
import { readImage } from "./assets";
import "./livingRoom.css";
import { type Corners, clamp, screenMatrix, validCorners } from "./model";
import { RoomChatOverlay } from "./RoomChatOverlay";
import { RoomVideo } from "./RoomVideo";
import { roomIdentity } from "./syncModel";
import type { RoomChatFeed } from "./useRoomChat";

export type RoomGuest = {
  id: string;
  name: string;
  self?: boolean;
  participant?: Participant;
};
export type RoomStream = {
  id: string;
  owner: string;
  label: string;
  reference?: TrackReference;
  camera?: boolean;
};
export const PREVIEW_GUESTS: RoomGuest[] = [
  { id: "preview-ana", name: "Ana" },
  { id: "preview-luca", name: "Luca" },
  { id: "preview-mia", name: "Mia" },
  { id: "preview-noah", name: "Noah" },
  { id: "preview-self", name: "Você", self: true },
];

export function RoomSceneView(props: {
  guests: RoomGuest[];
  streams: RoomStream[];
  channel: string;
  editing?: boolean;
  chat: RoomChatFeed;
}) {
  const { livingRoom: room } = useState();
  const soundboard = useSoundboard();
  const [soundMenuAnchor, setSoundMenuAnchor] =
    createSignal<HTMLButtonElement>();
  const soundMenuId = createUniqueId();
  createEffect(() => {
    if (props.editing || !soundboard?.enabled()) setSoundMenuAnchor(undefined);
  });
  let container!: HTMLDivElement;
  let stage!: HTMLDivElement;
  let roomScreen!: HTMLDivElement;
  let screenHost!: HTMLDivElement;
  let presentation: HTMLDivElement | undefined;
  let presentationButton: HTMLButtonElement | undefined;
  let presentationWasFullscreen = false;
  const [bounds, setBounds] = createSignal({ width: 0, height: 0 });
  const [backgroundUrl, setBackgroundUrl] = createSignal<string>();
  const [imageError, setImageError] = createSignal("");
  const [selected, setSelected] = createSignal("");
  const [expanded, setExpanded] = createSignal(false);
  const [fullscreenError, setFullscreenError] = createSignal("");
  const [dragging, setDragging] = createSignal(false);
  const [time, setTime] = createSignal(new Date());
  const scene = () => room.scene;
  function openPresentation() {
    setExpanded(true);
    setFullscreenError("");
    // Run within the click's activation, after the portal has mounted.
    queueMicrotask(() => {
      const element = presentation;
      if (!element?.isConnected || !untrack(expanded)) return;
      element
        .querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true });
      if (!element.requestFullscreen) {
        setFullscreenError(
          "Este navegador não oferece tela cheia para apresentações.",
        );
        return;
      }
      void element.requestFullscreen({ navigationUI: "hide" }).catch(() => {
        if (untrack(expanded))
          setFullscreenError(
            "A tela cheia foi bloqueada. Clique em Tentar novamente para liberar.",
          );
      });
    });
  }
  function closePresentation() {
    if (document.fullscreenElement === presentation) {
      void document
        .exitFullscreen()
        .catch(() => {})
        .finally(returnToRoom);
    } else returnToRoom();
  }
  function returnToRoom() {
    setExpanded(false);
    queueMicrotask(() => presentationButton?.focus({ preventScroll: true }));
  }
  const size = createMemo(() => {
    const b = bounds(),
      width = Math.max(1, Math.min(b.width, b.height * scene().aspect));
    return { width, height: width / scene().aspect };
  });
  const baseScreen = () => ({
    width: Math.max(1, size().width * 0.68),
    height: Math.max(1, (size().width * 0.68) / scene().screen.aspect),
  });
  const screenTransform = () =>
    screenMatrix(
      scene().screen.corners,
      size().width,
      size().height,
      baseScreen().width,
      baseScreen().height,
    );
  const streams = createMemo(() =>
    props.streams.filter((s) => !s.camera || scene().screen.cameras),
  );
  const current = createMemo(
    () =>
      streams().find((s) => s.id === selected()) ??
      streams().find((s) => !s.camera) ??
      streams()[0],
  );
  const visible = createMemo(() => {
    const all = streams(),
      active = current();
    if (!active) return [];
    if (scene().screen.mode === "single") return [active];
    if (scene().screen.mode === "focus")
      return [active, ...all.filter((s) => s.id !== active.id)];
    return all;
  });
  createEffect(() => {
    if (props.guests.some((g) => g.participant))
      room.watch(props.channel, [
        ...new Set(
          visible()
            .filter((s) => !s.camera)
            .map((s) => s.owner),
        ),
      ]);
  });
  createEffect(() =>
    room.assign(
      props.channel,
      props.guests.filter((g) => !g.self).map((g) => g.id),
    ),
  );
  createEffect(() => {
    const id =
      scene().background.kind === "image"
        ? scene().background.assetId
        : undefined;
    let stale = false,
      url: string | undefined;
    setBackgroundUrl(undefined);
    setImageError("");
    if (id)
      void readImage(id)
        .then((blob) => {
          if (stale) return;
          if (!blob) {
            setImageError(
              "Imagem não encontrada. Selecione o fundo novamente no editor.",
            );
            return;
          }
          url = URL.createObjectURL(blob);
          setBackgroundUrl(url);
        })
        .catch(() => {
          if (!stale) setImageError("Não foi possível abrir a imagem local.");
        });
    else if (scene().background.kind === "image")
      setImageError("Selecione uma imagem no editor.");
    onCleanup(() => {
      stale = true;
      if (url) URL.revokeObjectURL(url);
    });
  });
  onMount(() => {
    const observer = new ResizeObserver(([entry]) =>
      setBounds({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(container);
    // Keep the same media elements and subscriptions when expanding. Creating
    // another player here used to unsubscribe/re-subscribe and recreate tracks.
    createEffect(() => {
      const flat = expanded();
      const target = flat ? presentation : roomScreen;
      if (!target || !screenHost) return;
      target.appendChild(screenHost);
      queueMicrotask(() => {
        if (!screenHost.isConnected || untrack(expanded) !== flat) return;
        for (const video of screenHost.querySelectorAll("video"))
          void video.play().catch(() => {});
      });
    });
    const timer = setInterval(() => setTime(new Date()), 30_000);
    const escape = (e: KeyboardEvent) => {
      if (!expanded()) return;
      if (e.key === "Escape") closePresentation();
      if (e.key === "Tab" && presentation) {
        const controls = presentation.querySelectorAll<HTMLElement>(
          "button:not([disabled]), select, a[href], [tabindex='0']",
        );
        const first = controls[0],
          last = controls[controls.length - 1],
          active = document.activeElement;
        if (
          first &&
          (!presentation.contains(active) ||
            (e.shiftKey ? active === first : active === last))
        ) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }
    };
    const fullscreenChanged = () => {
      const active =
        !!presentation && document.fullscreenElement === presentation;
      if (active) {
        presentationWasFullscreen = true;
        setFullscreenError("");
      } else if (presentationWasFullscreen) {
        presentationWasFullscreen = false;
        returnToRoom();
      }
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("fullscreenchange", fullscreenChanged);
    onCleanup(() => {
      observer.disconnect();
      clearInterval(timer);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("fullscreenchange", fullscreenChanged);
      if (presentation && document.fullscreenElement === presentation)
        void document.exitFullscreen().catch(() => {});
    });
  });
  let stopDrag: (() => void) | undefined;
  createEffect(() => {
    const channel = props.channel;
    if (!roomIdentity(channel)) return; // Settings previews do not announce live presence.
    let leave: (() => void) | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (
        entry.isIntersecting &&
        entry.intersectionRect.width > 0 &&
        entry.intersectionRect.height > 0
      ) {
        leave ??= room.enterView(channel);
      } else {
        leave?.();
        leave = undefined;
      }
    });
    observer.observe(container);
    onCleanup(() => {
      observer.disconnect();
      leave?.();
    });
  });
  onCleanup(() => stopDrag?.());
  function drag(event: PointerEvent, update: (dx: number, dy: number) => void) {
    if (!props.editing || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stopDrag?.();
    const target = event.currentTarget as HTMLElement;
    const pointerId = event.pointerId;
    target.setPointerCapture(pointerId);
    const startX = event.clientX,
      startY = event.clientY,
      rect = stage.getBoundingClientRect();
    let frame = 0;
    let latestX = startX,
      latestY = startY;
    const flush = () => {
      frame = 0;
      update((latestX - startX) / rect.width, (latestY - startY) / rect.height);
    };
    setDragging(true);
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      latestX = e.clientX;
      latestY = e.clientY;
      // Consume the newest position once per display frame, even at high polling rates.
      if (!frame) frame = requestAnimationFrame(flush);
    };
    const stop = (e?: PointerEvent) => {
      if (e && e.pointerId !== pointerId) return;
      if (
        e?.type === "pointerup" &&
        (e.clientX !== latestX || e.clientY !== latestY)
      ) {
        latestX = e.clientX;
        latestY = e.clientY;
        if (!frame) frame = requestAnimationFrame(flush);
      }
      if (frame) {
        cancelAnimationFrame(frame);
        flush();
      }
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", stop);
      target.removeEventListener("pointercancel", stop);
      target.removeEventListener("lostpointercapture", stop);
      if (target.hasPointerCapture(pointerId))
        target.releasePointerCapture(pointerId);
      setDragging(false);
      stopDrag = undefined;
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", stop);
    target.addEventListener("pointercancel", stop);
    target.addEventListener("lostpointercapture", stop);
    stopDrag = stop;
  }
  function moveGuest(event: PointerEvent, guest: RoomGuest) {
    const channel = props.channel;
    // Store points are mutable proxies. Snapshot coordinates before any drag writes.
    const start = { ...room.point(channel, guest.id, guest.self) };
    drag(event, (dx, dy) =>
      room.move(
        channel,
        guest.id,
        {
          x: clamp(start.x + dx, 0.045, 0.955),
          y: clamp(start.y + dy, 0.06, 0.94),
        },
        guest.self,
      ),
    );
  }
  function cornerDrag(event: PointerEvent, index: number) {
    const start = scene().screen.corners.map((p) => ({ ...p })) as Corners;
    drag(event, (dx, dy) => {
      const points = start.map((p, i) =>
        i === index
          ? {
              x: clamp(p.x + dx, 0.015, 0.985),
              y: clamp(p.y + dy, 0.015, 0.985),
            }
          : { ...p },
      );
      if (validCorners(points)) room.positionScreen(points);
    });
  }
  function screenDrag(event: PointerEvent) {
    const start = scene().screen.corners.map((p) => ({ ...p }));
    drag(event, (dx, dy) => {
      const x = clamp(
        dx,
        0.015 - Math.min(...start.map((p) => p.x)),
        0.985 - Math.max(...start.map((p) => p.x)),
      );
      const y = clamp(
        dy,
        0.015 - Math.min(...start.map((p) => p.y)),
        0.985 - Math.max(...start.map((p) => p.y)),
      );
      room.positionScreen(
        start.map((p) => ({ x: p.x + x, y: p.y + y })) as Corners,
      );
    });
  }
  function chatDrag(event: PointerEvent, resize = false) {
    const start = { ...scene().chat };
    drag(event, (dx, dy) =>
      room.positionChat(
        resize
          ? {
              ...start,
              width: clamp(start.width + dx, 0.15, 0.985 - start.x),
              height: clamp(start.height + dy, 0.15, 0.985 - start.y),
            }
          : { ...start, x: start.x + dx, y: start.y + dy },
      ),
    );
  }
  function keyboardMove(
    e: KeyboardEvent,
    apply: (dx: number, dy: number) => void,
  ) {
    if (
      !props.editing ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
    )
      return;
    e.preventDefault();
    const step = e.shiftKey ? 0.025 : 0.005;
    apply(
      e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
      e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0,
    );
  }
  function screenContents(): JSX.Element {
    return (
      <>
        <Show
          when={visible().length}
          fallback={
            <div class="lr-screen-idle">
              <Show
                when={scene().screen.idle === "clock"}
                fallback={
                  <>
                    <Monitor size={36} />
                    <strong>LIVING ROOM</strong>
                    <span>A próxima apresentação aparece aqui</span>
                  </>
                }
              >
                <strong class="lr-clock">
                  {time().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
              </Show>
            </div>
          }
        >
          <div
            class="lr-screen-grid"
            data-mode={scene().screen.mode}
            style={{
              "grid-template-columns":
                scene().screen.mode === "focus"
                  ? undefined
                  : `repeat(${scene().screen.mode === "single" ? 1 : scene().screen.columns || Math.ceil(Math.sqrt(visible().length))}, minmax(0,1fr))`,
              gap: `${scene().screen.gap * (expanded() ? 1 : size().width / 1000)}px`,
              "grid-template-rows":
                scene().screen.mode === "focus"
                  ? `repeat(${Math.max(1, visible().length - 1)}, minmax(0,1fr))`
                  : undefined,
            }}
          >
            <Key each={visible()} by="id">
              {(stream, i) => (
                <div class="lr-stream" data-main={i() === 0}>
                  <Show
                    when={stream().reference}
                    fallback={
                      <div class="lr-stream-placeholder">
                        <Video />
                        <span>{stream().label}</span>
                      </div>
                    }
                  >
                    {(ref) => (
                      <RoomVideo
                        reference={ref()}
                        fit={expanded() ? "contain" : scene().screen.fit}
                      />
                    )}
                  </Show>
                  <StreamLabel
                    stream={stream()}
                    onPin={() => setSelected(stream().id)}
                  />
                </div>
              )}
            </Key>
          </div>
        </Show>
      </>
    );
  }
  return (
    <div
      class="lr-scene-container"
      ref={container}
      data-editing={props.editing}
      data-dragging={dragging()}
    >
      <div
        ref={stage}
        class="lr-scene"
        style={{
          width: `${size().width}px`,
          height: `${size().height}px`,
          background: scene().background.color,
          "--lr-accent": scene().accent,
        }}
      >
        <Show when={scene().background.kind === "studio"}>
          <DefaultRoom />
        </Show>
        <Show when={backgroundUrl()}>
          {(url) => (
            <img class="lr-background" src={url()} alt="" draggable={false} />
          )}
        </Show>
        <Show when={imageError()}>
          <span class="lr-image-error" role="status">
            {imageError()}
          </span>
        </Show>
        <div
          class="lr-screen"
          ref={roomScreen}
          data-layer={scene().screen.layer}
          data-idle={!visible().length && scene().screen.idle === "transparent"}
          style={{
            width: `${baseScreen().width}px`,
            height: `${baseScreen().height}px`,
            transform: screenTransform(),
            "border-radius": `${(scene().screen.radius * size().width) / 1000}px`,
            border: `${(scene().screen.border * size().width) / 1000}px solid ${scene().screen.color}`,
            "box-shadow": `0 12px 30px rgba(0,0,0,${scene().screen.shadow}), 0 0 ${scene().screen.glow * 55}px ${scene().screen.color}`,
          }}
        >
          <div class="lr-screen-content" ref={screenHost}>
            {screenContents()}
          </div>
        </div>
        <Key each={props.guests} by="id">
          {(guest) => {
            const position = () =>
              room.point(props.channel, guest().id, guest().self);
            return (
              <div
                class="lr-person"
                data-self={guest().self}
                data-names={scene().names}
                style={{
                  left: `${position().x * 100}%`,
                  top: `${position().y * 100}%`,
                  "--lr-avatar-size": `${Math.max(22, (scene().avatarSize * size().width) / 1000)}px`,
                }}
              >
                <Show when={guest().participant ?? guest().id} keyed>
                  {(_participant) => (
                    <RoomAvatar
                      guest={guest()}
                      channel={props.channel}
                      editing={props.editing}
                      onPointerDown={(e) => moveGuest(e, guest())}
                      onKeyDown={(e) => {
                        const channel = props.channel,
                          person = guest(),
                          start = position();
                        keyboardMove(e, (dx, dy) =>
                          room.move(
                            channel,
                            person.id,
                            {
                              x: clamp(start.x + dx, 0.045, 0.955),
                              y: clamp(start.y + dy, 0.06, 0.94),
                            },
                            person.self,
                          ),
                        );
                      }}
                    />
                  )}
                </Show>
              </div>
            );
          }}
        </Key>
        <Show when={props.editing || soundboard?.enabled()}>
          <div
            class="lr-room-speaker"
            data-playing={!!soundboard?.current()}
            style={{
              left: `${scene().speaker.x * 100}%`,
              top: `${scene().speaker.y * 100}%`,
            }}
          >
            <button
              type="button"
              title={
                props.editing
                  ? "Arraste para posicionar o perfil dos efeitos"
                  : "Sons recentes"
              }
              aria-label={
                props.editing
                  ? "Mover perfil dos efeitos; use as setas para ajustar"
                  : "Abrir sons recentes"
              }
              aria-haspopup="dialog"
              aria-expanded={!!soundMenuAnchor()}
              aria-controls={soundMenuAnchor() ? soundMenuId : undefined}
              onClick={(e) => {
                if (!props.editing)
                  setSoundMenuAnchor((anchor) =>
                    anchor ? undefined : e.currentTarget,
                  );
              }}
              onPointerDown={(e) => {
                const start = { ...scene().speaker };
                drag(e, (dx, dy) =>
                  room.positionSpeaker({ x: start.x + dx, y: start.y + dy }),
                );
              }}
              onKeyDown={(e) =>
                keyboardMove(e, (dx, dy) =>
                  room.positionSpeaker({
                    x: scene().speaker.x + dx,
                    y: scene().speaker.y + dy,
                  }),
                )
              }
            >
              <SoundboardAvatar />
            </button>
          </div>
        </Show>
        <Show when={soundMenuAnchor()} keyed>
          {(anchor) => (
            <SoundboardQuickMenu
              anchor={anchor}
              id={soundMenuId}
              onClose={() => setSoundMenuAnchor(undefined)}
            />
          )}
        </Show>
        <Show when={scene().chat.visible || props.editing}>
          <RoomChatOverlay
            feed={props.chat}
            editing={props.editing}
            scale={size().width / 1000}
            onMove={(e) => chatDrag(e)}
            onResize={(e) => chatDrag(e, true)}
            onKeyMove={(e) =>
              keyboardMove(e, (dx, dy) =>
                room.positionChat({
                  ...scene().chat,
                  x: scene().chat.x + dx,
                  y: scene().chat.y + dy,
                }),
              )
            }
            onKeyResize={(e) =>
              keyboardMove(e, (dx, dy) =>
                room.positionChat({
                  ...scene().chat,
                  width: Math.min(
                    0.985 - scene().chat.x,
                    scene().chat.width + dx,
                  ),
                  height: Math.min(
                    0.985 - scene().chat.y,
                    scene().chat.height + dy,
                  ),
                }),
              )
            }
          />
        </Show>
        <Show when={props.editing}>
          <svg
            class="lr-screen-outline"
            viewBox="0 0 1 1"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon
              points={scene()
                .screen.corners.map((p) => `${p.x},${p.y}`)
                .join(" ")}
            />
          </svg>
          <For each={[0, 1, 2, 3]}>
            {(index) => (
              <button
                type="button"
                class="lr-corner"
                aria-label={`Canto ${index + 1} da tela; use as setas para ajustar`}
                title={`Canto ${index + 1}`}
                style={{
                  left: `${scene().screen.corners[index].x * 100}%`,
                  top: `${scene().screen.corners[index].y * 100}%`,
                }}
                onPointerDown={(e) => cornerDrag(e, index)}
                onKeyDown={(e) =>
                  keyboardMove(e, (dx, dy) => {
                    const points = scene().screen.corners.map((q, i) =>
                      i === index
                        ? {
                            x: clamp(q.x + dx, 0.015, 0.985),
                            y: clamp(q.y + dy, 0.015, 0.985),
                          }
                        : { ...q },
                    );
                    if (validCorners(points)) room.screen({ corners: points });
                  })
                }
              >
                {index + 1}
              </button>
            )}
          </For>
          <button
            class="lr-move-screen"
            type="button"
            aria-label="Mover toda a tela"
            title="Arraste para mover toda a tela"
            style={{
              left: `${scene().screen.corners.reduce((n, p) => n + p.x, 0) * 25}%`,
              top: `${scene().screen.corners.reduce((n, p) => n + p.y, 0) * 25}%`,
            }}
            onPointerDown={screenDrag}
            onKeyDown={(e) =>
              keyboardMove(e, (dx, dy) => {
                const corners = scene().screen.corners.map((p) => ({
                  x: p.x + dx,
                  y: p.y + dy,
                }));
                if (
                  corners.every(
                    (p) =>
                      p.x >= 0.015 &&
                      p.x <= 0.985 &&
                      p.y >= 0.015 &&
                      p.y <= 0.985,
                  ) &&
                  validCorners(corners)
                )
                  room.screen({ corners });
              })
            }
          >
            <Move size={18} /> Tela
          </button>
        </Show>
      </div>
      <Show when={streams().length && !props.editing}>
        <div class="lr-watch-controls">
          <label>
            <span class="lr-sr">Transmissão principal</span>
            <select
              aria-label="Transmissão principal"
              value={current()?.id}
              onChange={(e) => setSelected(e.currentTarget.value)}
            >
              <For each={streams()}>
                {(s) => <option value={s.id}>{s.label}</option>}
              </For>
            </select>
          </label>
          <button
            type="button"
            ref={presentationButton}
            onClick={openPresentation}
            title="Tela cheia da apresentação"
            aria-label="Tela cheia da apresentação"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </Show>
      <Portal mount={document.getElementById("floating") ?? document.body}>
        <div
          ref={presentation}
          class="lr-flat-screen"
          hidden={!expanded()}
          role="dialog"
          aria-modal="true"
          aria-label="Apresentação em tela cheia"
        >
          <div class="lr-flat-toolbar">
            <button
              type="button"
              class="lr-flat-close"
              onClick={closePresentation}
            >
              Voltar à sala · Esc
            </button>
            <Show when={streams().length > 1}>
              <select
                aria-label="Transmissão principal em tela cheia"
                value={current()?.id}
                onChange={(e) => setSelected(e.currentTarget.value)}
              >
                <For each={streams()}>
                  {(s) => <option value={s.id}>{s.label}</option>}
                </For>
              </select>
            </Show>
            <Show when={fullscreenError()}>
              <span role="alert">{fullscreenError()}</span>
              <button type="button" onClick={openPresentation}>
                Tentar novamente
              </button>
            </Show>
          </div>
        </div>
      </Portal>
    </div>
  );
}

function RoomAvatar(props: {
  guest: RoomGuest;
  channel: string;
  editing?: boolean;
  onPointerDown: JSX.EventHandler<HTMLElement, PointerEvent>;
  onKeyDown: JSX.EventHandler<HTMLElement, KeyboardEvent>;
}) {
  const state = useState();
  // The enclosing Key gives these hooks a stable participant lifetime.
  const participant = untrack(() => props.guest.participant);
  const identity = untrack(() => props.guest.id);
  const info = participant ? useUser(identity) : undefined;
  const speaking = participant
    ? useSpeakingIndicator(participant)
    : () => false;
  const [muted, setMuted] = createSignal(
    participant ? !participant.isMicrophoneEnabled : false,
  );
  const name = () => info?.().username ?? props.guest.name;
  const presence = () =>
    state.livingRoom.syncState.channel === props.channel
      ? state.livingRoom.syncState.peers[props.guest.id]
      : undefined;
  const presenceLabel = () =>
    presence()?.viewing
      ? presence()?.synchronized
        ? "Living Room · sincronizado"
        : "Living Room · local"
      : "";
  onMount(() => {
    if (!participant) return;
    const refresh = () => setMuted(!participant.isMicrophoneEnabled);
    participant.on(ParticipantEvent.TrackMuted, refresh);
    participant.on(ParticipantEvent.TrackUnmuted, refresh);
    participant.on(ParticipantEvent.TrackPublished, refresh);
    participant.on(ParticipantEvent.TrackUnpublished, refresh);
    participant.on(ParticipantEvent.LocalTrackPublished, refresh);
    participant.on(ParticipantEvent.LocalTrackUnpublished, refresh);
    onCleanup(() => {
      participant.off(ParticipantEvent.TrackMuted, refresh);
      participant.off(ParticipantEvent.TrackUnmuted, refresh);
      participant.off(ParticipantEvent.TrackPublished, refresh);
      participant.off(ParticipantEvent.TrackUnpublished, refresh);
      participant.off(ParticipantEvent.LocalTrackPublished, refresh);
      participant.off(ParticipantEvent.LocalTrackUnpublished, refresh);
    });
  });
  return (
    <div
      class="lr-avatar-wrap"
      ref={(el) =>
        animateEntrance(el, state.theme.activeTheme.motion === "full")
      }
    >
      <div
        role="button"
        tabindex="0"
        class="lr-avatar voice-speaking-indicator"
        data-speaking={speaking()}
        title={`${name()}${presenceLabel() ? ` · ${presenceLabel()}` : ""}${props.guest.self ? " · Sua posição de escuta" : ""}${props.editing ? " · Arraste ou use as setas" : ""}`}
        aria-label={`${name()}${presenceLabel() ? `, ${presenceLabel()}` : ""}${props.guest.self ? ", sua posição de escuta" : ""}`}
        onPointerDown={(e) => props.onPointerDown(e)}
        onKeyDown={(e) => props.onKeyDown(e)}
        use:floating={{
          contextMenu: () => {
            const user = info?.();
            return (
              <Show when={user?.user}>
                {(u) => (
                  <UserContextMenu user={u()} member={user?.member} inVoice />
                )}
              </Show>
            );
          },
        }}
      >
        <Avatar
          size={64}
          src={info?.().avatar}
          fallback={name()}
          shape="circle"
          interactive={false}
        />
      </div>
      <Show
        when={
          muted() || (participant && state.voice.getUserMuted(props.guest.id))
        }
      >
        <span class="lr-mic-state" title="Microfone silenciado">
          <MicOff size={12} />
        </span>
      </Show>
      <Show when={props.guest.self}>
        <span class="lr-listener" title="Sua posição de escuta">
          <Volume2 size={11} />
        </span>
      </Show>
      <span class="lr-person-name">
        <span class="lr-person-label">{name()}</span>
        <Show when={presence()?.viewing}>
          <span
            class="lr-presence"
            data-synchronized={presence()?.synchronized}
          >
            <Show
              when={presence()?.synchronized}
              fallback={<Armchair size={11} />}
            >
              <Link2 size={11} />
            </Show>
            {presence()?.synchronized ? "Room sincronizado" : "Room local"}
          </span>
        </Show>
      </span>
    </div>
  );
}

function StreamLabel(props: { stream: RoomStream; onPin: () => void }) {
  const identity = untrack(() => props.stream.reference?.participant.identity);
  const info = identity ? useUser(identity) : undefined;
  return (
    <button
      type="button"
      class="lr-stream-label"
      onClick={() => props.onPin()}
      title={`Fixar ${props.stream.label}. Clique direito para volume e opções.`}
      use:floating={{
        contextMenu: () => {
          const user = info?.();
          return (
            <Show when={user?.user}>
              {(u) => (
                <UserContextMenu
                  user={u()}
                  member={user?.member}
                  inVoice={!!props.stream.camera}
                  isScreenshare={!props.stream.camera}
                />
              )}
            </Show>
          );
        },
      }}
    >
      {props.stream.label}
    </button>
  );
}

function DefaultRoom() {
  return (
    <svg
      class="lr-default-room"
      viewBox="0 0 1000 562.5"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lr-wall" x2="0" y2="1">
          <stop stop-color="#20213d" />
          <stop offset="1" stop-color="#121321" />
        </linearGradient>
        <linearGradient id="lr-floor" x2="0" y2="1">
          <stop stop-color="#262139" />
          <stop offset="1" stop-color="#11131e" />
        </linearGradient>
        <radialGradient id="lr-light">
          <stop stop-color="#9c88ff" stop-opacity=".24" />
          <stop offset="1" stop-color="#9c88ff" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="1000" height="562.5" fill="url(#lr-wall)" />
      <ellipse cx="500" cy="170" rx="430" ry="280" fill="url(#lr-light)" />
      <path d="M0 375H1000V563H0Z" fill="url(#lr-floor)" />
      <path
        d="M0 375H1000"
        stroke="#8c80c7"
        stroke-opacity=".4"
        stroke-width="2"
      />
      <path
        d="M100 375L0 563M300 375L210 563M500 375V563M700 375L790 563M900 375L1000 563"
        stroke="#ffffff"
        stroke-opacity=".035"
      />
      <ellipse
        cx="500"
        cy="429"
        rx="430"
        ry="103"
        fill="#0c0e19"
        stroke="#7f7198"
        stroke-opacity=".25"
      />
      <rect
        x="188"
        y="16"
        width="624"
        height="360"
        rx="15"
        fill="#0c0d19"
        stroke="#8479ad"
        stroke-opacity=".35"
      />
      <path
        d="M68 120V285M932 120V285"
        stroke="#9f9ae4"
        stroke-width="4"
        stroke-linecap="round"
      />
      <circle cx="68" cy="111" r="8" fill="#c6b9ed" />
      <circle cx="932" cy="111" r="8" fill="#c6b9ed" />
      <For each={[120, 272, 424, 576, 728, 880]}>
        {(x) => (
          <g>
            <ellipse cx={x} cy="408" rx="47" ry="25" fill="#38334b" />
            <ellipse cx={x} cy="461" rx="47" ry="25" fill="#292a3c" />
          </g>
        )}
      </For>
      <text
        x="500"
        y="335"
        text-anchor="middle"
        fill="#b8b0cf"
        font-size="9"
        letter-spacing="5"
      >
        YOUR SPACE · YOUR PEOPLE
      </text>
    </svg>
  );
}
