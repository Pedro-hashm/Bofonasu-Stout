import { createSignal, onCleanup, onMount } from "solid-js";

declare global {
  interface Window {
    Capacitor?: { getPlatform?: () => string };
  }
}

export const mobilePlatform = () => window.Capacitor?.getPlatform?.();
export const isMobileApp = () =>
  ["android", "ios"].includes(mobilePlatform() ?? "");

/** Native tablets keep the touch UI even in landscape; browsers follow width. */
export function useMobileLayout() {
  const media = window.matchMedia("(max-width: 899px)");
  const [mobile, setMobile] = createSignal(isMobileApp() || media.matches);
  onMount(() => {
    const update = () => setMobile(isMobileApp() || media.matches);
    media.addEventListener("change", update);
    onCleanup(() => media.removeEventListener("change", update));
  });
  return mobile;
}
