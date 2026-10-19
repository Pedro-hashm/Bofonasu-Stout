import { useClient } from "@revolt/client";
import { useSmartParams } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import { VoiceChannelCallCardMount } from "@revolt/ui/components/features/voice/callCard/VoiceCallCard";
import { Phone } from "lucide-solid";
import { createMemo, Show } from "solid-js";
import { WorkspaceModule } from "./Workspace";

/** The call anchor lives at workspace level, so changing routes never removes it. */
export function WorkspaceVoice() {
  const voice = useVoice();
  const client = useClient();
  const params = useSmartParams();
  const channel = createMemo(() => {
    const connected = voice.channel();
    if (connected) return connected;
    const selected = client().channels.get(params().channelId ?? "");
    return selected?.isVoice && selected.havePermission("Connect")
      ? selected
      : undefined;
  });
  return (
    <WorkspaceModule id="voice">
      <Show
        when={channel()}
        fallback={
          <div class="ws-empty">
            <span class="ws-empty-symbol">
              <Phone size={24} />
            </span>
            <strong>Entre na conversa</strong>
            <span>
              Escolha um canal de voz. Sua chamada fica aqui, mesmo ao trocar de
              conversa.
            </span>
          </div>
        }
      >
        {(current) => (
          <VoiceChannelCallCardMount channel={current()} fitToPanel />
        )}
      </Show>
    </WorkspaceModule>
  );
}
