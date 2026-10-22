import { useLingui } from "@lingui/solid/macro";
import { useInstance } from "@revolt/instance";
import { useVoice } from "@revolt/rtc";
import { SoundboardButton } from "@revolt/rtc/soundboard/SoundboardControls";
import { useState } from "@revolt/state";
import { useNavigate } from "@solidjs/router";
import {
  ArrowUpLeft,
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-solid";
import { Show } from "solid-js";
import { CallControlButton } from "./CallControlButton";

export function VoiceCallCardActions(props: { size: "xs" | "sm" | "compact" }) {
  const voice = useVoice();
  const state = useState();
  const navigate = useNavigate();
  const { t } = useLingui();
  const { limits } = useInstance();
  return (
    <div
      class="ws-call-actions"
      data-ui-sound="off"
      data-size={props.size}
      role="group"
      aria-label={t`Call controls`}
    >
      <Show when={props.size === "xs"}>
        <CallControlButton
          label={t`Return to voice channel`}
          onClick={() => {
            navigate(voice.channel()?.path ?? "");
            state.appDrawer()?.setShown(true);
          }}
        >
          <ArrowUpLeft />
        </CallControlButton>
      </Show>
      <CallControlButton
        label={
          !voice.speakingPermission
            ? t`Missing permission`
            : voice.microphone()
              ? t`Mute`
              : t`Unmute`
        }
        disabled={!voice.speakingPermission}
        pressed={!voice.microphone()}
        tone={!voice.microphone() ? "muted" : undefined}
        onClick={() => voice.toggleMute()}
      >
        <Show when={voice.microphone()} fallback={<MicOff />}>
          <Mic />
        </Show>
      </CallControlButton>
      <CallControlButton
        label={
          !voice.listenPermission
            ? t`Missing permission`
            : voice.deafen()
              ? t`Undeafen`
              : t`Deafen`
        }
        disabled={!voice.listenPermission}
        pressed={voice.deafen()}
        tone={voice.deafen() || !voice.listenPermission ? "muted" : undefined}
        onClick={() => voice.toggleDeafen()}
      >
        <Show
          when={!voice.deafen() && voice.listenPermission}
          fallback={<HeadphoneOff />}
        >
          <Headphones />
        </Show>
      </CallControlButton>
      <CallControlButton
        label={
          !limits().video
            ? t`Coming soon! 👀`
            : voice.video()
              ? t`Stop camera`
              : t`Start camera`
        }
        disabled={!limits().video}
        pressed={voice.video()}
        tone={limits().video && voice.video() ? "active" : undefined}
        onClick={() => {
          if (limits().video) voice.toggleCamera();
        }}
      >
        <Show when={voice.video()} fallback={<VideoOff />}>
          <Video />
        </Show>
      </CallControlButton>
      <CallControlButton
        label={
          typeof navigator.mediaDevices?.getDisplayMedia !== "function"
            ? "Compartilhamento de tela indisponível neste dispositivo"
            : !limits().video
              ? t`Coming soon! 👀`
              : voice.screenshare()
                ? t`Stop sharing`
                : t`Share screen`
        }
        disabled={
          !limits().video ||
          typeof navigator.mediaDevices?.getDisplayMedia !== "function"
        }
        pressed={voice.screenshare()}
        tone={limits().video && voice.screenshare() ? "active" : undefined}
        onClick={() => {
          if (limits().video) voice.toggleScreenshare();
        }}
      >
        <Show when={voice.screenshare()} fallback={<MonitorUp />}>
          <MonitorOff />
        </Show>
      </CallControlButton>
      <CallControlButton
        label={t`End call`}
        tone="disconnect"
        onClick={() => voice.disconnect()}
      >
        <PhoneOff />
      </CallControlButton>
      <SoundboardButton />
    </div>
  );
}
