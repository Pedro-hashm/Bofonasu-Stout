import { Dialog } from "@kobalte/core/dialog";
import { useState } from "@revolt/state";
import { APPEARANCE_PRESETS } from "@revolt/state/stores/appearancePresets";
import {
  LAYOUT_WIDGETS,
  MODULES,
} from "@revolt/state/stores/layoutPreferences";
import { animateEntrance } from "@revolt/ui/lib/motion";
import { FONT_KEYS } from "@revolt/ui/themes/fonts";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronRight,
  Circle,
  Copy,
  LayoutDashboard,
  Moon,
  Palette,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Type,
  X,
} from "lucide-solid";
import { createSignal, For, Show } from "solid-js";
import { ThemePreview } from "./ThemePreview";

const COLOR_LABELS = {
  background: "Fundo do workspace",
  panel: "Superfícies",
  raised: "Campos e destaques",
  text: "Texto principal",
  muted: "Texto secundário",
  border: "Divisórias",
} as const;

/** One appearance editor used by the workspace, settings and the development preview. */
export function AppearanceStudio() {
  const state = useState();
  const [tab, setTab] = createSignal("presets");
  const [name, setName] = createSignal("");
  const [feedback, setFeedback] = createSignal("");
  const [error, setError] = createSignal("");
  const theme = () => state.theme.activeTheme;
  let file!: HTMLInputElement;
  const range = (
    label: string,
    value: () => number,
    update: (value: number) => void,
    min = 0,
    max = 100,
    suffix = "%",
  ) => (
    <label class="studio-range">
      <span>
        {label}
        <output>
          {value()}
          {suffix}
        </output>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        value={value()}
        onInput={(e) => update(Number(e.currentTarget.value))}
      />
    </label>
  );
  function save() {
    if (!name().trim()) {
      setError("Dê um nome ao seu preset.");
      return;
    }
    state.layout.savePreset(name());
    setName("");
    setError("");
    setFeedback("Preset salvo neste dispositivo.");
  }
  async function importFile(input: HTMLInputElement) {
    const selected = input.files?.[0];
    if (!selected) return;
    try {
      if (selected.size > 100_000) throw new Error("O arquivo excede 100 KB.");
      state.layout.importAppearance(await selected.text());
      setFeedback("Tema importado e salvo como preset.");
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível importar este tema.",
      );
    }
    input.value = "";
  }
  function exportFile() {
    const url = URL.createObjectURL(
      new Blob([state.layout.exportAppearance()], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "stoat-workspace.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Dialog
      open={state.layout.studioOpen}
      onOpenChange={(open) => state.layout.setStudioOpen(open)}
    >
      <Dialog.Portal>
        <Dialog.Overlay class="studio-overlay" />
        <Dialog.Content
          class="appearance-studio"
          ref={(el) => animateEntrance(el, theme().motion === "full")}
        >
          <header class="studio-header">
            <div>
              <span class="studio-eyebrow">
                <Sparkles size={13} />
                STOAT STUDIO
              </span>
              <Dialog.Title>Um espaço com a sua cara.</Dialog.Title>
              <Dialog.Description>
                Ajuste cada detalhe. Salve o conjunto. Continue de onde parou.
              </Dialog.Description>
            </div>
            <Dialog.CloseButton
              class="ws-icon-button"
              aria-label="Fechar personalização"
            >
              <X size={21} />
            </Dialog.CloseButton>
          </header>
          <div class="studio-body">
            <nav class="studio-nav" aria-label="Seções de personalização">
              <For
                each={
                  [
                    ["presets", "Presets", Palette],
                    ["design", "Sistema visual", SlidersHorizontal],
                    ["modules", "Módulos", LayoutDashboard],
                  ] as const
                }
              >
                {([id, label, Icon]) => (
                  <button
                    data-active={tab() === id}
                    aria-current={tab() === id ? "page" : undefined}
                    onClick={() => setTab(id)}
                  >
                    <Icon size={17} />
                    {label}
                    <ChevronRight size={13} />
                  </button>
                )}
              </For>
              <div class="studio-nav-note">
                <Circle size={7} fill="currentColor" />
                SALVO LOCALMENTE
                <span>
                  Suas preferências pertencem a este dispositivo e conta.
                </span>
              </div>
            </nav>
            <div class="studio-controls">
              <Show when={tab() === "presets"}>
                <div class="studio-section-title">
                  <h3>Comece com uma base</h3>
                  <p>Todos os presets podem ser personalizados.</p>
                </div>
                <div class="studio-presets">
                  <For each={APPEARANCE_PRESETS}>
                    {(preset) => (
                      <button
                        class="studio-preset"
                        data-active={
                          theme().skin === preset.theme.skin &&
                          state.theme.m3Accent === preset.theme.m3Accent
                        }
                        onClick={() => {
                          state.theme.applyPreset({
                            ...state.theme.default(),
                            ...preset.theme,
                          });
                          state.layout.resetWidgets(preset.layout);
                          setFeedback(
                            `${preset.name} aplicado. Ajuste como quiser.`,
                          );
                        }}
                      >
                        <div
                          class="studio-preset-thumbnail"
                          style={{
                            "--preset-bg": preset.swatches[0],
                            "--preset-panel": preset.swatches[1],
                            "--preset-accent": preset.swatches[2],
                          }}
                        >
                          <i />
                          <div>
                            <b />
                            <b />
                            <b />
                          </div>
                          <div>
                            <i />
                            <b />
                            <b />
                            <b />
                            <em />
                          </div>
                          <div>
                            <b />
                            <b />
                            <b />
                          </div>
                        </div>
                        <span class="studio-preset-title">
                          {preset.name}
                          <small>{preset.tag}</small>
                        </span>
                        <span class="studio-preset-description">
                          {preset.description}
                        </span>
                      </button>
                    )}
                  </For>
                </div>
                <div class="studio-section-title">
                  <h3>Seus presets</h3>
                  <p>Aparência e posição dos módulos, salvas juntas.</p>
                </div>
                <form
                  class="studio-save"
                  onSubmit={(e) => {
                    e.preventDefault();
                    save();
                  }}
                >
                  <input
                    aria-label="Nome do preset"
                    maxLength={50}
                    placeholder="Ex.: Meu setup de noite"
                    value={name()}
                    onInput={(e) => setName(e.currentTarget.value)}
                  />
                  <button class="ws-button ws-button--accent" type="submit">
                    <Plus size={16} />
                    Salvar cópia
                  </button>
                </form>
                <Show
                  when={state.layout.savedPresets.length}
                  fallback={
                    <div class="studio-empty">
                      <Copy size={19} />
                      <span>Seu próximo preset começa com um ajuste.</span>
                    </div>
                  }
                >
                  <div class="studio-saved">
                    <For each={state.layout.savedPresets}>
                      {(preset) => (
                        <div>
                          <button
                            onClick={() => {
                              state.layout.applySavedPreset(preset.id);
                              setFeedback(`${preset.name} restaurado.`);
                            }}
                          >
                            <span
                              class="studio-saved-dot"
                              style={{ background: preset.theme.m3Accent }}
                            />
                            {preset.name}
                            <span>Aplicar</span>
                          </button>
                          <button
                            class="ws-icon-button"
                            aria-label={`Excluir preset ${preset.name}`}
                            onClick={() => {
                              state.layout.deleteSavedPreset(preset.id);
                              setFeedback(
                                "Preset excluído. O visual atual foi mantido.",
                              );
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                <div class="studio-import">
                  <button
                    class="ws-button ws-button--quiet"
                    onClick={exportFile}
                  >
                    <ArrowDownToLine size={16} />
                    Exportar JSON
                  </button>
                  <button
                    class="ws-button ws-button--quiet"
                    onClick={() => file.click()}
                  >
                    <ArrowUpFromLine size={16} />
                    Importar tema
                  </button>
                  <input
                    ref={file}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={(e) => void importFile(e.currentTarget)}
                  />
                </div>
              </Show>
              <Show when={tab() === "design"}>
                <div class="studio-section-title">
                  <h3>Cor, forma e ritmo</h3>
                  <p>Os mesmos tokens atravessam toda a interface.</p>
                </div>
                <div class="studio-mode">
                  <For
                    each={
                      [
                        ["dark", "Escuro", Moon],
                        ["light", "Claro", Sun],
                        ["system", "Sistema", Circle],
                      ] as const
                    }
                  >
                    {([id, label, Icon]) => (
                      <button
                        data-active={state.theme.mode === id}
                        onClick={() => state.theme.setMode(id)}
                      >
                        <Icon size={15} />
                        {label}
                      </button>
                    )}
                  </For>
                </div>
                <label class="studio-color">
                  <span>
                    Cor de destaque<small>Seleção, foco e ações</small>
                  </span>
                  <input
                    type="color"
                    aria-label="Cor de destaque"
                    value={state.theme.m3Accent.slice(0, 7)}
                    onInput={(e) =>
                      state.theme.setM3Accent(e.currentTarget.value)
                    }
                  />
                </label>
                <div class="studio-swatches">
                  <For
                    each={[
                      "#8cdbb5",
                      "#5865f2",
                      "#ab9df2",
                      "#e5c18f",
                      "#ee91a7",
                      "#79bce8",
                    ]}
                  >
                    {(color) => (
                      <button
                        style={{ background: color }}
                        aria-label={`Destaque ${color}`}
                        data-active={state.theme.m3Accent === color}
                        onClick={() => state.theme.setM3Accent(color)}
                      >
                        {state.theme.m3Accent === color && <Check size={14} />}
                      </button>
                    )}
                  </For>
                </div>
                {range(
                  "Arredondamento",
                  () => state.theme.cornerScale,
                  (value) => state.theme.setCornerScale(value),
                )}
                {range(
                  "Espaçamento",
                  () => state.theme.densityScale,
                  (value) => state.theme.setDensityScale(value),
                )}
                {range(
                  "Separação dos módulos",
                  () => theme().panelGap,
                  (value) => state.theme.applyPreset({ panelGap: value }),
                  0,
                  16,
                  " px",
                )}
                <div class="studio-section-title">
                  <h3>
                    <Type size={16} />
                    Tipografia
                  </h3>
                </div>
                <label class="studio-select">
                  Fonte da interface
                  <select
                    value={state.theme.interfaceFont}
                    onChange={(e) =>
                      state.theme.setInterfaceFont(
                        e.currentTarget
                          .value as typeof state.theme.interfaceFont,
                      )
                    }
                  >
                    <For each={FONT_KEYS}>
                      {(font) => <option value={font}>{font}</option>}
                    </For>
                  </select>
                </label>
                {range(
                  "Tamanho da interface",
                  () => theme().fontScale,
                  (value) => state.theme.applyPreset({ fontScale: value }),
                  90,
                  120,
                )}
                {range(
                  "Tamanho das mensagens",
                  () => state.theme.messageSize,
                  (value) => {
                    state.theme.messageSize = value;
                  },
                  12,
                  24,
                  " px",
                )}
                <label class="studio-select">
                  Animações
                  <select
                    value={theme().motion}
                    onChange={(e) =>
                      state.theme.applyPreset({
                        motion: e.currentTarget.value as
                          | "full"
                          | "reduced"
                          | "off",
                      })
                    }
                  >
                    <option value="full">Fluidas</option>
                    <option value="reduced">Reduzidas</option>
                    <option value="off">Desativadas</option>
                  </select>
                </label>
                <details class="studio-advanced">
                  <summary>Cores das superfícies</summary>
                  <p>Cores manuais se sobrepõem à paleta do preset.</p>
                  <For
                    each={
                      Object.keys(COLOR_LABELS) as (keyof typeof COLOR_LABELS)[]
                    }
                  >
                    {(key) => (
                      <label class="studio-color">
                        <span>{COLOR_LABELS[key]}</span>
                        <input
                          type="color"
                          aria-label={COLOR_LABELS[key]}
                          value={
                            theme().colors[key] ??
                            (theme().darkMode ? "#191c20" : "#ffffff")
                          }
                          onInput={(e) =>
                            state.theme.applyPreset({
                              colors: {
                                ...theme().colors,
                                [key]: e.currentTarget.value,
                              },
                            })
                          }
                        />
                        <button
                          class="ws-icon-button"
                          aria-label={`Restaurar ${COLOR_LABELS[key]}`}
                          onClick={() => {
                            const colors = { ...theme().colors };
                            delete colors[key];
                            state.theme.applyPreset({ colors });
                          }}
                        >
                          <X size={13} />
                        </button>
                      </label>
                    )}
                  </For>
                </details>
              </Show>
              <Show when={tab() === "modules"}>
                <div class="studio-section-title">
                  <h3>Peças independentes</h3>
                  <p>Mova, redimensione e estilize cada região.</p>
                </div>
                <button
                  class="studio-layout-launch"
                  onClick={() => state.layout.setEditMode(true)}
                >
                  <span>
                    <LayoutDashboard size={22} />
                    <strong>Abrir editor de layout</strong>
                    <small>Canvas em grade · arrastar · redimensionar</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
                <For each={LAYOUT_WIDGETS}>
                  {(id) => (
                    <details class="studio-advanced">
                      <summary>
                        {MODULES[id].label}
                        <span>{MODULES[id].description}</span>
                      </summary>
                      <label class="studio-check">
                        <input
                          type="checkbox"
                          checked={state.layout.widgets[id].visible}
                          disabled={id === "conversation"}
                          onChange={(e) =>
                            state.layout.setWidgetVisible(
                              id,
                              e.currentTarget.checked,
                            )
                          }
                        />
                        Mostrar módulo
                      </label>
                      <label class="studio-color">
                        <span>Destaque próprio</span>
                        <input
                          aria-label={`Cor de ${MODULES[id].label}`}
                          type="color"
                          value={theme().widgetAccents[id] ?? theme().accent}
                          onInput={(e) =>
                            state.theme.setWidgetAccent(
                              id,
                              e.currentTarget.value,
                            )
                          }
                        />
                      </label>
                      <label class="studio-color">
                        <span>Fundo próprio</span>
                        <input
                          aria-label={`Fundo de ${MODULES[id].label}`}
                          type="color"
                          value={
                            theme().widgetBackgrounds[id] ??
                            (theme().darkMode ? "#191c20" : "#ffffff")
                          }
                          onInput={(e) =>
                            state.theme.applyPreset({
                              widgetBackgrounds: {
                                ...theme().widgetBackgrounds,
                                [id]: e.currentTarget.value,
                              },
                            })
                          }
                        />
                      </label>
                      {range(
                        "Cantos",
                        () =>
                          theme().widgetCorners[id] ?? state.theme.cornerScale,
                        (value) => state.theme.setWidgetCorner(id, value),
                      )}
                      {range(
                        "Densidade",
                        () =>
                          theme().widgetDensities[id] ??
                          state.theme.densityScale,
                        (value) => state.theme.setWidgetDensity(id, value),
                      )}
                      <button
                        class="ws-button ws-button--quiet"
                        onClick={() => {
                          const backgrounds = { ...theme().widgetBackgrounds };
                          delete backgrounds[id];
                          const corners = { ...theme().widgetCorners };
                          delete corners[id];
                          const densities = { ...theme().widgetDensities };
                          delete densities[id];
                          state.theme.setWidgetAccent(id, "");
                          state.theme.applyPreset({
                            widgetBackgrounds: backgrounds,
                            widgetCorners: corners,
                            widgetDensities: densities,
                          });
                        }}
                      >
                        Usar ajustes globais
                      </button>
                    </details>
                  )}
                </For>
              </Show>
              <p class="studio-feedback" aria-live="polite">
                {feedback()}
              </p>
              <Show when={error()}>
                <p class="studio-error" role="alert">
                  {error()}
                </p>
              </Show>
            </div>
            <aside class="studio-preview">
              <div class="studio-preview-label">
                <span class="ws-pulse" />
                PRÉVIA AO VIVO<span>Os ajustes já estão aplicados</span>
              </div>
              <ThemePreview />
              <div class="studio-preview-caption">
                <Sparkles size={16} />
                <span>
                  Uma identidade. Infinitas combinações.
                  <small>
                    Seu tema acompanha mensagens, navegação e chamadas.
                  </small>
                </span>
              </div>
            </aside>
          </div>
          <footer class="studio-footer">
            <span>
              As mudanças são salvas automaticamente neste dispositivo.
            </span>
            <Dialog.CloseButton
              class="ws-button ws-button--accent"
              aria-label="Concluir personalização"
            >
              <Check size={16} />
              Pronto
            </Dialog.CloseButton>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
