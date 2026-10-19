import type { TypeTheme } from "./Theme";

export const APPEARANCE_PRESETS = [
  {
    id: "studio",
    name: "Studio",
    tag: "PADRÃO",
    description: "Grafite, menta e espaço para conversar.",
    layout: "stoat",
    swatches: ["#101215", "#191c20", "#8cdbb5"],
    theme: {
      skin: "studio",
      mode: "dark",
      m3Accent: "#8cdbb5",
      cornerScale: 35,
      densityScale: 50,
      panelGap: 6,
    },
  },
  {
    id: "discord",
    name: "Discord",
    tag: "FAMILIAR",
    description: "A organização que você já conhece.",
    layout: "discord",
    swatches: ["#1e1f22", "#313338", "#5865f2"],
    theme: {
      skin: "discord",
      mode: "dark",
      m3Accent: "#5865f2",
      cornerScale: 30,
      densityScale: 42,
      panelGap: 0,
      messageSize: 16,
      messageGroupSpacing: 6,
      blur: false,
    },
  },
  {
    id: "stoat",
    name: "Stoat",
    tag: "CLÁSSICO",
    description: "As cores e formas da identidade Stoat.",
    layout: "stoat",
    swatches: ["#171923", "#252837", "#5470ec"],
    theme: {
      skin: "stoat",
      mode: "dark",
      m3Accent: "#5470ec",
      cornerScale: 100,
      densityScale: 50,
      panelGap: 8,
    },
  },
  {
    id: "focus",
    name: "Foco",
    tag: "ESSENCIAL",
    description: "Conversa ampla, formas retas e menos ruído.",
    layout: "focus",
    swatches: ["#101215", "#191c20", "#e5c18f"],
    theme: {
      skin: "studio",
      mode: "dark",
      m3Accent: "#e5c18f",
      cornerScale: 0,
      densityScale: 25,
      panelGap: 1,
      motion: "reduced",
    },
  },
] satisfies {
  id: string;
  name: string;
  tag: string;
  description: string;
  layout: "stoat" | "discord" | "focus";
  swatches: string[];
  theme: Partial<TypeTheme>;
}[];
