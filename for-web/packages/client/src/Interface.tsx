import { ChannelContextMenu, ServerContextMenu } from "@revolt/app";
import { MessageCache } from "@revolt/app/interface/channels/text/MessageCache";
import { Titlebar } from "@revolt/app/interface/desktop/Titlebar";
import { useClient, useClientLifecycle } from "@revolt/client";
import { State } from "@revolt/client/Controller";
import { NotificationsWorker } from "@revolt/client/NotificationsWorker";
import { useModals } from "@revolt/modal";
import { Navigate, useBeforeLeave, useLocation } from "@revolt/routing";
import { useState } from "@revolt/state";
import { LoadingScreen } from "@revolt/ui";
import { createEffect, JSX, Match, Switch } from "solid-js";
import { Server } from "stoat.js";
import { Sidebar } from "./interface/Sidebar";
import { Workspace, WorkspaceModule } from "./interface/workspace/Workspace";
import { WorkspaceVoice } from "./interface/workspace/WorkspaceVoice";

/** The shell owns geometry; route components own chat and permission behavior. */
export default function Interface(props: { children: JSX.Element }) {
  const state = useState();
  const client = useClient();
  const { openModal } = useModals();
  const { isLoggedIn, isSwapping, lifecycle } = useClientLifecycle();
  const location = useLocation();
  useBeforeLeave((e) => {
    if (e.defaultPrevented) return;
    if (e.to === "/settings") {
      e.preventDefault();
      openModal({ type: "settings", config: "user" });
    } else if (typeof e.to === "string") state.layout.setLastActivePath(e.to);
  });
  createEffect(() => {
    if (!isLoggedIn() && !isSwapping())
      state.auth.setNextPath(location.pathname);
  });
  const disconnected = () =>
    [
      State.Connecting,
      State.Disconnected,
      State.Reconnecting,
      State.Offline,
    ].includes(lifecycle.state());
  return (
    <MessageCache client={client()}>
      <div
        class="app_root"
        style={{
          display: "flex",
          "flex-direction": "column",
          height: "100%",
          "min-height": 0,
        }}
      >
        <Titlebar />
        <Switch fallback={<LoadingScreen />}>
          <Match when={!isLoggedIn()}>
            <Navigate href="/login" />
          </Match>
          <Match when={lifecycle.loadedOnce()}>
            <Workspace
              disconnected={disconnected()}
              onSettings={() => openModal({ type: "settings", config: "user" })}
            >
              <Sidebar
                menuGenerator={(target) => ({
                  contextMenu: () =>
                    target instanceof Server ? (
                      <ServerContextMenu server={target} />
                    ) : (
                      <ChannelContextMenu channel={target} />
                    ),
                })}
              />
              <WorkspaceModule id="conversation">
                <div class="app_body ws-route">{props.children}</div>
              </WorkspaceModule>
              <WorkspaceVoice />
            </Workspace>
          </Match>
        </Switch>
        <NotificationsWorker />
      </div>
    </MessageCache>
  );
}
