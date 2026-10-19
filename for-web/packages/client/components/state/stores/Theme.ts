import { Accessor, createSignal } from "solid-js";

import {
  FONT_KEYS,
  Fonts,
  MONOSPACE_FONT_KEYS,
  MonospaceFonts,
} from "@revolt/ui/themes/fonts";

import { State } from "..";

import { AbstractStore } from ".";

export type TypeTheme = {
  /** Overall visual language applied to the generated color scheme. */
  skin: "stoat" | "discord" | "studio";
  motion: "full" | "reduced" | "off";
  panelGap: number;
  fontScale: number;
  colors: Partial<
    Record<
      "background" | "panel" | "raised" | "text" | "muted" | "border",
      string
    >
  >;
  widgetBackgrounds: Record<string, string>;

  /**
   * Base theme preset
   */
  preset: "you";

  /**
   * Light/dark mode
   */
  mode: "light" | "dark" | "system";

  /**
   * Accent
   * (Material You)
   */
  m3Accent: string;

  /**
   * Constrast
   * (Material You)
   */
  m3Contrast: number;

  /**
   * Variant
   * (Material You)
   */
  m3Variant:
    | "monochrome"
    | "neutral"
    | "tonal_spot"
    | "vibrant"
    | "expressive"
    | "fidelity"
    | "content"
    | "rainbow"
    | "fruit_salad";

  /**
   * Whether to permit blurry surfaces
   */
  blur: boolean;

  /**
   * Interface font
   */
  interfaceFont: Fonts;

  /**
   * Monospace font
   */
  monospaceFont: MonospaceFonts;

  /**
   * Message size
   */
  messageSize: number;

  /**
   * Spacing between message groups
   */
  messageGroupSpacing: number;

  /** Global UI corner roundness from 0 (square) to 100 (default). */
  cornerScale: number;

  /** Global UI spacing from 0 (compact) to 100 (spacious). */
  densityScale: number;

  /** Optional per-widget accent colors. */
  widgetAccents: Record<string, string>;

  /** Optional corner and density overrides for functional blocks. */
  widgetCorners: Record<string, number>;
  widgetDensities: Record<string, number>;
};

export type SelectedTheme = Pick<
  TypeTheme,
  | "blur"
  | "skin"
  | "motion"
  | "panelGap"
  | "fontScale"
  | "colors"
  | "widgetBackgrounds"
  | "interfaceFont"
  | "monospaceFont"
  | "messageSize"
  | "messageGroupSpacing"
> & {
  preset: "you";
  darkMode: boolean;

  accent: string;
  contrast: number;
  variant: TypeTheme["m3Variant"];
  cornerScale: number;
  densityScale: number;
  widgetAccents: Record<string, string>;
  widgetCorners: Record<string, number>;
  widgetDensities: Record<string, number>;
};

/**
 * Manages theme information
 */
export class Theme extends AbstractStore<"theme", TypeTheme> {
  prefersDark: Accessor<boolean>;

  /**
   * Construct store
   * @param state State
   */
  constructor(state: State) {
    super(state, "theme");

    // handle prefers-color-scheme value and changes
    const [prefersDark, setPrefersDark] = createSignal(
      window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches,
    );

    this.prefersDark = prefersDark;

    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (event) => setPrefersDark(event.matches));

    this.toggleBlur = this.toggleBlur.bind(this);
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
  default(): TypeTheme {
    return {
      preset: "you",
      skin: "studio",
      motion: "full",
      panelGap: 6,
      fontScale: 100,
      colors: {},
      widgetBackgrounds: {},
      mode: "system",

      m3Accent: "#8cdbb5",
      m3Contrast: 0.0,
      m3Variant: "tonal_spot",

      interfaceFont: "Inter",
      monospaceFont: "Fira Code",

      blur: true,
      messageSize: 14,
      messageGroupSpacing: 12,
      cornerScale: 35,
      densityScale: 50,
      widgetAccents: {},
      widgetCorners: {},
      widgetDensities: {},
    };
  }

  /**
   * Validate the given data to see if it is compliant and return a compliant object
   */
  clean(input: Partial<TypeTheme>): TypeTheme {
    input = input && typeof input === "object" ? input : {};
    const data: TypeTheme = this.default();

    if (["light", "dark", "system"].includes(input.mode!)) {
      data.mode = input.mode!;
    }

    // Legacy "neutral" themes use the supported Material You pipeline too.
    data.preset = "you";

    if (["stoat", "discord", "studio"].includes(input.skin!))
      data.skin = input.skin!;
    if (["full", "reduced", "off"].includes(input.motion!))
      data.motion = input.motion!;
    for (const [key, min, max] of [
      ["panelGap", 0, 16],
      ["fontScale", 90, 120],
    ] as const) {
      const value = input[key];
      if (typeof value === "number" && Number.isFinite(value))
        data[key] = Math.min(max, Math.max(min, value));
    }
    for (const key of ["colors", "widgetBackgrounds"] as const) {
      const values = input[key];
      if (!values || typeof values !== "object") continue;
      const allowed =
        key === "colors"
          ? ["background", "panel", "raised", "text", "muted", "border"]
          : ["navigation", "channels", "conversation", "members", "voice"];
      for (const [id, color] of Object.entries(values))
        if (
          allowed.includes(id) &&
          typeof color === "string" &&
          /^#[0-9a-fA-F]{6}$/.test(color)
        )
          (data[key] as Record<string, string>)[id] = color;
    }

    if (
      typeof input.m3Contrast === "number" &&
      Number.isFinite(input.m3Contrast)
    ) {
      data.m3Contrast = Math.min(1, Math.max(-1, input.m3Contrast));
    }

    if (
      typeof input.m3Accent === "string" &&
      /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(input.m3Accent)
    ) {
      data.m3Accent = input.m3Accent;
    }

    if (
      [
        "monochrome",
        "neutral",
        "tonal_spot",
        "vibrant",
        "expressive",
        "fidelity",
        "content",
        "rainbow",
        "fruit_salad",
      ].includes(input.m3Variant!)
    ) {
      data.m3Variant = input.m3Variant!;
    }

    if (typeof input.blur === "boolean") {
      data.blur = input.blur;
    }

    if (
      typeof input.messageSize === "number" &&
      Number.isFinite(input.messageSize)
    ) {
      data.messageSize = Math.min(24, Math.max(12, input.messageSize));
    }

    if (typeof input.messageGroupSpacing === "number") {
      data.messageGroupSpacing = Math.min(
        32,
        Math.max(0, input.messageGroupSpacing),
      );
    }

    if (
      typeof input.cornerScale === "number" &&
      Number.isFinite(input.cornerScale)
    ) {
      data.cornerScale = Math.min(100, Math.max(0, input.cornerScale));
    }

    if (
      typeof input.densityScale === "number" &&
      Number.isFinite(input.densityScale)
    ) {
      data.densityScale = Math.min(100, Math.max(0, input.densityScale));
    }

    if (input.widgetAccents && typeof input.widgetAccents === "object") {
      data.widgetAccents = Object.entries(input.widgetAccents).reduce(
        (acc, [key, value]) => {
          if (
            [
              "navigation",
              "channels",
              "conversation",
              "members",
              "voice",
            ].includes(key) &&
            typeof value === "string" &&
            /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)
          ) {
            acc[key] = value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
    }

    for (const key of ["widgetCorners", "widgetDensities"] as const) {
      const incoming = input[key];
      if (!incoming || typeof incoming !== "object") continue;
      data[key] = Object.entries(incoming).reduce(
        (acc, [id, value]) => {
          if (
            [
              "navigation",
              "channels",
              "conversation",
              "members",
              "voice",
            ].includes(id) &&
            typeof value === "number" &&
            Number.isFinite(value)
          ) {
            acc[id] = Math.min(100, Math.max(0, value));
          }
          return acc;
        },
        {} as Record<string, number>,
      );
    }

    if (
      typeof input.monospaceFont === "string" &&
      MONOSPACE_FONT_KEYS.includes(input.monospaceFont)
    ) {
      data.monospaceFont = input.monospaceFont;
    }

    if (
      typeof input.interfaceFont === "string" &&
      FONT_KEYS.includes(input.interfaceFont)
    ) {
      data.interfaceFont = input.interfaceFont;
    }

    return data;
  }

  /**
   * Get the currently selected theme (considering system settings)
   */
  get activeTheme(): SelectedTheme {
    const opts = this.get();

    switch (opts.preset) {
      case "you":
        return {
          blur: opts.blur,
          interfaceFont: opts.interfaceFont,
          monospaceFont: opts.monospaceFont,
          messageSize: opts.messageSize,
          messageGroupSpacing: opts.messageGroupSpacing,
          preset: "you",
          skin: opts.skin,
          motion: opts.motion,
          panelGap: opts.panelGap,
          fontScale: opts.fontScale,
          colors: opts.colors,
          widgetBackgrounds: opts.widgetBackgrounds,
          darkMode:
            opts.mode === "dark" ||
            (opts.mode === "system" && this.prefersDark()),

          accent: opts.m3Accent,
          contrast: opts.m3Contrast,
          variant: opts.m3Variant,
          cornerScale: opts.cornerScale,
          densityScale: opts.densityScale,
          widgetAccents: opts.widgetAccents,
          widgetCorners: opts.widgetCorners,
          widgetDensities: opts.widgetDensities,
        };
    }
  }

  /**
   * Get light/dark/system mode
   */
  get mode() {
    return this.get().mode;
  }

  /**
   * Set light/dark/system mode
   * @param mode Mode
   */
  setMode(mode: TypeTheme["mode"]) {
    this.set("mode", mode);
  }

  /**
   * Get current preset
   */
  get preset() {
    return this.get().preset;
  }

  /**
   * Set the active preset
   * @param preset Preset
   */
  setPreset(preset: TypeTheme["preset"]) {
    this.set("preset", preset);
  }

  /** Apply a validated local appearance preset. */
  applyPreset(preset: Partial<TypeTheme>) {
    this.state.set(
      this.getKey(),
      this.global,
      this.clean({ ...this.state.get(this.getKey()), ...preset }),
    );
  }

  /**
   * Get current accent
   */
  get m3Accent() {
    return this.get().m3Accent;
  }

  /**
   * Set the accent of the Material You theme
   * @param accent Accent
   */
  setM3Accent(accent: string) {
    this.set("m3Accent", accent);
  }

  /**
   * Get current contrast
   */
  get m3Contrast() {
    return this.get().m3Contrast;
  }

  /**
   * Set the contrast of the Material You theme
   * @param contrast Contrast
   */
  setM3Contrast(contrast: number) {
    this.set("m3Contrast", contrast);
  }

  /**
   * Get current variant
   */
  get m3Variant() {
    return this.get().m3Variant;
  }

  /**
   * Set the variant of the Material You theme
   * @param variant Variant
   */
  setM3Variant(variant: TypeTheme["m3Variant"]) {
    this.set("m3Variant", variant);
  }

  /**
   * Get current blur state
   */
  get blur() {
    return this.get().blur;
  }

  /**
   * Toggle blur state
   */
  toggleBlur() {
    this.set("blur", !this.blur);
  }

  /**
   * Get current interface font
   */
  get interfaceFont() {
    return this.get().interfaceFont;
  }

  /**
   * Set interface font
   */
  setInterfaceFont(font: Fonts) {
    return this.set("interfaceFont", font);
  }

  /**
   * Get current monospace font
   */
  get monospaceFont() {
    return this.get().monospaceFont;
  }

  /**
   * Set monospace font
   */
  setMonospaceFont(font: MonospaceFonts) {
    return this.set("monospaceFont", font);
  }

  /**
   * Get current message size
   */
  get messageSize() {
    return this.get().messageSize;
  }

  /**
   * Set message size
   */
  set messageSize(size: number) {
    this.set("messageSize", size);
  }

  /**
   * Get current message group spacing
   */
  get messageGroupSpacing() {
    return this.get().messageGroupSpacing;
  }

  get cornerScale() {
    return this.get().cornerScale;
  }

  get densityScale() {
    return this.get().densityScale;
  }

  get widgetAccents() {
    return this.get().widgetAccents;
  }

  get widgetCorners() {
    return this.get().widgetCorners;
  }

  get widgetDensities() {
    return this.get().widgetDensities;
  }

  setCornerScale(value: number) {
    this.set("cornerScale", Math.min(100, Math.max(0, value)));
  }

  setDensityScale(value: number) {
    this.set("densityScale", Math.min(100, Math.max(0, value)));
  }

  setWidgetAccent(id: string, value: string) {
    if (
      !["navigation", "channels", "conversation", "members", "voice"].includes(
        id,
      )
    )
      return;
    const next = { ...this.get().widgetAccents };
    if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) next[id] = value;
    else delete next[id];
    this.set("widgetAccents", next);
  }

  setWidgetCorner(id: string, value: number) {
    if (
      !["navigation", "channels", "conversation", "members", "voice"].includes(
        id,
      ) ||
      !Number.isFinite(value)
    )
      return;
    const next = { ...this.get().widgetCorners };
    if (value === this.cornerScale) delete next[id];
    else next[id] = Math.min(100, Math.max(0, value));
    this.set("widgetCorners", next);
  }

  setWidgetDensity(id: string, value: number) {
    if (
      !["navigation", "channels", "conversation", "members", "voice"].includes(
        id,
      ) ||
      !Number.isFinite(value)
    )
      return;
    const next = { ...this.get().widgetDensities };
    if (value === this.densityScale) delete next[id];
    else next[id] = Math.min(100, Math.max(0, value));
    this.set("widgetDensities", next);
  }

  /**
   * Set message group spacing
   */
  set messageGroupSpacing(space: number) {
    this.set("messageGroupSpacing", space);
  }
}
