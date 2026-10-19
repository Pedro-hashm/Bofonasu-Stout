import { useLingui } from "@lingui/solid/macro";
import { getTrackReferenceId } from "@livekit/components-core";
import { Key } from "@solid-primitives/keyed";
import { createResizeObserver } from "@solid-primitives/resize-observer";
import { createEffect, onMount, Show } from "solid-js";
import { styled } from "styled-system/jsx";

import { useDevice } from "@revolt/common";
import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import { IconButton } from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { scrollableStyles } from "@revolt/ui/directives";
import {
  Armchair,
  ArrowLeftRight,
  ChevronDown,
  Expand,
  Maximize2,
  Minimize2,
  Shrink,
} from "lucide-solid";
import { CallControlButton } from "./CallControlButton";
import { CallControlsTray } from "./CallControlsTray";

import { LivingRoomCall } from "@revolt/rtc/living-room/LivingRoomCall";
import { ParticipantTile } from "./ParticipantTile";
import { VoiceCallCardActions } from "./VoiceCallCardActions";
import { VoiceCallCardStatus } from "./VoiceCallCardStatus";

/**
 * Call card (active)
 */
export function VoiceCallCardActiveRoom() {
  const state = useState();

  return (
    <View>
      <Show when={state.livingRoom.enabled} fallback={<Participants />}>
        <LivingRoomCall />
      </Show>
      <CallControlsTray>
        {(hide) => (
          <VoiceCallControls class="ws-call-controls">
            <VoiceCallControlHolder class="ws-call-control-holder" left>
              <VoiceCallCardStatus />
            </VoiceCallControlHolder>
            <VoiceCallCardActions size="sm" />
            <VoiceCallControlHolder class="ws-call-control-holder" right>
              <LayoutButtons onHideTray={hide} />
            </VoiceCallControlHolder>
          </VoiceCallControls>
        )}
      </CallControlsTray>
    </View>
  );
}

function LayoutButtons(props: { onHideTray: () => void }) {
  const voice = useVoice();
  const device = useDevice();
  const state = useState();
  const { t } = useLingui();
  return (
    <div class="call-layout-controls">
      <CallControlButton
        label={
          state.livingRoom.enabled
            ? "Usar grade de participantes"
            : "Usar Living Room"
        }
        pressed={state.livingRoom.enabled}
        onClick={() => (state.livingRoom.enabled = !state.livingRoom.enabled)}
      >
        <Armchair />
      </CallControlButton>
      <CallControlButton
        label="Esconder bandeja"
        onClick={() => props.onHideTray()}
      >
        <ChevronDown />
      </CallControlButton>
      <Show when={device.layout() === "desktop"}>
        <CallControlButton
          label="Trocar posições de conversa e chamada"
          onClick={() => state.layout.swapConversationVoice()}
        >
          <ArrowLeftRight />
        </CallControlButton>
        <CallControlButton
          label={
            voice.layout() === "expanded"
              ? t`Restore call window`
              : t`Maximize call window`
          }
          pressed={voice.layout() === "expanded"}
          onClick={() => voice.toggleLayout("expanded")}
        >
          <Show when={voice.layout() === "expanded"} fallback={<Maximize2 />}>
            <Minimize2 />
          </Show>
        </CallControlButton>
      </Show>
      <CallControlButton
        label={
          voice.layout() === "fullscreen" ? "Sair da tela cheia" : "Tela cheia"
        }
        pressed={voice.layout() === "fullscreen"}
        onClick={() => voice.toggleLayout("fullscreen")}
      >
        <Show when={voice.layout() === "fullscreen"} fallback={<Expand />}>
          <Shrink />
        </Show>
      </CallControlButton>
    </div>
  );
}
const TILE_MIN_WIDTH = "250px",
  TILE_MIN_FOCUS_HEIGHT = "100px";

/**
 * Show a grid of participants
 */
function Participants() {
  const voice = useVoice();
  const { t } = useLingui();

  let callRef: HTMLDivElement | undefined;

  const tileWidth = () => {
    const vidWidth = Math.round(100 / Math.max(1, voice.vidTracks().length));
    return `max(${TILE_MIN_WIDTH}, ${vidWidth}% - var(--gap-md))`;
  };

  // Clear out any focus when the track that was focused is no longer available.
  createEffect(() => {
    if (!voice.focusTrack()) voice.toggleFocus();
  });

  onMount(() => {
    createResizeObserver(callRef, ({ width, height }, el) => {
      if (el === callRef) {
        el.style.setProperty("--vc-w", `${width}px`);
        el.style.setProperty("--vc-h", `${height}px`);
      }
    });
  });

  return (
    <Call ref={callRef} class={voice.focusId() ? "" : scrollableStyles()}>
      <Show when={voice.room() && voice.state() === "CONNECTED"}>
        <FocusedParticipant />
        <Show when={voice.focusId()}>
          <ShowBarButtonHolder>
            <div style={{ "margin-bottom": "10px" }}>
              <IconButton
                size="xs"
                variant={"tonal"}
                onPress={() => voice.toggleShowBar()}
                use:floating={{
                  tooltip: {
                    placement: "top",
                    content: voice.showBar() ? t`Hide Others` : t`Show Others`,
                  },
                }}
              >
                <Show
                  when={voice.showBar()}
                  fallback={<Symbol>keyboard_arrow_up</Symbol>}
                >
                  <Symbol>keyboard_arrow_down</Symbol>
                </Show>
              </IconButton>
            </div>
          </ShowBarButtonHolder>
        </Show>
        <Grid
          focus={!!voice.focusId()}
          show={!voice.focusId() || voice.showBar()}
          class={voice.focusId() ? scrollableStyles({ direction: "x" }) : ""}
          style={{ "--vc-tile-width": tileWidth() }}
        >
          <Key
            each={voice.vidTracks().filter((t) => !voice.isFocus(t))}
            by={getTrackReferenceId}
          >
            {(reference) => <ParticipantTile reference={reference()} />}
          </Key>
        </Grid>
      </Show>
    </Call>
  );
}

function FocusedParticipant() {
  const voice = useVoice();

  return (
    <Show when={voice.focusTrack()}>
      <Key each={[voice.focusTrack()!]} by={getTrackReferenceId}>
        {(reference) => (
          <FocusBox>
            <ParticipantTile reference={reference()} focus />
          </FocusBox>
        )}
      </Key>
    </Show>
  );
}

const View = styled("div", {
  base: {
    minHeight: 0,
    height: "100%",
    width: "100%",

    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 0,
    padding: "var(--gap-md)",
    transition: "padding var(--transitions-medium)",
  },
});

const VoiceCallControls = styled("div", {
  base: {
    display: "flex",
    flexShrink: 0,
    overflow: "hidden",
  },
});

const VoiceCallControlHolder = styled("div", {
  base: {
    display: "flex",
    flex: 1,
    alignSelf: "center",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    opacity: 1,
    transition: "opacity var(--transitions-medium)",
  },
  variants: {
    left: {
      true: {
        justifyContent: "flex-start",
        overflow: "hidden",
      },
    },
    right: {
      true: {
        justifyContent: "flex-end",
      },
    },
  },
});

const ShowBarButtonHolder = styled("div", {
  base: {
    height: 0,
    alignSelf: "center",
    overflow: "visible",
    display: "flex",
    flexDirection: "column-reverse",
  },
});

const Call = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",
    flexGrow: 1,
    flexBasis: 0,
    width: "100%",
    minHeight: 0,
  },
});

const Grid = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "safe center",
    alignContent: "safe center",
    flex: "1 1 0%",
    minHeight: 0,
    width: "100%",
    gap: "var(--gap-md)",
  },

  variants: {
    focus: {
      true: {
        flex: "0 0 auto",
        flexDirection: "column",
        height: `max(20%, ${TILE_MIN_FOCUS_HEIGHT})`,
        minHeight: 0,
        transition: "height .3s ease",

        "& .vc_tile": {
          width: "auto",
          height: "100%",
        },
      },
    },
    show: {
      false: {
        height: 0,
        overflow: "hidden",
      },
    },
  },
});

const FocusBox = styled("div", {
  base: {
    height: 0,
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    margin: "0 auto",
  },
});
