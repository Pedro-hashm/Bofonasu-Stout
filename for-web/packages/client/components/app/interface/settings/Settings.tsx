import { useMobileLayout } from "@revolt/common/lib/mobile";
import { useState } from "@revolt/state";
import { animateEntrance } from "@revolt/ui/lib/motion";
import { ArrowLeft, X } from "lucide-solid";
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
  const mobile = useMobileLayout();
  const [mobileDetail, setMobileDetail] = createSignal(
    // Initial route determines whether settings open on the list or a detail page.
    // eslint-disable-next-line solid/reactivity
    !!(props.context as { page?: string } | undefined)?.page,
  );
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
    setMobileDetail(true);
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
          <div
            class="settings-shell"
            data-mobile={mobile()}
            data-detail={mobileDetail()}
          >
            <Show when={mobile()}>
              <header class="mobile-settings-header">
                <Show when={mobileDetail()}>
                  <button
                    aria-label="Voltar às configurações"
                    onClick={() => setMobileDetail(false)}
                  >
                    <ArrowLeft size={21} />
                  </button>
                </Show>
                <h2>Configurações</h2>
                <Show when={props.onClose}>
                  <button
                    aria-label="Fechar configurações"
                    onClick={props.onClose}
                  >
                    <X size={21} />
                  </button>
                </Show>
              </header>
            </Show>
            <div class="settings-pages">
              <div class="settings-list-pane">
                <SettingsSidebar list={list} page={page} setPage={setPage} />
              </div>
              <div class="settings-content-pane">
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
              </div>
            </div>
          </div>
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
