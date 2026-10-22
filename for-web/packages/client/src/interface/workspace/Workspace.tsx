import { isMobileApp } from "@revolt/common/lib/mobile";
import { useState } from "@revolt/state";
import {
  type LayoutWidgetId,
  enclosingFrame,
  GRID,
  LAYOUT_WIDGETS,
  MODULES,
} from "@revolt/state/stores/layoutPreferences";
import { createShapeDensityVariables } from "@revolt/ui/themes/stoatWebTheme";
import { hasAppUpdate, UpdateDot } from "@revolt/updates";
import {
  ArrowLeft,
  ArrowLeftRight,
  Blocks,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grip,
  LayoutDashboard,
  Maximize2,
  MessageSquare,
  PanelLeft,
  Phone,
  Plus,
  RotateCcw,
  Settings2,
  Users,
  X,
} from "lucide-solid";
import {
  createEffect,
  createSignal,
  createUniqueId,
  For,
  JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { createStore } from "solid-js/store";
import { Portal } from "solid-js/web";
import { AppearanceStudio } from "./AppearanceStudio";
import "./workspace.css";
import "./workspace.mobile.css";

import {
  type WorkspaceContextValue,
  WorkspaceContext as Context,
  useWorkspace,
} from "@revolt/ui/lib/workspace";
export { useWorkspace } from "@revolt/ui/lib/workspace";

/** Modules mount once into stable slots. Editing changes geometry, never their owner. */
export function WorkspaceModule(props: {
  id: LayoutWidgetId;
  children: JSX.Element;
}) {
  const context = useWorkspace();
  onMount(() => {
    if (context) onCleanup(context.register(props.id));
  });
  return (
    <Show when={context?.slots[props.id]} fallback={props.children}>
      {(slot) => (
        <Portal
          mount={slot()}
          ref={(el) => {
            el.className = "ws-module-content";
          }}
        >
          {props.children}
        </Portal>
      )}
    </Show>
  );
}

const ICONS = {
  navigation: Blocks,
  channels: PanelLeft,
  conversation: MessageSquare,
  members: Users,
  voice: Phone,
};

export function Workspace(props: {
  children: JSX.Element;
  disconnected?: boolean;
  onSettings?: () => void;
  demo?: boolean;
}) {
  const state = useState();
  const [slots, setSlots] = createStore<
    Partial<Record<LayoutWidgetId, HTMLDivElement>>
  >({});
  const [occupied, setOccupied] = createStore<
    Partial<Record<LayoutWidgetId, number>>
  >({});
  const [active, setActive] = createSignal<LayoutWidgetId>("conversation");
  const [selected, setSelected] = createSignal<LayoutWidgetId>("conversation");
  const [narrow, setNarrow] = createSignal(
    isMobileApp() || window.matchMedia("(max-width: 899px)").matches,
  );
  const [dragging, setDragging] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [trayOpen, setTrayOpen] = createSignal(false);
  const navigationId = createUniqueId();
  const [navigationTogglePosition, setNavigationTogglePosition] =
    createSignal<JSX.CSSProperties>({ left: "4px", top: "50%" });
  const [canvasBounds, setCanvasBounds] = createSignal({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const [toolsPosition, setToolsPosition] = createSignal<JSX.CSSProperties>({
    top: "0px",
    right: "10px",
  });
  const expanded = () =>
    state.layout.voiceExpanded && !narrow() && !state.layout.editMode;
  const chatExpanded = () =>
    state.layout.conversationExpanded && !narrow() && !state.layout.editMode;
  let canvas!: HTMLDivElement;
  let root!: HTMLDivElement;
  let stopGesture: (() => void) | undefined;
  onCleanup(() => stopGesture?.());
  createEffect(() => {
    if (narrow() && state.layout.editMode) state.layout.cancelEdit();
  });
  createEffect(() => {
    JSON.stringify({
      widgets: state.layout.widgets,
      active: active(),
      narrow: narrow(),
      editing: state.layout.editMode,
      expanded: expanded(),
      chatExpanded: chatExpanded(),
    });
    requestAnimationFrame(() =>
      window.dispatchEvent(new Event("stoat:layout")),
    );
  });
  const reveal = (id: LayoutWidgetId) => {
    if (!narrow()) state.layout.setWidgetVisible(id, true);
    setActive(id);
    requestAnimationFrame(() =>
      slots[id]?.closest<HTMLElement>(".ws-panel")?.focus(),
    );
  };
  const visible = (id: LayoutWidgetId) => {
    if (narrow()) return active() === id;
    if (expanded() && id === "conversation") return false;
    if (expanded() && id === "voice") return true;
    if (chatExpanded() && id === "voice") return false;
    if (chatExpanded() && id === "conversation") return true;
    return state.layout.widgets[id].visible;
  };
  const context: WorkspaceContextValue = {
    slots,
    active,
    narrow,
    reveal,
    visible,
    register(id) {
      setOccupied(id, (n = 0) => n + 1);
      return () => setOccupied(id, (n = 1) => Math.max(0, n - 1));
    },
  };
  onMount(() => {
    const observer = new ResizeObserver(() => {
      const bounds = root.getBoundingClientRect();
      setNarrow(isMobileApp() || bounds.width < 900);
      const stage = canvas.getBoundingClientRect();
      setCanvasBounds({
        left: stage.left,
        top: stage.top,
        width: stage.width,
        height: stage.height,
      });
      setToolsPosition({
        top: `${bounds.top}px`,
        right: `${Math.max(0, window.innerWidth - bounds.right) + 10}px`,
      });
      setNavigationTogglePosition({
        left: `${bounds.left + 4}px`,
        top: `${bounds.top + bounds.height / 2}px`,
      });
    });
    observer.observe(root);
    observer.observe(canvas);
    onCleanup(() => observer.disconnect());
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.layout.editMode) {
        state.layout.cancelEdit();
        e.preventDefault();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        !narrow() &&
        e.key.toLowerCase() === "e"
      ) {
        e.preventDefault();
        state.layout.setEditMode(!state.layout.editMode);
      }
    };
    window.addEventListener("keydown", keydown);
    onCleanup(() => window.removeEventListener("keydown", keydown));
  });

  function manipulate(event: PointerEvent, id: LayoutWidgetId, resize = false) {
    if (!state.layout.editMode || narrow() || event.button !== 0) return;
    event.preventDefault();
    stopGesture?.();
    event.stopPropagation();
    setSelected(id);
    state.layout.raiseWidget(id);
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    const start = { ...state.layout.widgets[id].frame };
    const from = { x: event.clientX, y: event.clientY };
    setDragging(true);
    const move = (e: PointerEvent) => {
      const dx = Math.round(((e.clientX - from.x) / rect.width) * GRID.columns);
      const dy = Math.round(((e.clientY - from.y) / rect.height) * GRID.rows);
      state.layout.setWidgetFrame(
        id,
        resize
          ? { w: start.w + dx, h: start.h + dy }
          : { x: start.x + dx, y: start.y + dy },
      );
    };
    const finish = () => {
      setDragging(false);
      setNotice(`${MODULES[id].label}: posição e tamanho atualizados.`);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
      target.removeEventListener("lostpointercapture", finish);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
    target.addEventListener("lostpointercapture", finish);
    stopGesture = finish;
  }
  function keyboard(event: KeyboardEvent, id: LayoutWidgetId) {
    if (
      !state.layout.editMode ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    const f = state.layout.widgets[id].frame;
    const dx =
      event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    const dy = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    state.layout.setWidgetFrame(
      id,
      event.shiftKey
        ? { w: f.w + dx, h: f.h + dy }
        : { x: f.x + dx, y: f.y + dy },
    );
  }
  function panelStyle(id: LayoutWidgetId): JSX.CSSProperties {
    const f =
      (id === "voice" && expanded()) ||
      (id === "conversation" && chatExpanded())
        ? enclosingFrame(
            state.layout.widgets.voice.frame,
            state.layout.widgets.conversation.frame,
          )
        : state.layout.widgets[id].frame;
    const theme = state.theme.activeTheme;
    const bounds = canvasBounds();
    const navigationFrame = narrow()
      ? { x: 0, y: 0, w: GRID.columns, h: GRID.rows }
      : f;
    return {
      ...createShapeDensityVariables(
        theme.widgetCorners[id] ?? theme.cornerScale,
        theme.widgetDensities[id] ?? theme.densityScale,
      ),
      "grid-column": `${f.x + 1} / span ${f.w}`,
      "grid-row": `${f.y + 1} / span ${f.h}`,
      "--ws-module-accent": theme.widgetAccents[id] ?? "var(--ws-accent)",
      "--ws-module-bg":
        theme.widgetBackgrounds[id] ??
        (id === "conversation" ? "var(--ws-panel)" : "var(--ws-sidebar)"),
      "z-index":
        id === "navigation" && !state.layout.editMode
          ? 40
          : (expanded() && id === "voice") ||
              (chatExpanded() && id === "conversation")
            ? 30
            : state.layout.editMode && selected() === id
              ? 20
              : state.layout.widgetOrder.indexOf(id) + 1,
      display: visible(id) ? "flex" : "none",
      // Navigation shares the call's portal so its layer can actually cover it.
      // Keep the same DOM mounted, and derive its viewport rectangle from the grid.
      ...(id === "navigation"
        ? {
            position: "fixed",
            left: `${bounds.left + (navigationFrame.x / GRID.columns) * bounds.width}px`,
            top: `${bounds.top + (navigationFrame.y / GRID.rows) * bounds.height}px`,
            width: narrow()
              ? `${bounds.width}px`
              : `calc(${(navigationFrame.w / GRID.columns) * bounds.width}px - var(--ws-gap))`,
            height: narrow()
              ? `${bounds.height}px`
              : `calc(${(navigationFrame.h / GRID.rows) * bounds.height}px - var(--ws-gap))`,
            margin: narrow() ? "0" : "calc(var(--ws-gap) / 2)",
          }
        : {}),
    };
  }
  return (
    <Context.Provider value={context}>
      <div
        ref={root}
        class="workspace"
        data-editing={state.layout.editMode}
        data-narrow={narrow()}
        data-dragging={dragging()}
      >
        <Show when={narrow()}>
          <header class="ws-mobile-header">
            <button
              class="ws-icon-button"
              aria-label={
                active() === "navigation" || active() === "members"
                  ? "Voltar ao chat"
                  : "Trocar servidor"
              }
              onClick={() =>
                reveal(
                  active() === "navigation" || active() === "members"
                    ? "conversation"
                    : "navigation",
                )
              }
            >
              <Show
                when={active() === "navigation" || active() === "members"}
                fallback={<Blocks size={21} />}
              >
                <ArrowLeft size={21} />
              </Show>
            </button>
            <div>
              <span>BOFONASU STOUT</span>
              <strong>
                {
                  {
                    navigation: "Seus servidores",
                    channels: "Canais e conversas",
                    conversation: "Chat",
                    members: "Pessoas",
                    voice: "Chamada",
                  }[active()]
                }
              </strong>
            </div>
            <Show when={active() === "conversation"}>
              <button
                class="ws-icon-button"
                aria-label="Ver pessoas"
                onClick={() => reveal("members")}
              >
                <Users size={21} />
              </button>
            </Show>
            <Show when={props.disconnected}>
              <span class="ws-mobile-connection" role="status">
                Reconectando
              </span>
            </Show>
          </header>
        </Show>
        <Portal mount={document.getElementById("floating") ?? document.body}>
          <Show when={!narrow() && !state.layout.editMode}>
            <button
              type="button"
              class="ws-navigation-toggle"
              style={navigationTogglePosition()}
              aria-label={
                visible("navigation")
                  ? "Ocultar servidores e amigos"
                  : "Mostrar servidores e amigos"
              }
              title={
                visible("navigation")
                  ? "Ocultar servidores e amigos"
                  : "Mostrar servidores e amigos"
              }
              aria-expanded={visible("navigation")}
              aria-controls={navigationId}
              onClick={() => {
                const showing = !visible("navigation");
                state.layout.setWidgetVisible("navigation", showing);
                setNotice(
                  showing
                    ? "Servidores e amigos visíveis acima dos outros módulos."
                    : "Servidores e amigos ocultos.",
                );
              }}
            >
              <Show
                when={visible("navigation")}
                fallback={<ChevronRight size={15} />}
              >
                <ChevronLeft size={15} />
              </Show>
            </button>
          </Show>
          <Show when={!narrow()}>
            <div
              class="ws-tools"
              style={toolsPosition()}
              data-open={trayOpen()}
              onPointerEnter={() => setTrayOpen(true)}
              onPointerLeave={() => setTrayOpen(false)}
              onFocusIn={() => setTrayOpen(true)}
              onFocusOut={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                )
                  setTrayOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setTrayOpen(false);
                  (event.target as HTMLElement).blur();
                }
              }}
            >
              <button
                class="ws-tools-handle"
                aria-label="Opções do workspace"
                aria-expanded={trayOpen()}
                aria-controls="workspace-tools"
                onClick={() => setTrayOpen(true)}
              >
                <Settings2 size={14} />
              </button>
              <div
                class="ws-tools-tray"
                id="workspace-tools"
                aria-label="Opções do workspace"
                inert={!trayOpen()}
              >
                <Show when={props.disconnected}>
                  <span class="ws-tools-status" role="status">
                    Reconectando…
                  </span>
                </Show>
                <Show when={!narrow()}>
                  <button
                    class="ws-icon-button"
                    title="Trocar posições de conversa e chamada"
                    aria-label="Trocar posições de conversa e chamada"
                    onClick={() => state.layout.swapConversationVoice()}
                  >
                    <ArrowLeftRight size={17} />
                  </button>
                </Show>
                <Show when={props.onSettings}>
                  <button
                    class="ws-icon-button"
                    title={
                      hasAppUpdate()
                        ? "Configurações · atualização disponível"
                        : "Configurações da conta"
                    }
                    aria-label={
                      hasAppUpdate()
                        ? "Configurações · atualização disponível"
                        : "Configurações da conta"
                    }
                    onClick={() => props.onSettings?.()}
                  >
                    <Settings2 size={17} />
                    <UpdateDot />
                  </button>
                </Show>
                <button
                  class="ws-button ws-button--quiet"
                  onClick={() =>
                    state.layout.setEditMode(!state.layout.editMode)
                  }
                  title="Ctrl+Shift+E"
                >
                  <LayoutDashboard size={16} />
                  <span>Layout</span>
                </button>
                <button
                  class="ws-button ws-button--accent"
                  onClick={() => state.layout.setStudioOpen(true)}
                >
                  <Settings2 size={15} />
                  <span>Personalizar</span>
                </button>
              </div>
            </div>
          </Show>
        </Portal>
        <Show when={state.layout.editMode}>
          <div class="ws-editbar">
            <span class="ws-edit-label">
              <span class="ws-pulse" />
              EDITANDO SEU ESPAÇO
            </span>
            <span class="ws-edit-help">
              {narrow()
                ? "Ajuste a grade pelos controles. A prévia ampla aparece no desktop."
                : "Arraste pelo título · redimensione pelo canto · setas movem · Shift + setas redimensionam"}
            </span>
            <button
              class="ws-button ws-button--quiet"
              onClick={() => state.layout.resetWidgets()}
              title="Restaurar distribuição"
            >
              <RotateCcw size={15} />
            </button>
            <button
              class="ws-button ws-button--quiet"
              onClick={() => state.layout.cancelEdit()}
            >
              Cancelar
            </button>
            <button
              class="ws-button ws-button--accent"
              onClick={() => state.layout.setEditMode(false)}
            >
              <Check size={15} />
              Concluir
            </button>
          </div>
        </Show>
        <div class="ws-stage">
          <div ref={canvas} class="ws-canvas" aria-label="Workspace modular">
            <For each={LAYOUT_WIDGETS}>
              {(id) => {
                const panel = (
                  <section
                    id={id === "navigation" ? navigationId : undefined}
                    class="ws-panel"
                    classList={{ "ws-navigation-panel": id === "navigation" }}
                    data-editing={state.layout.editMode}
                    data-narrow={narrow()}
                    data-module={id}
                    data-selected={state.layout.editMode && selected() === id}
                    style={panelStyle(id)}
                    aria-label={MODULES[id].label}
                    tabIndex={state.layout.editMode ? 0 : -1}
                    onKeyDown={(e) => keyboard(e, id)}
                    onFocus={() => setSelected(id)}
                  >
                    <Show when={state.layout.editMode}>
                      <div
                        class="ws-panel-handle"
                        onPointerDown={(e) => manipulate(e, id)}
                      >
                        <Grip size={14} />
                        <span>{MODULES[id].label}</span>
                        <button
                          aria-label={`Ocultar ${MODULES[id].label}`}
                          disabled={id === "conversation"}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={() => state.layout.toggleWidget(id)}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </Show>
                    <div ref={(el) => setSlots(id, el)} class="ws-panel-slot" />
                    <Show when={!occupied[id]}>
                      <div class="ws-empty">
                        <span class="ws-empty-symbol">
                          <Show
                            when={id === "voice"}
                            fallback={<Users size={24} />}
                          >
                            <Phone size={24} />
                          </Show>
                        </span>
                        <strong>
                          {id === "voice"
                            ? "Entre na conversa"
                            : "Seu contexto, aqui"}
                        </strong>
                        <span>
                          {id === "voice"
                            ? "Escolha um canal de voz para começar."
                            : "Membros, perfis e resultados aparecem neste painel."}
                        </span>
                      </div>
                    </Show>
                    <Show when={state.layout.editMode}>
                      <button
                        class="ws-resize"
                        aria-label={`Redimensionar ${MODULES[id].label}`}
                        onPointerDown={(e) => manipulate(e, id, true)}
                      >
                        <Maximize2 size={13} />
                      </button>
                    </Show>
                  </section>
                );
                return id === "navigation" ? (
                  <Portal
                    mount={document.getElementById("floating") ?? document.body}
                  >
                    {panel}
                  </Portal>
                ) : (
                  panel
                );
              }}
            </For>
          </div>
          <Show when={state.layout.editMode}>
            <aside class="ws-inspector">
              <div class="ws-inspector-heading">
                <span>ESTRUTURA</span>
                <span>48 × 36</span>
              </div>
              <For each={LAYOUT_WIDGETS}>
                {(id) => (
                  <div class="ws-layer" data-active={selected() === id}>
                    <button
                      onClick={() => {
                        setSelected(id);
                        if (narrow()) setActive(id);
                      }}
                    >
                      <span>{MODULES[id].label}</span>
                    </button>
                    <input
                      type="checkbox"
                      aria-label={`Mostrar ${MODULES[id].label}`}
                      disabled={id === "conversation"}
                      checked={state.layout.widgets[id].visible}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        state.layout.setWidgetVisible(
                          id,
                          e.currentTarget.checked,
                        )
                      }
                    />
                  </div>
                )}
              </For>
              <div class="ws-inspector-heading">
                <span>{MODULES[selected()].label}</span>
                <ChevronDown size={14} />
              </div>
              <div class="ws-geometry">
                <For each={["x", "y", "w", "h"] as const}>
                  {(key) => (
                    <label>
                      {
                        { x: "Coluna", y: "Linha", w: "Largura", h: "Altura" }[
                          key
                        ]
                      }
                      <input
                        type="number"
                        min={
                          key === "w"
                            ? MODULES[selected()].minW
                            : key === "h"
                              ? MODULES[selected()].minH
                              : 0
                        }
                        max={key === "x" || key === "w" ? 48 : 36}
                        value={state.layout.widgets[selected()].frame[key]}
                        onChange={(e) =>
                          state.layout.setWidgetFrame(selected(), {
                            [key]: Number(e.currentTarget.value),
                          })
                        }
                      />
                    </label>
                  )}
                </For>
              </div>
              <p>
                Módulos podem se sobrepor. Selecione-os por esta lista para
                recuperar um painel.
              </p>
              <button
                class="ws-button ws-button--quiet"
                onClick={() => {
                  state.layout.setEditMode(false);
                  state.layout.setStudioOpen(true);
                }}
              >
                <Plus size={15} />
                Salvar como preset
              </button>
            </aside>
          </Show>
        </div>
        <Show when={narrow()}>
          <nav class="ws-mobile-tabs" aria-label="Regiões do workspace">
            <For each={["channels", "conversation", "voice"] as const}>
              {(id) => {
                const Icon = ICONS[id];
                return (
                  <button
                    data-active={active() === id}
                    aria-label={MODULES[id].label}
                    aria-current={active() === id ? "page" : undefined}
                    onClick={() => reveal(id)}
                  >
                    <Icon size={19} />
                    <span>
                      {
                        {
                          channels: "Canais",
                          conversation: "Chat",
                          voice: "Chamada",
                        }[id]
                      }
                    </span>
                  </button>
                );
              }}
            </For>
            <button
              aria-label="Configurações"
              onClick={() => props.onSettings?.()}
            >
              <Settings2 size={21} />
              <span>Ajustes</span>
              <UpdateDot />
            </button>
          </nav>
        </Show>
        <span class="ws-sr-only" aria-live="polite">
          {notice()}
        </span>
        {props.children}
        <AppearanceStudio />
      </div>
    </Context.Provider>
  );
}
