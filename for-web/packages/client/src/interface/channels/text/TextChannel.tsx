import {
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";
import { decodeTime, ulid } from "ulid";

import { DraftMessages, Messages } from "@revolt/app";
import { useClient } from "@revolt/client";
import { Keybind, KeybindAction, createKeybind } from "@revolt/keybinds";
import { useNavigate, useSmartParams } from "@revolt/routing";
import { BelowFloatingHeader, Header, NewMessages, Text } from "@revolt/ui";

import { ChannelHeader } from "../ChannelHeader";
import { ChannelPageProps } from "../ChannelPage";

import { Channel } from "stoat.js";
import { WorkspaceModule, useWorkspace } from "../../workspace/Workspace";
import { MessageComposition } from "./Composition";
import { isLargeServer } from "./largeServer";
import { MemberSidebar } from "./MemberSidebar";
import { TextSearchSidebar } from "./TextSearchSidebar";

/**
 * State of the channel sidebar
 */
export type SidebarState =
  | {
      state: "search";
      query: string;
    }
  | {
      state: "pins";
    }
  | {
      state: "default";
    };

export function canIHasSidebar(ch: Channel) {
  return !["SavedMessages", "DirectMessage"].includes(ch.type);
}

/**
 * Channel component
 */
export function TextChannel(props: ChannelPageProps) {
  const client = useClient();
  const workspace = useWorkspace();
  const conversationVisible = () => workspace?.visible("conversation") ?? true;

  // Last unread message id
  const [lastId, setLastId] = createSignal<string>();

  // Read highlighted message id from parameters
  const params = useSmartParams();
  const navigate = useNavigate();

  /**
   * Message id to be highlighted
   * @returns Message Id
   */
  const highlightMessageId = () => params().messageId;

  const canConnect = () =>
    props.channel.isVoice && props.channel.havePermission("Connect");

  // Get a reference to the message box's load latest function
  let jumpToBottomRef: ((nearby?: string) => void) | undefined;

  const [atEnd, setEnd] = createSignal(true);

  // Store last unread message id
  createEffect(
    on(
      () => props.channel.id,
      (id) =>
        setLastId(
          props.channel.unread
            ? (client().channelUnreads.get(id)?.lastMessageId as string)
            : undefined,
        ),
    ),
  );

  // Mark channel as read whenever it is marked as unread
  createEffect(
    on(
      // must be at the end of the conversation
      () => props.channel.unread && atEnd() && conversationVisible(),
      (unread) => {
        if (unread) {
          if (document.hasFocus()) {
            // acknowledge the message
            props.channel.ack();
          } else {
            // otherwise mark this location as the last read location
            if (!lastId()) {
              // (taking away one second from the seed)
              setLastId(ulid(decodeTime(props.channel.lastMessageId!) - 1));
            }
          }
        }
      },
    ),
  );

  // Mark as read on re-focus
  function onFocus() {
    if (props.channel.unread && atEnd() && conversationVisible()) {
      props.channel.ack();
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible") onFocus();
  }

  // Chromium + webkit
  window.addEventListener("focus", onFocus);
  // Gecko
  document.addEventListener("focus", onFocus);
  // Mobile (eg. unlock screen)
  document.addEventListener("visibilitychange", onVisibilityChange);
  onCleanup(() => {
    // Mobile
    document.removeEventListener("visibilitychange", onVisibilityChange);
    // Gecko
    document.removeEventListener("focus", onFocus);
    // Chromium + webkit
    window.removeEventListener("focus", onFocus);
  });

  // Register ack/jump latest
  createKeybind(KeybindAction.CHAT_JUMP_END, () => {
    // Mark channel as read if not already
    if (props.channel.unread) {
      props.channel.ack();
    }

    // Clear the last unread id
    if (lastId()) {
      setLastId(undefined);
    }

    // Scroll to the bottom
    jumpToBottomRef?.();
  });

  // Sidebar scroll target
  let sidebarScrollTargetElement!: HTMLDivElement;

  // Sidebar state
  const [sidebarState, setSidebarState] = createSignal<SidebarState>({
    state: "default",
  });
  createEffect(() => {
    if (sidebarState().state !== "default") workspace?.reveal("members");
  });

  // todo: in the future maybe persist per ID?
  createEffect(
    on(
      () => props.channel.id,
      () => setSidebarState({ state: "default" }),
    ),
  );

  // If this is a server text channel, sync the members
  // todo: useQuery
  createEffect(
    on(
      () => props.channel.serverId,
      (serverId, prevServerId) =>
        // This effect tracks channel, not serverId, therefore we must ensure the old serverId
        // is not the same as the current serverId
        prevServerId !== serverId &&
        props.channel.type === "TextChannel" &&
        props.channel.server?.syncMembers(isLargeServer(props.channel.server)),
    ),
  );

  return (
    <>
      <Header placement="primary" class="ws-channel-header">
        <ChannelHeader
          channel={props.channel}
          sidebarState={sidebarState}
          setSidebarState={setSidebarState}
        />
      </Header>
      <div class="ws-conversation-body">
        <main class="ws-chat-main">
          <Show when={!canConnect()}>
            <BelowFloatingHeader>
              <div>
                <NewMessages
                  lastId={lastId}
                  jumpBack={() => navigate(lastId()!)}
                  dismiss={() => setLastId()}
                />
              </div>
            </BelowFloatingHeader>
          </Show>

          <Messages
            channel={props.channel}
            lastReadId={lastId}
            pendingMessages={(pendingProps) => (
              <DraftMessages
                channel={props.channel}
                tail={pendingProps.tail}
                sentIds={pendingProps.ids}
              />
            )}
            highlightedMessageId={highlightMessageId}
            clearHighlightedMessage={() => navigate(".")}
            jumpToBottomRef={(ref) => (jumpToBottomRef = ref)}
            atEnd={[atEnd, setEnd]}
          />

          <MessageComposition
            channel={props.channel}
            onMessageSend={() => jumpToBottomRef?.()}
          />
        </main>
      </div>
      <Show
        when={
          canIHasSidebar(props.channel) || sidebarState().state !== "default"
        }
      >
        <WorkspaceModule id="members">
          <div
            ref={sidebarScrollTargetElement}
            use:scrollable={{
              direction: "y",
              showOnHover: true,
              class: sidebar(),
            }}
            style={{
              width: "100%",
              height: "100%",
            }}
          >
            <Switch
              fallback={
                <MemberSidebar
                  channel={props.channel}
                  scrollTargetElement={sidebarScrollTargetElement}
                  isLargeServer={isLargeServer(props.channel.server)}
                />
              }
            >
              <Match when={sidebarState().state === "search"}>
                <WideSidebarContainer>
                  <SidebarTitle>
                    <Text class="label" size="large">
                      Search Results
                    </Text>
                  </SidebarTitle>
                  <TextSearchSidebar
                    channel={props.channel}
                    query={{
                      query: (sidebarState() as { query: string }).query,
                    }}
                  />
                </WideSidebarContainer>
              </Match>
              <Match when={sidebarState().state === "pins"}>
                <WideSidebarContainer>
                  <SidebarTitle>
                    <Text class="label" size="large">
                      Pinned Messages
                    </Text>
                  </SidebarTitle>
                  <TextSearchSidebar
                    channel={props.channel}
                    query={{ pinned: true, sort: "Latest" }}
                  />
                </WideSidebarContainer>
              </Match>
            </Switch>

            <Show when={sidebarState().state !== "default"}>
              <Keybind
                keybind={KeybindAction.CLOSE_SIDEBAR}
                onPressed={() => {
                  setSidebarState({ state: "default" });
                  if (workspace?.narrow()) workspace.reveal("conversation");
                }}
              />
            </Show>
          </div>
        </WorkspaceModule>
      </Show>
    </>
  );
}

/**
 * Base styles
 */
const sidebar = cva({
  base: {
    flexShrink: 0,
    width: "var(--layout-width-channel-sidebar)",
    // margin: "var(--gap-md)",
    borderRadius: "var(--borderRadius-lg)",
    // color: "var(--colours-sidebar-channels-foreground)",
    // background: "var(--colours-sidebar-channels-background)",
  },
});

/**
 * Container styles
 */
const WideSidebarContainer = styled("div", {
  base: {
    paddingRight: "var(--gap-md)",
    width: "100%",
  },
});

/**
 * Sidebar title
 */
const SidebarTitle = styled("div", {
  base: {
    padding: "var(--gap-md)",
    color: "var(--md-sys-color-on-surface)",
  },
});
