import { useSound } from "@revolt/client/Sounds";
import { RoomWorkspace } from "@revolt/rtc/living-room/RoomStudio";
import { SoundboardQuickMenu } from "@revolt/rtc/soundboard/SoundboardQuickMenu";
import { useState } from "@revolt/state";
import { Avatar, MessageContainer } from "@revolt/ui";
import { CallControlButton } from "@revolt/ui/components/features/voice/callCard/CallControlButton";
import { CallControlsTray } from "@revolt/ui/components/features/voice/callCard/CallControlsTray";
import {
  CompactCallAvatar,
  CompactCallFrame,
  isCompactCallSize,
} from "@revolt/ui/components/features/voice/callCard/CompactCall";
import { ListView2 } from "@revolt/ui/components/utils/ListView2";
import { createResizeObserver } from "@solid-primitives/resize-observer";
import {
  Armchair,
  ArrowLeftRight,
  Check,
  ChevronDown,
  Hash,
  HeadphoneOff,
  Headphones,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  MonitorUp,
  Music2,
  Paperclip,
  Phone,
  PhoneOff,
  Pin,
  Plus,
  Search,
  Send,
  Settings2,
  Smile,
  Users,
  Video,
} from "lucide-solid";
import { createSignal, createUniqueId, For, onMount, Show } from "solid-js";
import { ExpandChatButton } from "./ExpandChatButton";
import { SettingsPreview } from "./SettingsPreview";
import { DEMO_MEMBERS } from "./ThemePreview";
import { useWorkspace, Workspace, WorkspaceModule } from "./Workspace";

/** Development-only route: exercises the real shell and message component without an account. */
export function WorkspacePreview() {
  const state = useState();
  const [channel, setChannel] = createSignal("geral");
  const [draft, setDraft] = createSignal("");
  const [messages, setMessages] = createSignal<string[]>([]);
  const [hint, setHint] = createSignal("");
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const send = () => {
    if (draft().trim()) {
      setMessages([...messages(), draft()]);
      setDraft("");
    }
  };
  return (
    <Workspace demo onSettings={() => setSettingsOpen(true)}>
      <SettingsPreview open={settingsOpen()} onOpenChange={setSettingsOpen} />
      <WorkspaceModule id="navigation">
        <nav class="demo-rail" aria-label="Servidores de demonstração">
          <button
            class="demo-server demo-server--brand"
            title="Início"
            onClick={() => setChannel("geral")}
          >
            s.
          </button>
          <div class="demo-rail-line" />
          <button
            class="demo-server"
            data-active="true"
            title="Nosso espaço"
            onClick={() => setChannel("geral")}
          >
            N<span class="demo-server-indicator" />
          </button>
          <button
            class="demo-server demo-server--purple"
            title="Design club"
            onClick={() => setChannel("design")}
          >
            D
          </button>
          <button
            class="demo-server demo-server--sand"
            title="Entre amigos"
            onClick={() => setChannel("amigos")}
          >
            A
          </button>
          <button
            class="demo-server demo-server--add"
            title="Adicionar servidor"
            onClick={() =>
              setHint(
                "Prévia de design: os servidores reais aparecem após o login.",
              )
            }
          >
            <Plus size={20} />
          </button>
          <div class="demo-rail-bottom">
            <button
              class="ws-icon-button"
              title="Personalizar"
              aria-label="Personalizar tema"
              classList={{ "demo-desktop-personalize": true }}
              onClick={() => state.layout.setStudioOpen(true)}
            >
              <Settings2 size={19} />
            </button>
            <span class="demo-self">
              pe
              <i />
            </span>
          </div>
        </nav>
      </WorkspaceModule>
      <WorkspaceModule id="channels">
        <PreviewChannels selected={channel()} onSelect={setChannel} />
      </WorkspaceModule>
      <WorkspaceModule id="conversation">
        <div class="demo-chat">
          <header class="demo-chat-header">
            <Hash size={21} />
            <strong>{channel()}</strong>
            <span class="demo-topic">o começo de uma boa conversa</span>
            <div />
            <button
              class="ws-icon-button"
              aria-label="Mensagens fixadas"
              onClick={() =>
                setHint(
                  "Na conversa real, esta ação abre as mensagens fixadas.",
                )
              }
            >
              <Pin size={17} />
            </button>
            <PreviewMembersButton />
            <ExpandChatButton />
            <button
              class="ws-icon-button"
              aria-label="Buscar mensagens"
              onClick={() =>
                setHint("A busca real está disponível nas conversas da conta.")
              }
            >
              <Search size={17} />
            </button>
          </header>
          <ListView2
            atStart={() => true}
            atEnd={() => true}
            permitFetching={() => false}
            fetchTop={() => Promise.resolve(undefined)}
            fetchBottom={() => Promise.resolve(undefined)}
          >
            <div class="demo-chat-scroll demo-history-content">
              <div class="demo-channel-welcome">
                <span>
                  <Hash size={30} />
                </span>
                <small>UM ESPAÇO PARA COMPARTILHAR</small>
                <h1>Bem-vindo ao #{channel()}.</h1>
                <p>Ideias, planos e aquelas conversas que vão longe.</p>
              </div>
              <div class="demo-date">
                <span />
                18 de outubro de 2026
                <span />
              </div>
              <For each={DEMO_MEMBERS}>
                {(member) => (
                  <MessageContainer
                    avatar={<Avatar size={36} fallback={member.initials} />}
                    timestamp={new Date(`2026-10-18T${member.time}:00`)}
                    username={
                      <span style={{ color: member.color }}>{member.name}</span>
                    }
                    isLink="hide"
                  >
                    {member.text}
                  </MessageContainer>
                )}
              </For>
              <div class="demo-file">
                <div>
                  <Paperclip size={20} />
                </div>
                <span>
                  <strong>nosso-próximo-projeto.fig</strong>
                  <small>2,4 MB · arquivo de demonstração</small>
                </span>
                <Check size={17} />
              </div>
              <div class="demo-reactions">
                <button
                  onClick={() => setHint("Uma reação no visual do seu tema.")}
                >
                  ✨ <span>3</span>
                </button>
                <button
                  onClick={() => setHint("Uma reação no visual do seu tema.")}
                >
                  💚 <span>2</span>
                </button>
              </div>
              <For each={messages()}>
                {(message) => (
                  <MessageContainer
                    avatar={<Avatar size={36} fallback="pe" />}
                    timestamp={new Date()}
                    username="Pedro"
                    isLink="hide"
                  >
                    {message}
                  </MessageContainer>
                )}
              </For>
              <Show when={hint()}>
                <p class="demo-hint" role="status">
                  {hint()}
                </p>
              </Show>
            </div>
          </ListView2>
          <form
            class="demo-composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <button
              type="button"
              class="ws-icon-button"
              aria-label="Anexar arquivo"
              onClick={() =>
                setHint(
                  "Uploads, arrastar arquivos e colar imagens continuam disponíveis no cliente real.",
                )
              }
            >
              <Plus size={21} />
            </button>
            <input
              aria-label="Mensagem de demonstração"
              placeholder={`Conversar em #${channel()}`}
              value={draft()}
              onInput={(e) => setDraft(e.currentTarget.value)}
            />
            <button
              type="button"
              class="ws-icon-button"
              aria-label="Emojis"
              onClick={() => setDraft((value) => value + " ✨")}
            >
              <Smile size={19} />
            </button>
            <button
              type="submit"
              class="ws-icon-button"
              aria-label="Enviar mensagem de demonstração"
            >
              <Send size={18} />
            </button>
          </form>
          <div class="demo-typing">
            <span />
            Marina está digitando
            <span class="demo-typing-note">
              Demonstração local · sem envio ao servidor
            </span>
          </div>
        </div>
      </WorkspaceModule>
      <WorkspaceModule id="members">
        <div class="demo-members">
          <header>
            <Users size={16} />
            <strong>Pessoas</strong>
            <span>4</span>
          </header>
          <small>ONLINE — 3</small>
          <For each={DEMO_MEMBERS}>
            {(member) => (
              <button
                class="demo-member"
                onClick={() =>
                  setHint(`Os perfis reais abrem pelo menu de ${member.name}.`)
                }
              >
                <span
                  class="ws-sample-avatar"
                  style={{ background: member.color }}
                >
                  {member.initials}
                  <i />
                </span>
                <span>
                  <strong>{member.name}</strong>
                  <small>
                    {member.name === "Pedro"
                      ? "Explorando possibilidades"
                      : member.name === "Marina"
                        ? "Criando alguma coisa"
                        : "Disponível"}
                  </small>
                </span>
              </button>
            )}
          </For>
          <small>OFFLINE — 1</small>
          <div class="demo-member demo-member--offline">
            <span class="ws-sample-avatar">ju</span>
            <span>
              <strong>Julia</strong>
              <small>Volto já</small>
            </span>
          </div>
          <div class="demo-members-note">
            <span>SEU ESPAÇO</span>
            <p>
              Compartilhe ideias.
              <br />
              Faça parte da conversa.
            </p>
          </div>
        </div>
      </WorkspaceModule>
      <WorkspaceModule id="voice">
        <PreviewCall />
      </WorkspaceModule>
    </Workspace>
  );
}

function PreviewCall() {
  const state = useState();
  const sound = useSound();
  const workspace = useWorkspace();
  const [muted, setMuted] = createSignal(false);
  const [deafened, setDeafened] = createSignal(false);
  const [camera, setCamera] = createSignal(false);
  const [screen, setScreen] = createSignal(false);
  const [connected, setConnected] = createSignal(false);
  const [compact, setCompact] = createSignal(false);
  let previewCall!: HTMLDivElement;
  onMount(() =>
    createResizeObserver(previewCall, (_size, element) => {
      setCompact(isCompactCallSize(element.offsetWidth, element.offsetHeight));
    }),
  );
  const expand = () => state.layout.setVoiceExpanded(true);
  const actions = (hide: () => void) => (
    <div
      class="ws-call-actions"
      data-ui-sound="off"
      role="group"
      aria-label="Controles da chamada de demonstração"
    >
      <Show when={!compact()}>
        <CallControlButton label="Esconder bandeja" onClick={hide}>
          <ChevronDown />
        </CallControlButton>
      </Show>
      <CallControlButton
        label={muted() ? "Ativar microfone" : "Mutar"}
        pressed={muted()}
        tone={muted() ? "muted" : undefined}
        onClick={() => {
          sound.playSound(muted() ? "unmute" : "mute");
          setMuted(!muted());
        }}
      >
        <Show when={muted()} fallback={<Mic />}>
          <MicOff />
        </Show>
      </CallControlButton>
      <CallControlButton
        label={deafened() ? "Ativar áudio" : "Ensurdecer"}
        pressed={deafened()}
        tone={deafened() ? "muted" : undefined}
        onClick={() => {
          sound.playSound(deafened() ? "undeafen" : "deafen");
          setDeafened(!deafened());
        }}
      >
        <Show when={deafened()} fallback={<Headphones />}>
          <HeadphoneOff />
        </Show>
      </CallControlButton>
      <CallControlButton
        label="Câmera"
        pressed={camera()}
        tone={camera() ? "active" : undefined}
        onClick={() => {
          sound.playSound(camera() ? "cameraOff" : "cameraOn");
          setCamera(!camera());
        }}
      >
        <Video />
      </CallControlButton>
      <CallControlButton
        label="Compartilhar tela"
        pressed={screen()}
        tone={screen() ? "active" : undefined}
        onClick={() => {
          sound.playSound(screen() ? "streamEnd" : "streamStart");
          setScreen(!screen());
        }}
      >
        <MonitorUp />
      </CallControlButton>
      <CallControlButton
        label="Desconectar"
        tone="disconnect"
        onClick={() => {
          setConnected(false);
          sound.playSound("userLeaveVoice");
          state.layout.setVoiceExpanded(false);
        }}
      >
        <PhoneOff />
      </CallControlButton>
      <Show when={compact()}>
        <PreviewSfxButton />
      </Show>
    </div>
  );
  return (
    <div ref={previewCall} class="demo-call" data-compact={compact()}>
      <Show
        when={!compact()}
        fallback={
          <CompactCallFrame
            channel="Sala de estar"
            status={connected() ? "Voz conectada" : "Prévia local"}
            count={connected() ? 7 : 1}
            streams={screen() ? 1 : 0}
            onExpand={expand}
            tools={(hide) => (
              <div class="call-layout-controls">
                <CallControlButton
                  label="Usar Living Room"
                  onClick={() => {
                    state.livingRoom.enabled = true;
                    expand();
                  }}
                >
                  <Armchair />
                </CallControlButton>
                <CallControlButton label="Esconder bandeja" onClick={hide}>
                  <ChevronDown />
                </CallControlButton>
                <CallControlButton
                  label="Trocar posições de conversa e chamada"
                  onClick={() => state.layout.swapConversationVoice()}
                >
                  <ArrowLeftRight />
                </CallControlButton>
              </div>
            )}
            actions={
              <Show
                when={connected()}
                fallback={
                  <button
                    class="ws-button ws-button--accent"
                    onClick={() => setConnected(true)}
                  >
                    Simular chamada
                  </button>
                }
              >
                {actions(() => {})}
              </Show>
            }
          >
            <CompactCallAvatar
              name="Pedro"
              speaking={connected()}
              onClick={expand}
            />
            <Show when={connected()}>
              <For each={DEMO_MEMBERS}>
                {(person) => (
                  <CompactCallAvatar name={person.name} onClick={expand} />
                )}
              </For>
            </Show>
          </CompactCallFrame>
        }
      >
        <header>
          <Headphones size={17} />
          <strong>Sala de estar</strong>
          <CallControlButton
            label="Alternar Living Room"
            pressed={state.livingRoom.enabled}
            onClick={() =>
              (state.livingRoom.enabled = !state.livingRoom.enabled)
            }
          >
            <Armchair />
          </CallControlButton>
          <Show when={!workspace?.narrow()}>
            <div class="call-layout-controls">
              <CallControlButton
                label="Trocar posições de conversa e chamada"
                onClick={() => state.layout.swapConversationVoice()}
              >
                <ArrowLeftRight />
              </CallControlButton>
              <CallControlButton
                label={
                  state.layout.voiceExpanded
                    ? "Restaurar chamada"
                    : "Maximizar chamada"
                }
                pressed={state.layout.voiceExpanded}
                onClick={() =>
                  state.layout.setVoiceExpanded(!state.layout.voiceExpanded)
                }
              >
                <Show
                  when={state.layout.voiceExpanded}
                  fallback={<Maximize2 />}
                >
                  <Minimize2 />
                </Show>
              </CallControlButton>
            </div>
          </Show>
        </header>
        <Show
          when={state.livingRoom.enabled}
          fallback={
            <div class="demo-call-stage">
              <span class="demo-call-avatar">pe</span>
              <span>
                {connected()
                  ? "Pedro · chamada de demonstração"
                  : "Prévia local · sem conexão de voz"}
              </span>
            </div>
          }
        >
          <RoomWorkspace />
        </Show>
        <Show
          when={connected()}
          fallback={
            <button
              class="ws-button ws-button--accent"
              data-ui-sound="off"
              onClick={() => {
                setConnected(true);
                sound.playSound("userJoinVoice");
              }}
            >
              <Phone size={15} />
              Simular chamada
            </button>
          }
        >
          <CallControlsTray>{actions}</CallControlsTray>
        </Show>
      </Show>
    </div>
  );
}
function PreviewMembersButton() {
  const workspace = useWorkspace();
  return (
    <button
      class="ws-icon-button"
      aria-label="Ver pessoas"
      onClick={() => workspace?.reveal("members")}
    >
      <Users size={18} />
    </button>
  );
}
function PreviewSfxButton() {
  const [anchor, setAnchor] = createSignal<HTMLButtonElement>();
  const id = createUniqueId();
  return (
    <>
      <button
        type="button"
        class="call-control"
        aria-label="Efeitos sonoros"
        aria-haspopup="dialog"
        aria-expanded={!!anchor()}
        onClick={(e) => setAnchor(anchor() ? undefined : e.currentTarget)}
      >
        <Music2 />
      </button>
      <Show when={anchor()} keyed>
        {(button) => (
          <SoundboardQuickMenu
            anchor={button}
            id={id}
            onClose={() => setAnchor(undefined)}
          />
        )}
      </Show>
    </>
  );
}
function PreviewChannels(props: {
  selected: string;
  onSelect: (name: string) => void;
}) {
  const workspace = useWorkspace();
  return (
    <div class="demo-channels">
      <header>
        <span>Nosso espaço</span>
        <ChevronDown size={16} />
      </header>
      <div class="demo-server-description">
        <span class="demo-community-icon">N</span>
        <span>
          Uma comunidade pequena.
          <br />
          Um mundo de possibilidades.
        </span>
      </div>
      <div class="demo-channel-category">
        CONVERSAS <Plus size={12} />
      </div>
      <For
        each={[
          ["geral", "8"],
          ["ideias", ""],
          ["projetos", "2"],
          ["links-e-referências", ""],
        ]}
      >
        {([name, count]) => (
          <button
            class="demo-channel"
            data-active={props.selected === name}
            onClick={() => {
              props.onSelect(name);
              workspace?.reveal("conversation");
            }}
          >
            <Hash size={17} />
            <span>{name}</span>
            <Show when={count}>
              <small>{count}</small>
            </Show>
          </button>
        )}
      </For>
      <div class="demo-channel-category">
        UM POUCO DE TUDO <ChevronDown size={12} />
      </div>
      <For each={["música", "jogos", "fora-de-assunto"]}>
        {(name) => (
          <button
            class="demo-channel"
            data-active={props.selected === name}
            onClick={() => {
              props.onSelect(name);
              workspace?.reveal("conversation");
            }}
          >
            <Hash size={17} />
            <span>{name}</span>
          </button>
        )}
      </For>
      <div class="demo-channel-category">
        SALAS DE VOZ <Plus size={12} />
      </div>
      <button class="demo-channel" onClick={() => workspace?.reveal("voice")}>
        <Headphones size={17} />
        <span>Sala de estar</span>
      </button>
      <div class="demo-channel-footnote">
        <span>✦</span>Boas conversas vivem aqui.
      </div>
    </div>
  );
}
