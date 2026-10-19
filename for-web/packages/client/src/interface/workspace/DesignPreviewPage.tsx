import { SoundContext } from "@revolt/client/Sounds";
import { StateContext, useState } from "@revolt/state";
import {
  createMaterialColourVariables,
  createMduiColourTriplets,
  createStoatWebVariables,
} from "@revolt/ui/themes";
import { FONTS } from "@revolt/ui/themes/fonts";
import { Masks } from "@revolt/ui/themes/Masks";
import { createEffect, onCleanup, onMount } from "solid-js";
import { WorkspacePreview } from "./WorkspacePreview";

const STORAGE_KEY = "stoat:design-preview:v1";
/** Independent state and storage: no backend initialization or account preferences. */
export function DesignPreviewPage() {
  return (
    <StateContext>
      <SoundContext>
        <PreviewTheme />
        <WorkspacePreview />
      </SoundContext>
    </StateContext>
  );
}
function PreviewTheme() {
  const state = useState();
  let restored = false;
  let timer: ReturnType<typeof setTimeout>;
  onMount(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && raw.length < 2_000_000) {
        const value = JSON.parse(raw);
        state.theme.applyPreset(state.theme.clean(value.theme));
        state.set("layout", false, state.layout.clean(value.layout));
        state.set("sounds", false, state.sounds.clean(value.sounds));
        state.set(
          "livingRoom",
          false,
          state.livingRoom.clean(value.livingRoom),
        );
      }
    } catch {
      /* An invalid demo snapshot never prevents opening the preview. */
    }
    restored = true;
  });
  createEffect(() => {
    const theme = state.theme.activeTheme;
    const variables = {
      ...createStoatWebVariables(theme),
      ...createMaterialColourVariables(theme, "--md-sys-color-"),
      ...createMduiColourTriplets(theme, "--mdui-color-"),
    };
    for (const [key, value] of Object.entries(variables))
      document.body.style.setProperty(key, value);
    document.body.dataset.uiSkin = theme.skin;
    document.body.dataset.uiMotion = theme.motion;
    document.body.style.colorScheme = theme.darkMode ? "dark" : "light";
    document.documentElement.style.fontSize = `${(16 * theme.fontScale) / 100}px`;
    void FONTS[state.theme.interfaceFont].load();
    const snapshot = JSON.stringify({
      theme: state.get("theme"),
      layout: state.get("layout"),
      sounds: state.get("sounds"),
      livingRoom: state.get("livingRoom"),
    });
    clearTimeout(timer);
    if (restored)
      timer = setTimeout(
        () => localStorage.setItem(STORAGE_KEY, snapshot),
        250,
      );
  });
  onCleanup(() => clearTimeout(timer));
  return <Masks />;
}
