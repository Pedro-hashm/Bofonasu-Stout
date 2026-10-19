/** Resolution independent grid shared by the canvas, presets and validation. */
export const GRID = { columns: 48, rows: 36 } as const;
export const LAYOUT_WIDGETS = [
  "navigation",
  "channels",
  "conversation",
  "members",
  "voice",
] as const;
export type LayoutWidgetId = (typeof LAYOUT_WIDGETS)[number];
export type GridFrame = { x: number; y: number; w: number; h: number };
export interface LayoutWidgetConfig {
  visible: boolean;
  /** Retained for migrating older installations. The workspace uses frame. */
  width: number;
  frame: GridFrame;
}
export const MODULES: Record<
  LayoutWidgetId,
  { label: string; description: string; minW: number; minH: number }
> = {
  navigation: {
    label: "Servidores",
    description: "Comunidades, pastas e conta",
    minW: 2,
    minH: 6,
  },
  channels: {
    label: "Canais",
    description: "Canais e mensagens diretas",
    minW: 6,
    minH: 8,
  },
  conversation: {
    label: "Conversa",
    description: "Mensagens, anexos e composição",
    minW: 8,
    minH: 6,
  },
  members: {
    label: "Pessoas",
    description: "Membros, busca e mensagens fixadas",
    minW: 6,
    minH: 8,
  },
  voice: {
    label: "Chamada",
    description: "Voz, vídeo e compartilhamento",
    minW: 8,
    minH: 6,
  },
};
const finite = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.round(value)
    : fallback;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export function cleanFrame(
  id: LayoutWidgetId,
  value: Partial<GridFrame> | undefined,
  fallback: GridFrame,
): GridFrame {
  const w = clamp(finite(value?.w, fallback.w), MODULES[id].minW, GRID.columns);
  const h = clamp(finite(value?.h, fallback.h), MODULES[id].minH, GRID.rows);
  return {
    x: clamp(finite(value?.x, fallback.x), 0, GRID.columns - w),
    y: clamp(finite(value?.y, fallback.y), 0, GRID.rows - h),
    w,
    h,
  };
}
export function createDefaultWidgets(
  style: "stoat" | "discord" | "focus" = "stoat",
): Record<LayoutWidgetId, LayoutWidgetConfig> {
  const frames: Record<LayoutWidgetId, GridFrame> = {
    navigation: { x: 0, y: 0, w: 3, h: 36 },
    channels: { x: 3, y: 0, w: 9, h: 27 },
    conversation: { x: 12, y: 0, w: 27, h: 36 },
    members: { x: 39, y: 0, w: 9, h: 36 },
    voice: { x: 3, y: 27, w: 9, h: 9 },
  };
  if (style === "discord") {
    frames.channels.h = 29;
    frames.voice = { x: 3, y: 29, w: 9, h: 7 };
  }
  if (style === "focus") {
    frames.channels.h = 36;
    frames.conversation.w = 36;
  }
  return Object.fromEntries(
    LAYOUT_WIDGETS.map((id) => [
      id,
      {
        visible: style !== "focus" || !["members", "voice"].includes(id),
        width: id === "navigation" ? 72 : id === "conversation" ? 640 : 248,
        frame: frames[id],
      },
    ]),
  ) as Record<LayoutWidgetId, LayoutWidgetConfig>;
}
export function cleanWidgetOrder(input: unknown): LayoutWidgetId[] {
  const valid = Array.isArray(input)
    ? input.filter((id): id is LayoutWidgetId => LAYOUT_WIDGETS.includes(id))
    : [];
  return [...new Set([...valid, ...LAYOUT_WIDGETS])];
}
export function cleanWidgetConfigs(input: unknown) {
  const widgets = createDefaultWidgets();
  if (!input || typeof input !== "object") return widgets;
  for (const id of LAYOUT_WIDGETS) {
    const value = (input as Record<string, Partial<LayoutWidgetConfig> | null>)[
      id
    ];
    if (!value || typeof value !== "object") continue;
    if (typeof value.visible === "boolean") widgets[id].visible = value.visible;
    if (typeof value.width === "number" && Number.isFinite(value.width))
      widgets[id].width = clamp(value.width, 56, 1200);
    widgets[id].frame = cleanFrame(id, value.frame, widgets[id].frame);
  }
  widgets.conversation.visible = true;
  return widgets;
}

/** Temporary call expansion; saved module rectangles remain untouched. */
export function enclosingFrame(a: GridFrame, b: GridFrame): GridFrame {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}
