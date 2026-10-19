import { useState } from "@revolt/state";
import type { LayoutWidgetId } from "@revolt/state/stores/layoutPreferences";
import { createShapeDensityVariables } from "@revolt/ui/themes/stoatWebTheme";
import { Hash, Headphones, Mic, Plus, Smile, Users } from "lucide-solid";
import { For } from "solid-js";

export const DEMO_MEMBERS = [
  {
    name: "Marina",
    initials: "ma",
    color: "#d2a7e9",
    text: "Esse espaço está ficando com a nossa cara.",
    time: "14:32",
  },
  {
    name: "Pedro",
    initials: "pe",
    color: "#8cdbb5",
    text: "É só abrir o Studio. Dá para mudar os cantos, as cores e até a posição de cada módulo.",
    time: "14:33",
  },
  {
    name: "Lucas",
    initials: "lu",
    color: "#e5c18f",
    text: "Já salvei o meu preset. Bora entrar na call?",
    time: "14:35",
  },
];

/** The same vocabulary of surfaces, spacing and message typography as the live workspace. */
export function ThemePreview() {
  const state = useState();
  const blockStyle = (id: LayoutWidgetId) => ({
    ...createShapeDensityVariables(
      state.theme.widgetCorners[id] ?? state.theme.cornerScale,
      state.theme.widgetDensities[id] ?? state.theme.densityScale,
    ),
    "--preview-radius": `${((state.theme.widgetCorners[id] ?? state.theme.cornerScale) / 100) * 16}px`,
    "--preview-pad": `${8 + (state.theme.widgetDensities[id] ?? state.theme.densityScale) / 10}px`,
    "--ws-accent": state.theme.widgetAccents[id],
    background: state.theme.activeTheme.widgetBackgrounds[id],
  });
  return (
    <div
      class="theme-preview"
      style={{
        "--preview-radius": `${(state.theme.cornerScale / 100) * 16}px`,
        "--preview-pad": `${8 + state.theme.densityScale / 10}px`,
      }}
    >
      <div class="theme-preview-rail" style={blockStyle("navigation")}>
        <b>s.</b>
        <span>W</span>
        <span>D</span>
        <Plus size={15} />
      </div>
      <div class="theme-preview-channels" style={blockStyle("channels")}>
        <strong>
          Nosso espaço <span>⌄</span>
        </strong>
        <small>CONVERSAS</small>
        <span class="active">
          <Hash size={14} />
          geral
        </span>
        <span>
          <Hash size={14} />
          ideias
        </span>
        <span>
          <Hash size={14} />
          projetos
        </span>
        <small>VOZ</small>
        <span>
          <Headphones size={14} />
          Sala de estar
        </span>
        <div class="theme-preview-account">
          <i>pe</i>
          <span>
            Pedro<small>Disponível</small>
          </span>
          <Mic size={14} />
        </div>
      </div>
      <div class="theme-preview-chat" style={blockStyle("conversation")}>
        <header>
          <Hash size={18} />
          <strong>geral</strong>
          <Users size={16} />
        </header>
        <div class="theme-preview-messages">
          <span class="theme-preview-date">HOJE</span>
          <For each={DEMO_MEMBERS}>
            {(member) => (
              <article class="ws-sample-message">
                <span
                  class="ws-sample-avatar"
                  style={{ background: member.color }}
                >
                  {member.initials}
                </span>
                <div>
                  <strong>
                    {member.name}
                    <time>{member.time}</time>
                  </strong>
                  <p>{member.text}</p>
                </div>
              </article>
            )}
          </For>
          <div class="ws-sample-reaction">
            ✦ <span>3</span>
          </div>
        </div>
        <div class="theme-preview-composer">
          <Plus size={16} />
          <span>Conversar em #geral</span>
          <Smile size={16} />
        </div>
      </div>
    </div>
  );
}
