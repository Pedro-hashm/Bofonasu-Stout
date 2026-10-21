declare global {
  interface Window {
    Capacitor?: { getPlatform?: () => string };
  }
}

export const mobilePlatform = () => window.Capacitor?.getPlatform?.();
export const isMobileApp = () =>
  ["android", "ios"].includes(mobilePlatform() ?? "");
