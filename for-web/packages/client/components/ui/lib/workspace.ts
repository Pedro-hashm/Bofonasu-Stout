import type { LayoutWidgetId } from "@revolt/state/stores/layoutPreferences";
import { Accessor, createContext, useContext } from "solid-js";

export type WorkspaceContextValue = {
  slots: Partial<Record<LayoutWidgetId, HTMLDivElement>>;
  register(id: LayoutWidgetId): () => void;
  reveal(id: LayoutWidgetId): void;
  active: Accessor<LayoutWidgetId>;
  narrow: Accessor<boolean>;
  visible(id: LayoutWidgetId): boolean;
};
export const WorkspaceContext = createContext<WorkspaceContextValue>();
export const useWorkspace = () => useContext(WorkspaceContext);
