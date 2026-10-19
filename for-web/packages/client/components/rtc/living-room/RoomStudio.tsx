import { useState } from "@revolt/state";
import {
  Download,
  ImagePlus,
  MessageSquare,
  Pencil,
  RotateCcw,
  Save,
  Upload,
  X,
} from "lucide-solid";
import {
  type JSX,
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
  untrack,
} from "solid-js";
import { exportRoom, importRoom, storeImage } from "./assets";
import "./livingRoom.css";
import {
  type Corners,
  DEFAULT_CORNERS,
  defaultScene,
  validCorners,
} from "./model";
import { previewChat } from "./RoomChatOverlay";
import {
  type RoomGuest,
  type RoomStream,
  PREVIEW_GUESTS,
  RoomSceneView,
} from "./RoomScene";
import { RoomSyncSettings } from "./RoomSyncSettings";
import type { RoomChatFeed } from "./useRoomChat";

export function RoomWorkspace(props: {
  guests?: RoomGuest[];
  streams?: RoomStream[];
  channel?: string;
  studio?: boolean;
  chat?: RoomChatFeed;
}) {
  const state = useState();
  const room = state.livingRoom;
  const account = untrack(() => state.auth.getSession()?.userId);
  let mounted = true;
  onCleanup(() => {
    mounted = false;
  });
  const isActive = () =>
    mounted && untrack(() => state.auth.getSession()?.userId) === account;
  const [editing, setEditing] = createSignal(untrack(() => !!props.studio));
  const [name, setName] = createSignal("Minha sala");
  const [status, setStatus] = createSignal("");
  const [failed, setFailed] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  const [previewCount, setPreviewCount] = createSignal(1);
  let imageInput!: HTMLInputElement, importInput!: HTMLInputElement;
  const scene = () => room.scene;
  const demoChat = previewChat();
  const presetName = () =>
    room.presets.find((p) => p.id === room.activePreset)?.name ??
    "Studio · padrão";
  createEffect(() =>
    setName(room.activePreset === "default" ? "Minha sala" : presetName()),
  );
  const previewStreams = (): RoomStream[] =>
    Array.from({ length: previewCount() }, (_, i) => ({
      id: `preview-stream-${i}`,
      owner: `preview-${i}`,
      label: [
        "Apresentação da Ana",
        "Câmera do Luca",
        "Jogo da Mia",
        "Tela do Noah",
      ][i],
    }));
  async function action(fn: () => void | Promise<void>, message = "") {
    setBusy(true);
    setStatus("");
    setFailed(false);
    try {
      await fn();
      setStatus(message);
    } catch (e) {
      setFailed(true);
      setStatus(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar. Confira o espaço disponível no armazenamento local.",
      );
    } finally {
      setBusy(false);
    }
  }
  function editCorner(index: number, axis: "x" | "y", value: number) {
    const corners = scene().screen.corners.map((p, i) =>
      i === index ? { ...p, [axis]: value / 100 } : { ...p },
    );
    if (
      validCorners(corners) &&
      corners.every(
        (p) => p.x >= 0.015 && p.x <= 0.985 && p.y >= 0.015 && p.y <= 0.985,
      )
    )
      room.screen({ corners });
  }
  return (
    <section
      class="lr-workspace"
      data-studio={props.studio}
      aria-label="Living Room"
    >
      <header class="lr-toolbar">
        <span class="lr-wordmark">LIVING ROOM</span>
        <select
          aria-label="Preset da sala"
          value={room.activePreset}
          onChange={(e) => {
            room.apply(e.currentTarget.value);
            setStatus("");
          }}
        >
          <option value="default">Studio · padrão</option>
          <For each={room.presets}>
            {(preset) => <option value={preset.id}>{preset.name}</option>}
          </For>
        </select>
        <span
          class="lr-dirty"
          title={
            room.dirty
              ? "Alterações locais; salve um preset para reutilizá-las"
              : "Preset salvo"
          }
        >
          {room.dirty ? "●" : ""}
        </span>
        <button
          type="button"
          class="lr-edit-toggle"
          aria-pressed={editing()}
          onClick={() => setEditing(!editing())}
        >
          <Show when={editing()} fallback={<Pencil size={14} />}>
            <X size={14} />
          </Show>
          {editing() ? "Concluir" : "Editar sala"}
        </button>
        <button
          type="button"
          class="lr-chat-toggle"
          title={scene().chat.visible ? "Ocultar chat" : "Mostrar chat"}
          aria-label={scene().chat.visible ? "Ocultar chat" : "Mostrar chat"}
          aria-pressed={scene().chat.visible}
          onClick={() => room.chat({ visible: !scene().chat.visible })}
        >
          <MessageSquare size={16} />
        </button>
      </header>
      <Show when={status()}>
        <p
          class="lr-status"
          role={failed() ? "alert" : "status"}
          data-error={failed()}
        >
          {status()}
        </p>
      </Show>
      <div class="lr-workspace-body" data-editing={editing()}>
        <div class="lr-canvas-area">
          <RoomSceneView
            guests={props.guests ?? PREVIEW_GUESTS}
            streams={props.streams ?? previewStreams()}
            channel={props.channel ?? "preview"}
            editing={editing()}
            chat={props.chat ?? demoChat}
          />
          <Show when={editing()}>
            <p class="lr-canvas-help">
              Arraste os avatares e os quatro cantos da tela. Setas ajustam;
              Shift acelera. Seu avatar marca a posição de escuta.
            </p>
          </Show>
        </div>
        <Show when={editing()}>
          <aside class="lr-inspector" aria-label="Editor da sala">
            <details open>
              <summary>Sincronização</summary>
              <RoomSyncSettings />
            </details>
            <details open>
              <summary>Presets</summary>
              <p>
                A aparência fica neste cliente. No modo sincronizado, as
                posições vêm da chamada; desative-o para editar as posições do
                seu preset. Salve uma cópia para reutilizar a cena local.
              </p>
              <label>
                Nome
                <input
                  maxlength={80}
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                />
              </label>
              <div class="lr-button-row">
                <button
                  disabled={busy() || room.presets.length >= 50}
                  onClick={() =>
                    void action(
                      () => room.save(untrack(name)),
                      "Cópia salva neste cliente.",
                    )
                  }
                >
                  <Save size={14} /> Salvar cópia
                </button>
                <Show when={room.activePreset !== "default"}>
                  <button
                    disabled={busy()}
                    onClick={() =>
                      void action(
                        () => room.save(untrack(presetName), true),
                        "Preset atualizado.",
                      )
                    }
                  >
                    Atualizar
                  </button>
                  <button onClick={() => room.rename(name())}>Renomear</button>
                  <button onClick={() => room.remove(room.activePreset)}>
                    Excluir preset
                  </button>
                </Show>
                <button onClick={() => room.apply(room.activePreset)}>
                  <RotateCcw size={14} /> Restaurar
                </button>
              </div>
              <div class="lr-button-row">
                <button
                  disabled={busy()}
                  onClick={() =>
                    void action(
                      () => exportRoom(scene(), presetName()),
                      "Pacote exportado com a imagem.",
                    )
                  }
                >
                  <Download size={14} /> Exportar
                </button>
                <button disabled={busy()} onClick={() => importInput.click()}>
                  <Upload size={14} /> Importar
                </button>
              </div>
              <input
                ref={importInput}
                hidden
                type="file"
                accept=".json,application/json"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  if (file)
                    void action(async () => {
                      if (room.presets.length >= 50)
                        throw new Error(
                          "Limite de 50 presets. Exclua um preset antes de importar.",
                        );
                      const imported = await importRoom(file);
                      if (!isActive()) return;
                      if (room.presets.length >= 50)
                        throw new Error(
                          "Limite de 50 presets. Exclua um preset antes de importar.",
                        );
                      room.update(imported.scene);
                      room.save(imported.name);
                      setName(imported.name);
                    }, "Sala importada e salva neste cliente.");
                }}
              />
            </details>
            <details open>
              <summary>Ambiente</summary>
              <label>
                Fundo
                <select
                  value={scene().background.kind}
                  onChange={(e) =>
                    room.update({
                      background: {
                        ...scene().background,
                        kind: e.currentTarget.value as
                          | "studio"
                          | "image"
                          | "color",
                      },
                    })
                  }
                >
                  <option value="studio">Studio vetorial</option>
                  <option value="color">Cor sólida</option>
                  <option value="image">Minha imagem</option>
                </select>
              </label>
              <div class="lr-button-row">
                <button disabled={busy()} onClick={() => imageInput.click()}>
                  <ImagePlus size={14} /> Escolher imagem
                </button>
              </div>
              <input
                ref={imageInput}
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  if (file)
                    void action(async () => {
                      const saved = await storeImage(file);
                      if (!isActive()) return;
                      room.update({
                        background: {
                          ...scene().background,
                          kind: "image",
                          assetId: saved.id,
                        },
                        aspect: saved.aspect,
                      });
                    }, "Imagem copiada para o armazenamento local.");
                }}
              />
              <p>
                PNG, JPEG ou WebP · até 12 MB. O arquivo original pode ser
                movido depois.
              </p>
              <label>
                Cor do ambiente
                <input
                  type="color"
                  value={scene().background.color}
                  onInput={(e) =>
                    room.update({
                      background: {
                        ...scene().background,
                        color: e.currentTarget.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                Proporção da cena
                <select
                  value={String(scene().aspect)}
                  onChange={(e) =>
                    room.update({ aspect: Number(e.currentTarget.value) })
                  }
                >
                  <option value={String(scene().aspect)}>
                    Atual · {scene().aspect.toFixed(2)}:1
                  </option>
                  <option value={String(16 / 9)}>16:9</option>
                  <option value={String(16 / 10)}>16:10</option>
                  <option value={String(4 / 3)}>4:3</option>
                  <option value="1">1:1</option>
                  <option value={String(21 / 9)}>21:9</option>
                </select>
              </label>
            </details>
            <details>
              <summary>Participantes</summary>
              <RoomRange
                label="Tamanho dos avatares"
                value={scene().avatarSize}
                min={28}
                max={120}
                onInput={(avatarSize) => room.update({ avatarSize })}
              />
              <label>
                Borda de fala
                <input
                  type="color"
                  value={scene().accent}
                  onInput={(e) =>
                    room.update({ accent: e.currentTarget.value })
                  }
                />
              </label>
              <label>
                Nomes
                <select
                  value={scene().names}
                  onChange={(e) =>
                    room.update({
                      names: e.currentTarget.value as
                        | "hover"
                        | "always"
                        | "never",
                    })
                  }
                >
                  <option value="hover">Ao passar o mouse</option>
                  <option value="always">Sempre</option>
                  <option value="never">Ocultar</option>
                </select>
              </label>
              <button
                onClick={() =>
                  room.update({
                    seats: defaultScene().seats,
                    assignments: {},
                    listener: defaultScene().listener,
                  })
                }
              >
                Restaurar lugares
              </button>
            </details>
            <details open>
              <summary>Chat na sala</summary>
              <label class="lr-check">
                <input
                  type="checkbox"
                  checked={scene().chat.visible}
                  onChange={(e) =>
                    room.chat({ visible: e.currentTarget.checked })
                  }
                />
                Mostrar chat
              </label>
              <label>
                Origem
                <select
                  value={scene().chat.source}
                  onChange={(e) =>
                    room.chat({
                      source: e.currentTarget.value as "call" | "current",
                    })
                  }
                >
                  <option value="call">Canal da chamada</option>
                  <option value="current">Conversa aberta</option>
                </select>
              </label>
              <label class="lr-check">
                <input
                  type="checkbox"
                  checked={scene().chat.temporary}
                  onChange={(e) =>
                    room.chat({ temporary: e.currentTarget.checked })
                  }
                />
                Mensagens momentâneas
              </label>
              <RoomRange
                label="Duração (segundos)"
                value={scene().chat.duration}
                min={3}
                max={120}
                onInput={(duration) => room.chat({ duration })}
              />
              <RoomRange
                label="Últimas mensagens"
                value={scene().chat.limit}
                min={1}
                max={15}
                onInput={(limit) => room.chat({ limit })}
              />
              <RoomRange
                label="Opacidade do fundo"
                value={Math.round(scene().chat.opacity * 100)}
                min={0}
                max={95}
                onInput={(v) => room.chat({ opacity: v / 100 })}
              />
              <RoomRange
                label="Tamanho do texto"
                value={scene().chat.fontSize}
                min={12}
                max={30}
                onInput={(fontSize) => room.chat({ fontSize })}
              />
              <RoomRange
                label="Posição horizontal (%)"
                value={Math.round(scene().chat.x * 100)}
                min={2}
                max={Math.floor((0.985 - scene().chat.width) * 100)}
                onInput={(v) => room.chat({ x: v / 100 })}
              />
              <RoomRange
                label="Posição vertical (%)"
                value={Math.round(scene().chat.y * 100)}
                min={2}
                max={Math.floor((0.985 - scene().chat.height) * 100)}
                onInput={(v) => room.chat({ y: v / 100 })}
              />
              <RoomRange
                label="Largura (%)"
                value={Math.round(scene().chat.width * 100)}
                min={15}
                max={80}
                onInput={(v) => room.chat({ width: v / 100 })}
              />
              <RoomRange
                label="Altura (%)"
                value={Math.round(scene().chat.height * 100)}
                min={15}
                max={85}
                onInput={(v) => room.chat({ height: v / 100 })}
              />
              <p>
                No editor, arraste a alça do chat e redimensione pelo canto.
                Passe o mouse para reler as mensagens; o alfinete mantém o chat
                visível.
              </p>
            </details>
            <details open>
              <summary>Tela de apresentações</summary>
              <label>
                Distribuição
                <select
                  value={scene().screen.mode}
                  onChange={(e) =>
                    room.screen({
                      mode: e.currentTarget.value as
                        | "single"
                        | "grid"
                        | "focus",
                    })
                  }
                >
                  <option value="single">Uma por vez</option>
                  <option value="grid">Grid automático</option>
                  <option value="focus">Principal + secundárias</option>
                </select>
              </label>
              <label>
                Enquadramento
                <select
                  value={scene().screen.fit}
                  onChange={(e) =>
                    room.screen({
                      fit: e.currentTarget.value as "contain" | "cover",
                    })
                  }
                >
                  <option value="contain">Vídeo inteiro, com faixas</option>
                  <option value="cover">Preencher, com recorte</option>
                </select>
              </label>
              <label>
                Sem transmissão
                <select
                  value={scene().screen.idle}
                  onChange={(e) =>
                    room.screen({
                      idle: e.currentTarget.value as
                        | "panel"
                        | "transparent"
                        | "clock",
                    })
                  }
                >
                  <option value="panel">Painel Living Room</option>
                  <option value="transparent">Transparente</option>
                  <option value="clock">Relógio</option>
                </select>
              </label>
              <label>
                Proporção do conteúdo
                <select
                  value={String(scene().screen.aspect)}
                  onChange={(e) =>
                    room.screen({ aspect: Number(e.currentTarget.value) })
                  }
                >
                  <option value={String(16 / 9)}>16:9</option>
                  <option value={String(4 / 3)}>4:3</option>
                  <option value="1">1:1</option>
                  <option value={String(21 / 9)}>21:9</option>
                </select>
              </label>
              <label>
                Camada
                <select
                  value={scene().screen.layer}
                  onChange={(e) =>
                    room.screen({
                      layer: e.currentTarget.value as "front" | "back",
                    })
                  }
                >
                  <option value="back">Atrás dos participantes</option>
                  <option value="front">Na frente dos participantes</option>
                </select>
              </label>
              <label class="lr-check">
                <input
                  type="checkbox"
                  checked={scene().screen.cameras}
                  onChange={(e) =>
                    room.screen({ cameras: e.currentTarget.checked })
                  }
                />
                Incluir câmeras na tela
              </label>
              <RoomRange
                label="Colunas do grid (0 = automático)"
                value={scene().screen.columns}
                min={0}
                max={6}
                onInput={(columns) => room.screen({ columns })}
              />
              <RoomRange
                label="Espaço entre streams"
                value={scene().screen.gap}
                min={0}
                max={40}
                onInput={(gap) => room.screen({ gap })}
              />
              <Show when={!props.streams}>
                <label>
                  Prévia de streams
                  <select
                    value={previewCount()}
                    onChange={(e) =>
                      setPreviewCount(Number(e.currentTarget.value))
                    }
                  >
                    <For each={[0, 1, 2, 3, 4]}>
                      {(n) => <option value={n}>{n}</option>}
                    </For>
                  </select>
                </label>
              </Show>
            </details>
            <details>
              <summary>Moldura e perspectiva</summary>
              <label>
                Cor da moldura
                <input
                  type="color"
                  value={scene().screen.color}
                  onInput={(e) => room.screen({ color: e.currentTarget.value })}
                />
              </label>
              <RoomRange
                label="Espessura da borda"
                value={scene().screen.border}
                min={0}
                max={20}
                onInput={(border) => room.screen({ border })}
              />
              <RoomRange
                label="Cantos"
                value={scene().screen.radius}
                min={0}
                max={80}
                onInput={(radius) => room.screen({ radius })}
              />
              <RoomRange
                label="Brilho"
                value={Math.round(scene().screen.glow * 100)}
                min={0}
                max={100}
                onInput={(v) => room.screen({ glow: v / 100 })}
              />
              <RoomRange
                label="Sombra"
                value={Math.round(scene().screen.shadow * 100)}
                min={0}
                max={100}
                onInput={(v) => room.screen({ shadow: v / 100 })}
              />
              <For each={[0, 1, 2, 3]}>
                {(index) => (
                  <div class="lr-corner-fields">
                    <span>Canto {index + 1}</span>
                    <For each={["x", "y"] as const}>
                      {(axis) => (
                        <label>
                          {axis.toUpperCase()} %
                          <input
                            type="number"
                            min="1.5"
                            max="98.5"
                            step=".1"
                            value={
                              Math.round(
                                scene().screen.corners[index][axis] * 1000,
                              ) / 10
                            }
                            onChange={(e) =>
                              editCorner(
                                index,
                                axis,
                                Number(e.currentTarget.value),
                              )
                            }
                          />
                        </label>
                      )}
                    </For>
                  </div>
                )}
              </For>
              <button
                onClick={() =>
                  room.screen({
                    corners: DEFAULT_CORNERS.map((p) => ({ ...p })) as Corners,
                  })
                }
              >
                Restaurar tela e perspectiva
              </button>
            </details>
          </aside>
        </Show>
      </div>
    </section>
  );
}

export function LivingRoomSettings() {
  const { livingRoom: room } = useState();
  return (
    <div class="lr-settings">
      <div>
        <h2>Living Room</h2>
        <p>
          Sua sala, seus lugares, sua tela. Presets e imagens ficam neste
          cliente.
        </p>
      </div>
      <label class="lr-check">
        <input
          type="checkbox"
          checked={room.enabled}
          onChange={(e) => (room.enabled = e.currentTarget.checked)}
        />
        Usar modo sala nas chamadas
      </label>
      <RoomSyncSettings />
      <section class="lr-audio-settings" aria-label="Áudio espacial">
        <h3>Áudio espacial</h3>
        <label class="lr-check">
          <input
            type="checkbox"
            checked={room.scene.spatial.enabled}
            onChange={(e) => room.spatial({ enabled: e.currentTarget.checked })}
          />
          Posicionar as vozes na sala
        </label>
        <p>
          Seu avatar é o ponto de escuta. Afeta apenas como você ouve;
          apresentações preservam o áudio original. Binaural é indicado para
          fones estéreo.
        </p>
        <fieldset disabled={!room.scene.spatial.enabled}>
          <label>
            Método
            <select
              value={room.scene.spatial.method}
              onChange={(e) =>
                room.spatial({
                  method: e.currentTarget.value as "hrtf" | "stereo",
                })
              }
            >
              <option value="hrtf">Binaural · HRTF</option>
              <option value="stereo">Estéreo suave</option>
            </select>
          </label>
          <RoomRange
            label="Intensidade espacial"
            value={Math.round(room.scene.spatial.width * 100)}
            min={0}
            max={100}
            onInput={(v) => room.spatial({ width: v / 100 })}
          />
          <RoomRange
            label="Influência da distância"
            value={Math.round(room.scene.spatial.distance * 100)}
            min={0}
            max={50}
            onInput={(v) => room.spatial({ distance: v / 100 })}
          />
        </fieldset>
      </section>
      <RoomWorkspace studio />
      <p class="lr-footnote">
        A prévia mostra participantes fictícios. Exporte os presets com as
        imagens para fazer backup ou compartilhar. Limpar os dados do cliente
        pode apagar as salas locais.
      </p>
    </div>
  );
}
function RoomRange(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onInput: (v: number) => void;
}): JSX.Element {
  return (
    <label class="lr-range">
      <span>
        {props.label}
        <output>{props.value}</output>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        onInput={(e) => props.onInput(Number(e.currentTarget.value))}
      />
    </label>
  );
}
