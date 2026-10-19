import { existsSync } from "node:fs";
import path from "node:path";

import {
  BrowserWindow,
  IpcMainEvent,
  IpcMainInvokeEvent,
  app,
  autoUpdater,
  ipcMain,
  shell,
} from "electron";

import {
  type UpdateState,
  bundledReleases,
  compareVersions,
  fetchPublicReleases,
  mergeReleases,
  releasesURL,
} from "../../../shared/updates";

/** Own the download lifecycle in main; a renderer can neither set feeds nor install arbitrary files. */
export function initUpdates(
  getWindow: () => BrowserWindow | undefined,
  prepareForRestart: () => void,
) {
  const installed =
    app.isPackaged &&
    process.platform === "win32" &&
    process.arch === "x64" &&
    existsSync(path.join(path.dirname(process.execPath), "..", "Update.exe"));
  let state: UpdateState = {
    currentVersion: app.getVersion(),
    status: "idle",
    mode: !app.isPackaged ? "development" : installed ? "automatic" : "manual",
    inCall: false,
    releases: bundledReleases,
  };
  let checking: Promise<UpdateState> | undefined;
  let downloading = false;
  let pendingVersion: string | undefined;
  let lastAttempt = 0;

  const send = (patch: Partial<UpdateState>) => {
    state = { ...state, ...patch };
    const window = getWindow();
    if (window && !window.isDestroyed())
      window.webContents.send("bofonasu:updates:changed", state);
    return state;
  };
  const trusted = (event: IpcMainEvent | IpcMainInvokeEvent) => {
    const window = getWindow();
    return (
      !!window &&
      event.sender === window.webContents &&
      event.senderFrame === event.sender.mainFrame
    );
  };

  async function performCheck(): Promise<UpdateState> {
    lastAttempt = Date.now();
    send({ status: "checking", error: undefined });
    try {
      const releases = await fetchPublicReleases();
      const latest = releases[0];
      send({
        releases: mergeReleases(releases),
        latestVersion: latest?.version,
        checkedAt: new Date().toISOString(),
      });
      if (!latest)
        return send({
          status: state.downloadedVersion ? "ready" : "unpublished",
        });
      if (compareVersions(latest.version, state.currentVersion) <= 0)
        return send({ status: state.downloadedVersion ? "ready" : "current" });
      if (
        state.downloadedVersion &&
        compareVersions(state.downloadedVersion, latest.version) >= 0
      )
        return send({ status: "ready" });
      send({ status: "available" });
      if (installed && latest.feedURL) {
        // checkForUpdates downloads automatically. Never call it twice while busy.
        pendingVersion = latest.version;
        downloading = true;
        autoUpdater.setFeedURL({ url: latest.feedURL });
        autoUpdater.checkForUpdates();
      }
      return state;
    } catch (error) {
      downloading = false;
      return send({
        status: state.downloadedVersion ? "ready" : "error",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível verificar atualizações.",
      });
    }
  }

  function check(): Promise<UpdateState> {
    if (checking) return checking;
    if (downloading || Date.now() - lastAttempt < 15000)
      return Promise.resolve(state);
    checking = performCheck().finally(() => {
      checking = undefined;
    });
    return checking;
  }

  if (installed) {
    autoUpdater.on("checking-for-update", () => send({ status: "checking" }));
    autoUpdater.on("update-available", () =>
      send({ status: "downloading", error: undefined }),
    );
    autoUpdater.on("update-not-available", () => {
      downloading = false;
      send({ status: state.downloadedVersion ? "ready" : "available" });
    });
    autoUpdater.on("update-downloaded", () => {
      downloading = false;
      send({
        status: "ready",
        downloadedVersion: pendingVersion,
        error: undefined,
      });
    });
    autoUpdater.on("error", () => {
      downloading = false;
      send({
        status: state.downloadedVersion ? "ready" : "error",
        error:
          "Não foi possível baixar a atualização. Tente novamente nas configurações.",
      });
    });
    // quitAndInstall closes windows before app.before-quit. Release the tray
    // close interception first, or the update would only hide the window.
    autoUpdater.on("before-quit-for-update", prepareForRestart);
  }

  ipcMain.handle("bofonasu:updates:state", (event) =>
    trusted(event) ? state : undefined,
  );
  ipcMain.handle("bofonasu:updates:check", (event) =>
    trusted(event) ? check() : undefined,
  );
  ipcMain.on("bofonasu:updates:call", (event, inCall: unknown) => {
    if (trusted(event) && typeof inCall === "boolean") send({ inCall });
  });
  ipcMain.handle("bofonasu:updates:install", (event) => {
    if (
      !trusted(event) ||
      !installed ||
      !state.downloadedVersion ||
      state.inCall
    )
      return false;
    prepareForRestart();
    autoUpdater.quitAndInstall();
    return true;
  });
  ipcMain.handle("bofonasu:updates:open", async (event) => {
    if (!trusted(event)) return;
    const latest = state.releases.find(
      (release) => release.published && release.version === state.latestVersion,
    );
    await shell.openExternal(latest?.downloadURL ?? releasesURL);
  });

  // Metadata and downloads are automatic only in distributed builds.
  if (app.isPackaged) {
    const startup = setTimeout(
      () => void check(),
      app.commandLine.hasSwitch("squirrel-firstrun") ? 15000 : 1000,
    );
    const interval = setInterval(() => void check(), 30 * 60 * 1000);
    startup.unref();
    interval.unref();
    app.once("before-quit", () => {
      clearTimeout(startup);
      clearInterval(interval);
    });
  }
}
