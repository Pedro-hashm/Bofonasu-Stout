import Instance from "@revolt/instance/Instance";
import { paramsFromPathname } from "@revolt/routing";
import { Accessor, batch, createSignal, Setter } from "solid-js";
import { unwrap } from "solid-js/store";

import { AbstractStore } from ".";
import { State } from "..";
import type { TypeTheme } from "./Theme";
import type { LayoutWidgetConfig, LayoutWidgetId } from "./layoutPreferences";
import {
  type GridFrame,
  cleanFrame,
  cleanWidgetConfigs,
  cleanWidgetOrder,
  createDefaultWidgets,
  LAYOUT_WIDGETS,
} from "./layoutPreferences";

export { LAYOUT_WIDGETS } from "./layoutPreferences";
export type { LayoutWidgetConfig, LayoutWidgetId } from "./layoutPreferences";

export interface UserAppearancePreset {
  id: string;
  name: string;
  theme: TypeTheme;
  widgetOrder: LayoutWidgetId[];
  widgets: Record<LayoutWidgetId, LayoutWidgetConfig>;
}

/**
 * Static section IDs
 */
export enum LAYOUT_SECTIONS {
  PRIMARY_SIDEBAR = "PRIMARY_SIDEBAR",
  MEMBER_SIDEBAR = "MEMBER_SIDEBAR",
  MENTION_REPLY = "MENTION_REPLY",
  MATURE = "nsfw",
}

export interface TypeLayout {
  /**
   * The current section of the program we are in
   *
   * This can currently either be:
   * - home
   * - discover
   * - a server ID
   */
  activeInterface: "home" | "discover" | string;

  /**
   * Current path within an interface
   */
  activePath: Record<TypeLayout["activeInterface"], string>;

  /**
   * Open (or closed) sections of the UI
   *
   * Only the contrary is ever stored
   */
  openSections: Record<string, boolean>;

  /** Reordering and sizing are local client preferences, not server sync data. */
  widgetOrder: LayoutWidgetId[];
  widgets: Record<LayoutWidgetId, LayoutWidgetConfig>;
  editMode: boolean;
  savedPresets: UserAppearancePreset[];
}

/**
 * Handles layout and navigation of the app.
 */
export class Layout extends AbstractStore<"layout", TypeLayout> {
  private isStudioOpen: Accessor<boolean>;
  private updateStudioOpen: Setter<boolean>;
  private isVoiceExpanded: Accessor<boolean>;
  private updateVoiceExpanded: Setter<boolean>;

  get voiceExpanded() {
    return this.isVoiceExpanded();
  }
  setVoiceExpanded(value: boolean) {
    this.updateVoiceExpanded(value);
  }

  swapConversationVoice() {
    const conversation = { ...this.widgets.conversation.frame };
    const voice = { ...this.widgets.voice.frame };
    batch(() => {
      this.set("widgets", "conversation", "frame", voice);
      this.set("widgets", "voice", "frame", conversation);
      this.setWidgetVisible("voice", true);
    });
  }
  private editSnapshot?: {
    widgets: TypeLayout["widgets"];
    widgetOrder: LayoutWidgetId[];
  };

  get studioOpen() {
    return this.isStudioOpen();
  }
  setStudioOpen(value: boolean) {
    this.updateStudioOpen(value);
  }
  /**
   * Construct store
   * @param state State
   */
  constructor(state: State) {
    super(state, "layout");
    const [studioOpen, setStudioOpen] = createSignal(false);
    this.isStudioOpen = studioOpen;
    this.updateStudioOpen = setStudioOpen;
    const [voiceExpanded, setVoiceExpanded] = createSignal(false);
    this.isVoiceExpanded = voiceExpanded;
    this.updateVoiceExpanded = setVoiceExpanded;
  }

  get widgetOrder() {
    return this.get().widgetOrder;
  }

  get widgets() {
    return this.get().widgets;
  }

  get editMode() {
    return this.get().editMode;
  }

  get savedPresets() {
    return this.get().savedPresets;
  }

  /**
   * Hydrate external context
   */
  hydrate(): void {
    /** nothing needs to be done */
  }

  /**
   * Generate default values
   */
  default(): TypeLayout {
    return {
      activeInterface: "home",
      activePath: {},
      openSections: {},
      widgetOrder: [...LAYOUT_WIDGETS],
      widgets: createDefaultWidgets(),
      editMode: false,
      savedPresets: [],
    };
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeLayout>): TypeLayout {
    input = input && typeof input === "object" ? input : {};
    const layout: TypeLayout = this.default();

    if (typeof input.activeInterface === "string") {
      layout.activeInterface = input.activeInterface;
    }

    if (input.activePath && typeof input.activePath === "object") {
      for (const interfaceId of Object.keys(input.activePath)) {
        if (typeof input.activePath[interfaceId] === "string") {
          layout.activePath[interfaceId] = Instance.relPath(
            input.activePath[interfaceId],
          );
        }
      }
    }

    if (input.openSections && typeof input.openSections === "object") {
      for (const section of Object.keys(input.openSections)) {
        if (typeof input.openSections[section] === "boolean") {
          layout.openSections[section] = input.openSections[section];
        }
      }
    }

    layout.widgetOrder = cleanWidgetOrder(input.widgetOrder);
    layout.widgets = cleanWidgetConfigs(input.widgets);

    if (Array.isArray(input.savedPresets)) {
      layout.savedPresets = input.savedPresets
        .filter(
          (preset): preset is UserAppearancePreset =>
            !!preset &&
            typeof preset.id === "string" &&
            typeof preset.name === "string" &&
            !!preset.theme &&
            typeof preset.theme === "object",
        )
        .slice(0, 20)
        .map((preset) => {
          const cleaned = this.clean({
            widgetOrder: preset.widgetOrder,
            widgets: preset.widgets,
          });
          return {
            id: preset.id.slice(0, 80),
            name: preset.name.trim().slice(0, 50) || "Custom preset",
            theme: this.state.theme.clean(preset.theme),
            widgetOrder: cleaned.widgetOrder,
            widgets: cleaned.widgets,
          };
        });
    }

    // Never start the app with edit handles visible after a reload.
    layout.editMode = false;

    return layout;
  }

  setEditMode(enabled: boolean) {
    if (enabled && !this.editMode) {
      this.editSnapshot = {
        widgets: structuredClone(unwrap(this.widgets)),
        widgetOrder: [...this.widgetOrder],
      };
      this.setStudioOpen(false);
    }
    if (!enabled) this.editSnapshot = undefined;
    this.set("editMode", enabled);
  }

  cancelEdit() {
    const snapshot = this.editSnapshot;
    batch(() => {
      if (snapshot) {
        this.set("widgets", snapshot.widgets);
        this.set("widgetOrder", snapshot.widgetOrder);
      }
      this.setEditMode(false);
    });
  }

  setWidgetFrame(id: LayoutWidgetId, frame: Partial<GridFrame>) {
    if (!LAYOUT_WIDGETS.includes(id)) return;
    const current = this.widgets[id].frame;
    this.set(
      "widgets",
      id,
      "frame",
      cleanFrame(id, { ...current, ...frame }, current),
    );
  }

  setWidgetVisible(id: LayoutWidgetId, visible: boolean) {
    if (id === "conversation" || !LAYOUT_WIDGETS.includes(id)) return;
    this.set("widgets", id, "visible", visible);
  }

  toggleWidget(id: LayoutWidgetId) {
    this.setWidgetVisible(id, !this.get().widgets[id].visible);
  }

  raiseWidget(id: LayoutWidgetId) {
    if (!LAYOUT_WIDGETS.includes(id)) return;
    this.set("widgetOrder", [
      ...this.widgetOrder.filter((widget) => widget !== id),
      id,
    ]);
  }

  setWidgetWidth(id: LayoutWidgetId, width: number) {
    if (!LAYOUT_WIDGETS.includes(id) || !Number.isFinite(width)) return;
    const snappedWidth = Math.round(width / 8) * 8;
    this.set(
      "widgets",
      id,
      "width",
      Math.min(1200, Math.max(56, snappedWidth)),
    );
  }

  moveWidget(id: LayoutWidgetId, target: LayoutWidgetId) {
    if (
      !LAYOUT_WIDGETS.includes(id) ||
      !LAYOUT_WIDGETS.includes(target) ||
      id === target
    )
      return;
    const order = this.get().widgetOrder.filter((widget) => widget !== id);
    const targetIndex = order.indexOf(target);
    order.splice(targetIndex < 0 ? order.length : targetIndex, 0, id);
    this.set("widgetOrder", order);
  }

  resetWidgets(style: "stoat" | "discord" | "focus" = "stoat") {
    this.set("widgetOrder", [...LAYOUT_WIDGETS]);
    this.set("widgets", createDefaultWidgets(style));
  }

  applyDiscordPreset() {
    this.resetWidgets("discord");
  }

  savePreset(name: string) {
    const trimmed = name.trim().slice(0, 50);
    if (!trimmed) return;
    const preset: UserAppearancePreset = {
      id: crypto.randomUUID(),
      name: trimmed,
      theme: structuredClone(unwrap(this.state.get("theme"))),
      widgetOrder: [...this.get().widgetOrder],
      widgets: structuredClone(unwrap(this.get().widgets)),
    };
    this.set("savedPresets", [...this.get().savedPresets, preset].slice(-20));
  }

  applySavedPreset(id: string, appearanceOnly = false) {
    const preset = this.get().savedPresets.find((item) => item.id === id);
    if (!preset) return;
    this.state.theme.applyPreset(preset.theme);
    if (appearanceOnly) return;
    this.set("widgetOrder", [...preset.widgetOrder]);
    this.set("widgets", cleanWidgetConfigs(preset.widgets));
  }

  deleteSavedPreset(id: string) {
    this.set(
      "savedPresets",
      this.get().savedPresets.filter((preset) => preset.id !== id),
    );
  }

  exportAppearance() {
    return JSON.stringify(
      {
        version: 1,
        name: "Meu workspace",
        theme: unwrap(this.state.get("theme")),
        widgetOrder: [...this.widgetOrder],
        widgets: unwrap(this.widgets),
      },
      null,
      2,
    );
  }

  importAppearance(json: string, appearanceOnly = false) {
    if (json.length > 100_000) throw new Error("O arquivo excede 100 KB.");
    const value = JSON.parse(json);
    if (
      !value ||
      value.version !== 1 ||
      !value.theme ||
      typeof value.theme !== "object" ||
      !value.widgets ||
      typeof value.widgets !== "object"
    )
      throw new Error("Arquivo de tema inválido ou versão incompatível.");
    batch(() => {
      this.state.theme.applyPreset(this.state.theme.clean(value.theme));
      if (!appearanceOnly) {
        this.set("widgets", cleanWidgetConfigs(value.widgets));
        this.set("widgetOrder", cleanWidgetOrder(value.widgetOrder));
      }
      this.savePreset(
        typeof value.name === "string" ? value.name : "Tema importado",
      );
    });
  }

  /**
   * Get the last active path in the app
   */
  getLastActivePath() {
    const section = this.get().activeInterface;
    return this.get().activePath[section] ?? "/";
  }

  /**
   * Get the last active discover path in the app
   */
  getLastActiveDiscoverPath() {
    return this.get().activePath["discover"] ?? "/discover/servers";
  }

  /**
   * Get the last active server path
   */
  getLastActiveServerPath(serverId: string) {
    return this.get().activePath[serverId] ?? `/server/${serverId}`;
  }

  /**
   * Set the last active path in the app
   */
  setLastActivePath(pathname: string) {
    if (
      pathname.startsWith("/settings") ||
      pathname.startsWith("/invite") ||
      pathname.startsWith("/login")
    )
      return;

    const params = paramsFromPathname(pathname);
    const section = pathname.startsWith("/discover")
      ? "discover"
      : (params.serverId ?? "home");
    this.set("activeInterface", section);
    this.set("activePath", section, Instance.relPath(pathname));
  }

  /**
   * Get state of a section
   * @param id Section ID
   * @param defaultValue Default state value
   * @returns Whether the section is open
   */
  getSectionState(id: string, defaultValue = false) {
    return this.get().openSections[id] ?? defaultValue;
  }

  /**
   * Set the state of a section
   * @param id Section ID
   * @param value New state value
   * @param defaultValue Default state value
   */
  setSectionState(id: string, value: boolean, defaultValue = false) {
    this.set("openSections", id, value === defaultValue ? undefined! : value);
  }

  /**
   * Toggle state of a section
   * @param id Section ID
   * @param defaultValue Default state value
   */
  toggleSectionState(id: string, defaultValue?: boolean) {
    this.setSectionState(
      id,
      !this.getSectionState(id, defaultValue),
      defaultValue,
    );
  }
}
