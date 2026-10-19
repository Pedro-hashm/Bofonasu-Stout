import { useState } from "@revolt/state";
import { animateEntrance } from "@revolt/ui/lib/motion";
import {
  type JSX,
  Accessor,
  createContext,
  createMemo,
  createSignal,
  Setter,
  Show,
  useContext,
} from "solid-js";

import { SettingsConfiguration, SettingsEntry, SettingsList } from ".";
import { SettingsContent } from "./_layout/Content";
import { SettingsSidebar } from "./_layout/Sidebar";

export interface SettingsProps {
  /**
   * Close settings
   */
  onClose?: () => void;

  /**
   * Settings context
   */
  context: never;

  contentRef: Setter<HTMLDivElement | undefined>;
}

/**
 * Transition animation
 */
export type SettingsTransition = "normal" | "to-child" | "to-parent";

/**
 * Provide navigation to child components
 */
const SettingsNavigationContext = createContext<{
  page: Accessor<string | undefined>;
  navigate: (path: string | SettingsEntry) => void;
  registerAction: (action: () => JSX.Element) => () => void;
}>();

/**
 * Generic Settings component
 */
export function Settings(props: SettingsProps & SettingsConfiguration<never>) {
  const state = useState();
  const [page, setPage] = createSignal<undefined | string>(
    // eslint-disable-next-line
    (props.context as any)?.page,
  );

  const [action, setAction] = createSignal<(() => JSX.Element) | undefined>();

  /**
   * Register the action associated with the current settings page
   */
  function registerAction(nextAction: () => JSX.Element) {
    setAction(() => nextAction);

    return () =>
      setAction((currentAction) =>
        currentAction === nextAction ? undefined : currentAction,
      );
  }

  /**
   * Navigate to a certain page
   */
  function navigate(entry: string | SettingsEntry) {
    let id;
    if (typeof entry === "object") {
      if (entry.onClick) {
        entry.onClick();
      } else if (entry.href) {
        window.open(entry.href, "_blank");
      } else if (entry.id) {
        id = entry.id;
      }
    } else {
      id = entry;
    }

    if (!id) return;

    setPage(id);
  }

  return (
    <SettingsNavigationContext.Provider
      value={{
        page,
        navigate,
        registerAction,
      }}
    >
      <MemoisedList
        context={props.context}
        list={props.list}
        onClose={props.onClose}
      >
        {(list) => (
          <>
            <SettingsSidebar list={list} page={page} setPage={setPage} />
            <SettingsContent
              ref={props.contentRef}
              action={action}
              page={page}
              list={list}
              title={props.title}
              onClose={props.onClose}
            >
              <Show when={page()} keyed>
                {(currentPage) => (
                  <div
                    ref={(el) =>
                      animateEntrance(
                        el,
                        state.theme.activeTheme.motion === "full",
                      )
                    }
                  >
                    {props.render(
                      { page: () => currentPage, onClose: props.onClose },
                      props.context,
                    )}
                  </div>
                )}
              </Show>
            </SettingsContent>
          </>
        )}
      </MemoisedList>
    </SettingsNavigationContext.Provider>
  );
}

/**
 * Memoise the list but generate it within context
 */
function MemoisedList(props: {
  context: never;
  onClose?: () => void;
  list: (context: never, onClose?: () => void) => SettingsList<unknown>;
  children: (list: Accessor<SettingsList<unknown>>) => JSX.Element;
}) {
  /**
   * Generate list of categories / links
   */
  const list = createMemo(() => props.list(props.context, props.onClose));
  return <>{props.children(list)}</>;
}

/**
 * Use settings navigation context
 */
export const useSettingsNavigation = () =>
  useContext(SettingsNavigationContext)!;
