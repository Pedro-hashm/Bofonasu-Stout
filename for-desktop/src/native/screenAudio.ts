import { release } from "node:os";

/** Use Chromium's process-excluding WASAPI route on supported Windows versions.
 * Electron 44.3 accepts this device ID in its display-media callback, and uses
 * the same ID when restrictOwnAudio is propagated successfully. Selecting it
 * here also covers requests where the renderer/browser loses that constraint.
 * See electron_browser_context.cc and media/audio/win/audio_low_latency_input_win.cc.
 * Keep ordinary loopback for platforms that cannot open the Windows device.
 */
export function screenAudioDevice(): string {
  const [major, , build] = release().split(".").map(Number);
  if (
    process.platform === "win32" &&
    (major > 10 || (major === 10 && build >= 22000))
  )
    return "loopbackWithoutChrome";
  return "loopback";
}
