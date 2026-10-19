import { describe, expect, it } from "vitest";

import {
  createShapeDensityVariables,
  createStoatWebVariables,
} from "../../ui/themes/stoatWebTheme";
import type { SelectedTheme } from "./Theme";
import {
  cleanFrame,
  cleanWidgetConfigs,
  cleanWidgetOrder,
  createDefaultWidgets,
  GRID,
  LAYOUT_WIDGETS,
} from "./layoutPreferences";

describe("layout preference validation", () => {
  it("drops unknown and duplicate widget ids while retaining every known block", () => {
    expect(cleanWidgetOrder(["channels", "unknown", "channels"])).toEqual([
      "channels",
      ...LAYOUT_WIDGETS.filter((id) => id !== "channels"),
    ]);
  });

  it("clamps stored widths and ignores malformed block values", () => {
    expect(
      cleanWidgetConfigs({
        channels: { visible: false, width: 99999 },
        members: { visible: true, width: 12 },
        unknown: { visible: false, width: 0 },
        voice: null,
      }),
    ).toMatchObject({
      channels: { visible: false, width: 1200 },
      members: { visible: true, width: 56 },
      voice: { visible: true, width: 248 },
    });
  });

  it("generates square corners and compact spacing tokens", () => {
    const variables = createShapeDensityVariables(0, 0) as Record<
      string,
      string
    >;
    expect(variables["--borderRadius-md"]).toBe("0px");
    expect(variables["--borderRadius-circle"]).toBe("0%");
    expect(variables["--md-sys-shape-corner-full"]).toBe("0px");
    expect(variables["--mdui-shape-corner-large"]).toBe("0px");
    expect(variables["--gap-md"]).toBe("6px");
  });

  it("keeps pastel accents legible in light mode and honors disabled motion", () => {
    const theme: SelectedTheme = {
      skin: "studio",
      preset: "you",
      blur: false,
      interfaceFont: "Inter",
      monospaceFont: "Fira Code",
      messageSize: 14,
      messageGroupSpacing: 12,
      motion: "off",
      panelGap: 6,
      fontScale: 100,
      colors: {},
      widgetBackgrounds: {},
      widgetAccents: {},
      widgetCorners: {},
      widgetDensities: {},
      darkMode: true,
      accent: "#8cdbb5",
      contrast: 0,
      variant: "tonal_spot",
      cornerScale: 35,
      densityScale: 50,
    };
    const dark = createStoatWebVariables(theme);
    expect(dark["--ws-on-accent"]).toBe("#101215");
    const light = createStoatWebVariables({ ...theme, darkMode: false });
    expect(light["--ws-accent"]).not.toBe(theme.accent);
    expect(light["--ws-on-accent"]).toBe("#ffffff");
    expect(light["--transitions-fast"]).toBe("0s ease-in-out");
  });

  it("keeps every shipped preset inside the canvas without overlapping visible panels", () => {
    for (const preset of ["stoat", "discord", "focus"] as const) {
      const widgets = createDefaultWidgets(preset);
      const visible = Object.values(widgets).filter((widget) => widget.visible);
      for (const { frame } of visible) {
        expect(frame.x).toBeGreaterThanOrEqual(0);
        expect(frame.y).toBeGreaterThanOrEqual(0);
        expect(frame.x + frame.w).toBeLessThanOrEqual(GRID.columns);
        expect(frame.y + frame.h).toBeLessThanOrEqual(GRID.rows);
      }
      for (let a = 0; a < visible.length; a++)
        for (let b = a + 1; b < visible.length; b++) {
          const one = visible[a].frame,
            two = visible[b].frame;
          expect(
            one.x + one.w <= two.x ||
              two.x + two.w <= one.x ||
              one.y + one.h <= two.y ||
              two.y + two.h <= one.y,
          ).toBe(true);
        }
    }
  });

  it("recovers corrupted geometry and always preserves the conversation", () => {
    const widgets = cleanWidgetConfigs({
      conversation: {
        visible: false,
        frame: { x: -999, y: 999, w: Infinity, h: NaN },
      },
      channels: { frame: { x: 999, y: -1, w: 0.3, h: 800 } },
    });
    expect(widgets.conversation.visible).toBe(true);
    expect(widgets.conversation.frame).toEqual({ x: 0, y: 0, w: 27, h: 36 });
    expect(widgets.channels.frame).toEqual({ x: 42, y: 0, w: 6, h: 36 });
    expect(cleanWidgetConfigs(null)).toEqual(createDefaultWidgets());
  });

  it("snaps fractional positions to the grid and clamps dragging beyond the window", () => {
    const fallback = createDefaultWidgets().conversation.frame;
    expect(
      cleanFrame(
        "conversation",
        { x: 10.7, y: -20, w: 18.2, h: 14.8 },
        fallback,
      ),
    ).toEqual({ x: 11, y: 0, w: 18, h: 15 });
    expect(
      cleanFrame("conversation", { x: 999, y: 999, w: 18, h: 15 }, fallback),
    ).toEqual({ x: 30, y: 21, w: 18, h: 15 });
  });

  it("retains visibility and geometry through a local JSON round trip", () => {
    const before = createDefaultWidgets();
    before.members.visible = false;
    before.voice.frame = { x: 20, y: 2, w: 16, h: 10 };
    expect(cleanWidgetConfigs(JSON.parse(JSON.stringify(before)))).toEqual(
      before,
    );
  });
});
