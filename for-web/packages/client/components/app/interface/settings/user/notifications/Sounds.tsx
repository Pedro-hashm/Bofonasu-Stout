import { Trans, useLingui } from "@lingui/solid/macro";
import MdVolumeUp from "@material-design-icons/svg/outlined/volume_up.svg?component-solid";
import { useSound } from "@revolt/client";
import { useState } from "@revolt/state";
import type { SoundName } from "@revolt/state/stores/Sounds";
import { CategoryButton, Checkbox, Column, Text, iconSize } from "@revolt/ui";
import { For } from "solid-js";
import { styled } from "styled-system/jsx";

export default function Sounds() {
  const { sounds } = useState();
  const controller = useSound();
  const { t } = useLingui();
  const entries = (): { name: SoundName; label: string }[] => [
    { name: "uiClick", label: t`Interface clicks` },
    { name: "message", label: t`Message Received` },
    { name: "mute", label: t`Mute` },
    { name: "unmute", label: t`Unmute` },
    { name: "deafen", label: t`Deafen` },
    { name: "undeafen", label: t`Undeafen` },
    { name: "userJoinVoice", label: t`User Join Voice Channel` },
    { name: "userLeaveVoice", label: t`User Leave Voice Channel` },
    { name: "streamStart", label: t`Stream Start` },
    { name: "streamEnd", label: t`Stream End` },
    { name: "cameraOn", label: t`Start camera` },
    { name: "cameraOff", label: t`Stop camera` },
    { name: "streamViewerJoin", label: t`Stream viewer joined` },
    { name: "streamViewerLeave", label: t`Stream viewer left` },
    { name: "userMoved", label: t`User moved channels` },
    { name: "ringtoneIncoming", label: t`Incoming call` },
    { name: "ringtoneOutgoing", label: t`Outgoing call` },
  ];
  return (
    <Column gap="md">
      <Text class="title">
        <Trans>Sounds</Trans>
      </Text>
      <label>
        <Trans>Sound effects volume</Trans>: {Math.round(sounds.volume * 100)}%
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          aria-label={t`Sound effects volume`}
          style={{
            width: "100%",
            "accent-color": "var(--md-sys-color-primary)",
          }}
          value={Math.round(sounds.volume * 100)}
          onInput={(event) =>
            sounds.setVolume(Number(event.currentTarget.value) / 100)
          }
        />
      </label>
      <CategoryButton.Group>
        <For each={entries()}>
          {(entry) => (
            <CategoryButton
              icon="blank"
              action={<Checkbox checked={sounds.enabled(entry.name)} />}
              onClick={() => sounds.toggle(entry.name)}
            >
              <Content>
                <span>{entry.label}</span>
                <button
                  type="button"
                  class="ws-icon-button"
                  data-ui-sound="off"
                  aria-label={`${t`Play sound`}: ${entry.label}`}
                  title={t`Play sound`}
                  onClick={(event) => {
                    event.stopPropagation();
                    controller.playSound(entry.name, true);
                  }}
                >
                  <MdVolumeUp {...iconSize(18)} />
                </button>
              </Content>
            </CategoryButton>
          )}
        </For>
      </CategoryButton.Group>
    </Column>
  );
}
const Content = styled("div", {
  base: {
    display: "flex",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
});
