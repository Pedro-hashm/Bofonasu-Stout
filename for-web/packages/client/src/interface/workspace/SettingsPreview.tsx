import { Dialog } from "@kobalte/core/dialog";
import { Settings } from "@revolt/app/interface/settings/Settings";
import { LanguageSettings } from "@revolt/app/interface/settings/user/Language";
import Sounds from "@revolt/app/interface/settings/user/notifications/Sounds";
import { LivingRoomSettings } from "@revolt/rtc/living-room/RoomStudio";
import { useState } from "@revolt/state";
import { Updates } from "@revolt/updates/Updates";
import { Languages, Palette, PanelsTopLeft, X } from "lucide-solid";
import { createSignal } from "solid-js";

/** Runs the production settings navigator without needing an authenticated account. */
export function SettingsPreview(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const state = useState();
  const [content, setContent] = createSignal<HTMLDivElement>();
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay class="studio-overlay" />
        <Dialog.Content
          class="settings_overlay demo-settings"
          data-content-ready={!!content()}
        >
          <Dialog.Title class="ws-sr-only">
            Prévia local de configurações
          </Dialog.Title>
          <Dialog.Description class="ws-sr-only">
            Navegação real; preferências isoladas da conta.
          </Dialog.Description>
          <Dialog.CloseButton
            class="demo-settings-close ws-icon-button"
            aria-label="Fechar configurações"
          >
            <X size={20} />
          </Dialog.CloseButton>
          <Settings
            context={undefined as never}
            contentRef={setContent}
            list={() => ({
              context: undefined as never,
              entries: [
                {
                  title: "PRÉVIA LOCAL",
                  entries: [
                    {
                      id: "appearance",
                      title: "Aparência",
                      icon: <Palette size={18} />,
                    },
                    {
                      id: "language",
                      title: "Idioma",
                      icon: <Languages size={18} />,
                    },
                    {
                      id: "layout",
                      title: "Layout",
                      icon: <PanelsTopLeft size={18} />,
                    },
                    { id: "sounds", title: "Sons", icon: <span>♪</span> },
                    {
                      id: "updates",
                      title: "Atualizações e novidades",
                      icon: <span>↗</span>,
                    },
                    {
                      id: "living-room",
                      title: "Living Room",
                      icon: <span>◉</span>,
                    },
                  ],
                },
              ],
            })}
            title={(list, key) =>
              String(
                list.entries
                  .flatMap((category) => category.entries)
                  .find((entry) => entry.id === key)?.title ?? key,
              )
            }
            render={({ page }) => {
              switch (page()) {
                case "sounds":
                  return <Sounds />;
                case "updates":
                  return <Updates />;
                case "living-room":
                  return <LivingRoomSettings />;
                case "language":
                  return <LanguageSettings />;
                case "layout":
                  return (
                    <div>
                      <p>
                        Edite a posição e o tamanho dos módulos no workspace.
                      </p>
                      <button
                        class="ws-button"
                        onClick={() => {
                          props.onOpenChange(false);
                          state.layout.setEditMode(true);
                        }}
                      >
                        Editar distribuição
                      </button>
                    </div>
                  );
                default:
                  return (
                    <div>
                      <p>Presets, cores, fontes e formas para o seu espaço.</p>
                      <button
                        class="ws-button"
                        onClick={() => {
                          props.onOpenChange(false);
                          state.layout.setStudioOpen(true);
                        }}
                      >
                        Abrir personalização
                      </button>
                    </div>
                  );
              }
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
