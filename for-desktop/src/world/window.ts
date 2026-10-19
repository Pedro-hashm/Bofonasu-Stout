import { contextBridge, ipcRenderer } from "electron";

import type { UpdateBridge, UpdateState } from "../../../shared/updates";
import { version } from "../../package.json";

const updates: UpdateBridge = {
  getState: () => ipcRenderer.invoke("bofonasu:updates:state"),
  check: () => ipcRenderer.invoke("bofonasu:updates:check"),
  install: () => ipcRenderer.invoke("bofonasu:updates:install"),
  openDownload: () => ipcRenderer.invoke("bofonasu:updates:open"),
  setInCall: (value) => ipcRenderer.send("bofonasu:updates:call", value),
  subscribe(callback) {
    const listener = (_event: Electron.IpcRendererEvent, state: UpdateState) =>
      callback(state);
    ipcRenderer.on("bofonasu:updates:changed", listener);
    return () => {
      ipcRenderer.removeListener("bofonasu:updates:changed", listener);
    };
  },
};

contextBridge.exposeInMainWorld("native", {
  updates,
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    desktop: () => version,
  },

  minimise: () => ipcRenderer.send("minimise"),
  maximise: () => ipcRenderer.send("maximise"),
  close: () => ipcRenderer.send("close"),

  setBadgeCount: (count: number) => ipcRenderer.send("setBadgeCount", count),

  onceScreenPicker: (
    onScreenPick: (
      sources: {
        idx: number;
        name: string;
        isFullScreen: boolean;
        image?: string;
      }[],
    ) => void,
  ) => {
    const eventName = "screenPicker";
    ipcRenderer.removeAllListeners(eventName);
    ipcRenderer.once(eventName, (_, sources) => onScreenPick(sources));
  },
  screenPickerCallback: (idx: number, audio: boolean) =>
    ipcRenderer.send("screenPickerCallback", idx, audio),

  isWayland: () => ipcRenderer.invoke("getIsWayland"),
});
