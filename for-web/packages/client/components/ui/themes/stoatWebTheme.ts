import { SelectedTheme } from "@revolt/state/stores/Theme";
import { createMaterialColourVariables } from "./materialTheme";

/**
 * Generate Stoat for Web variables
 * @param theme Theme
 * @returns CSS Variables
 */
export function createStoatWebVariables(theme: SelectedTheme) {
  const accent = theme.darkMode
    ? theme.accent
    : createMaterialColourVariables(theme, "").primary;
  return {
    // helper variables
    "--unset-fg": "red",
    "--unset-bg": "linear-gradient(to right, red, blue)",

    // message size
    "--message-size": `${theme.messageSize}px`,
    "--message-group-spacing": `${theme.messageGroupSpacing * (0.75 + theme.densityScale / 200)}px`,
    "--ui-widget-accent": theme.accent,
    "--ws-accent": accent,
    "--ws-on-accent": accentTextColor(accent),
    "--ws-gap": `${theme.panelGap}px`,
    "--ws-font-size": `${(14 * theme.fontScale) / 100}px`,
    "--ui-font-scale": `${theme.fontScale / 100}`,
    "--ws-motion-duration":
      theme.motion === "off"
        ? "0ms"
        : theme.motion === "reduced"
          ? "80ms"
          : "220ms",

    // emoji size
    "--emoji-size": "1.4em",
    "--emoji-size-medium": "48px",
    "--emoji-size-large": "96px",

    // effects
    "--effects-blur-md": theme.blur ? "blur(20px)" : "unset",
    "--effects-invert-black": theme.darkMode ? "invert(100%)" : "invert(0%)",
    "--effects-invert-light": theme.darkMode ? "invert(0%)" : "invert(1000%)",

    // transitions
    "--transitions-fast": `${theme.motion === "off" ? 0 : theme.motion === "reduced" ? 0.04 : 0.1}s ease-in-out`,
    "--transitions-medium": `${theme.motion === "off" ? 0 : theme.motion === "reduced" ? 0.08 : 0.2}s ease`,

    // brand
    "--brand-presence-online": "#3ABF7E",
    "--brand-presence-idle": "#F39F00",
    "--brand-presence-busy": "#F84848",
    "--brand-presence-focus": "#4799F0",
    "--brand-presence-invisible": "#A5A5A5",

    // font
    "--fonts-primary": `"${theme.interfaceFont}", "Inter", sans-serif`,
    "--fonts-monospace": `"${theme.monospaceFont}", "Jetbrains Mono", sans-serif`,

    ...createShapeDensityVariables(theme.cornerScale, theme.densityScale),
    ...reduceWithPrefix(themeConstants.layout, "--layout-"),
  };
}

/** Pick the more legible foreground for custom accent fills in either mode. */
function accentTextColor(hex: string) {
  const value =
    hex.length === 4
      ? hex
          .slice(1)
          .split("")
          .map((char) => char + char)
          .join("")
      : hex.slice(1, 7);
  const rgb = [0, 2, 4]
    .map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return (luminance + 0.05) / 0.056 > 1.05 / (luminance + 0.05)
    ? "#101215"
    : "#ffffff";
}

/** Create the inherited radius and spacing tokens for a global or local scope. */
export function createShapeDensityVariables(
  cornerScale: number,
  density: number,
) {
  const radiusScale = cornerScale / 100;
  const densityScale = 0.75 + density / 200;
  const radii = Object.fromEntries(
    Object.entries(themeConstants.borderRadius).map(([key, value]) => [
      key,
      key === "full" || key === "circle"
        ? key === "full"
          ? `${9999 * radiusScale}px`
          : `${50 * radiusScale}%`
        : `${Number.parseFloat(value) * radiusScale}px`,
    ]),
  );
  const gaps = Object.fromEntries(
    Object.entries(themeConstants.gap).map(([key, value]) => [
      key,
      `${Number.parseFloat(value) * densityScale}px`,
    ]),
  );

  return {
    "--ui-density": `${densityScale}`,
    ...Object.fromEntries(
      ["md-sys-shape", "mdui-shape"].flatMap((prefix) =>
        Object.entries({
          none: "none",
          "extra-small": "xs",
          small: "sm",
          medium: "md",
          large: "lg",
          "extra-large": "xl",
          full: "full",
        }).map(([name, token]) => [`--${prefix}-corner-${name}`, radii[token]]),
      ),
    ),
    // load constants
    ...reduceWithPrefix(radii, "--borderRadius-"),
    ...reduceWithPrefix(gaps, "--gap-"),
  };
}

/**
 * Add prefix to all keys in an object
 * @param object Object
 * @param prefix Prefix
 * @returns New object
 */
function reduceWithPrefix(object: Record<string, string>, prefix: string) {
  return Object.entries(object).reduce(
    (d, [k, v]) => ({ ...d, [`${prefix}${k}`]: v }),
    {},
  );
}

const themeConstants = {
  borderRadius: {
    // Material 3 Expressive ten-level shape scale
    // https://m3.material.io/styles/shape/corner-radius-scale
    none: "0px",
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    li: "20px",
    xl: "28px",
    xli: "32px",
    xxl: "48px",
    full: "calc(infinity * 1px)",
    circle: "100%",
  },
  /**
   * @deprecated decide this at a component level
   */
  gap: {
    none: "0",
    xxs: "1px",
    xs: "2px",
    s: "6px",
    sm: "4px",
    md: "8px",
    l: "12px",
    lg: "15px",
    x: "28px",
    xl: "32px",
    xxl: "64px",
  },
  layout: {
    "width-channel-sidebar": "248px",
    "width-user-context-menu-truncate": "300px",
    "height-message-box": "32vh",
  },
};
