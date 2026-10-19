import { useLingui } from "@lingui/solid/macro";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";
import { useWorkspace } from "@revolt/ui/lib/workspace";
import { PanelLeft } from "lucide-solid";
import { JSX } from "solid-js";

/** Accessible navigation control shared by all route headers. */
export function HeaderIcon(props: { children: JSX.Element }) {
  const state = useState();
  const workspace = useWorkspace();
  const { t } = useLingui();
  return (
    <button
      class="ws-header-navigation"
      aria-label={t`Toggle main sidebar`}
      title={t`Toggle main sidebar`}
      onClick={() => {
        if (workspace) {
          if (workspace.narrow()) workspace.reveal("channels");
          else state.layout.toggleWidget("channels");
        } else {
          const drawer = state.appDrawer();
          if (drawer) drawer.setShown(false);
          else
            state.layout.toggleSectionState(
              LAYOUT_SECTIONS.PRIMARY_SIDEBAR,
              true,
            );
        }
      }}
    >
      <PanelLeft size={16} />
      {props.children}
    </button>
  );
}
