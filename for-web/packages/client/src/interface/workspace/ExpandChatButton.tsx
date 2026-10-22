import { useState } from "@revolt/state";
import { useWorkspace } from "@revolt/ui/lib/workspace";
import { Maximize2, Minimize2 } from "lucide-solid";
import { Show } from "solid-js";

/** Transient expansion leaves the saved grid and mounted message history intact. */
export function ExpandChatButton() {
  const state = useState();
  const workspace = useWorkspace();
  const label = () =>
    state.layout.conversationExpanded ? "Restaurar chat" : "Expandir chat";
  return (
    <Show when={workspace && !workspace.narrow() && !state.layout.editMode}>
      <button
        class="ws-icon-button ws-expand-chat"
        title={label()}
        aria-label={label()}
        aria-pressed={state.layout.conversationExpanded}
        onClick={() =>
          state.layout.setConversationExpanded(
            !state.layout.conversationExpanded,
          )
        }
      >
        <Show
          when={state.layout.conversationExpanded}
          fallback={<Maximize2 size={17} />}
        >
          <Minimize2 size={17} />
        </Show>
      </button>
    </Show>
  );
}
