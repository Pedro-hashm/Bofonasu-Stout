import { isMobileApp } from "@revolt/common/lib/mobile";
import { useVoice } from "@revolt/rtc";
import { createEffect, createSignal, onCleanup, onMount, Show } from "solid-js";
import {
  type UpdateState,
  bundledReleases,
  bundledVersion,
  compareVersions,
  fetchPublicReleases,
  mergeReleases,
  releasesURL,
} from "../../../../../shared/updates";
import "./updates.css";

export { bundledVersion, compareVersions, releasesURL };
const initial: UpdateState = {
  currentVersion: window.native?.versions.desktop() ?? bundledVersion,
  status: "idle",
  mode: window.native ? "manual" : isMobileApp() ? "mobile" : "web",
  inCall: false,
  releases: bundledReleases,
};
export const [updateState, setUpdateState] = createSignal<UpdateState>(initial);
let checking: Promise<void> | undefined;
let checkedAt = 0;

export const hasAppUpdate = () =>
  !!updateState().downloadedVersion ||
  (!!updateState().latestVersion &&
    compareVersions(
      updateState().latestVersion!,
      updateState().currentVersion,
    ) > 0);

export async function checkUpdates(): Promise<void> {
  if (checking) return checking;
  if (Date.now() - checkedAt < 15000) return;
  checkedAt = Date.now();
  checking = (async () => {
    const bridge = window.native?.updates;
    if (bridge) {
      try {
        const state = await bridge.check();
        if (!state) throw new Error("Atualizador indisponível.");
        setUpdateState(state);
      } catch {
        setUpdateState((state) => ({
          ...state,
          status: "error",
          error: "Não foi possível verificar atualizações. Tente novamente.",
        }));
      }
      return;
    }
    setUpdateState((state) => ({
      ...state,
      status: "checking",
      error: undefined,
    }));
    try {
      const releases = await fetchPublicReleases();
      const latest = releases[0];
      setUpdateState((state) => ({
        ...state,
        releases: mergeReleases(releases),
        latestVersion: latest?.version,
        checkedAt: new Date().toISOString(),
        status: !latest
          ? "unpublished"
          : compareVersions(latest.version, state.currentVersion) > 0
            ? "available"
            : "current",
      }));
    } catch (error) {
      setUpdateState((state) => ({
        ...state,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar as versões.",
      }));
    }
  })().finally(() => {
    checking = undefined;
  });
  return checking;
}

/** One bridge for the whole application, including the call safety signal. */
export function DesktopUpdates() {
  const voice = useVoice();
  createEffect(() => window.native?.updates?.setInCall(!!voice.channel()));
  onMount(() => {
    const bridge = window.native?.updates;
    if (!bridge) return;
    let active = true;
    let changes = 0;
    const unsubscribe = bridge.subscribe((state) => {
      changes++;
      setUpdateState(state);
    });
    void bridge
      .getState()
      .then((state) => {
        if (active && !changes && state) setUpdateState(state);
      })
      .catch(() => {});
    onCleanup(() => {
      active = false;
      unsubscribe();
    });
  });
  return null;
}

export function UpdateDot() {
  return (
    <Show when={hasAppUpdate()}>
      <span class="updates-dot" aria-label="Atualização disponível" />
    </Show>
  );
}

export function UpdatesNavLabel() {
  return (
    <span class="updates-nav-label">
      Atualizações e novidades <UpdateDot />
    </span>
  );
}
