import { useClient, useUser } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Avatar } from "@revolt/ui";
import {
  ArrowRight,
  Compass,
  Heart,
  MessageSquare,
  MessagesSquare,
  Plus,
  Settings2,
  Sparkles,
  Users,
} from "lucide-solid";
import { For, Show } from "solid-js";
import { PublicChannelInvite } from "stoat.js";

export function HomePage() {
  const client = useClient();
  const user = useUser();
  const state = useState();
  const navigate = useNavigate();
  const instance = useInstance();
  const { openModal, showError } = useModals();
  const conversations = () =>
    state.ordering.orderedConversations(client()).slice(0, 5);
  function lounge() {
    if (client().servers.has("01F7ZSBSFHQ8TA81725KQCSDDP"))
      navigate("/server/01F7ZSBSFHQ8TA81725KQCSDDP");
    else
      client()
        .api.get("/invites/Testers")
        .then((invite) => PublicChannelInvite.from(client(), invite))
        .then((invite) => openModal({ type: "invite", invite }))
        .catch(showError);
  }
  return (
    <div class="ws-home">
      <header class="ws-home-header">
        <span>
          <MessagesSquare size={17} />
          Visão geral
        </span>
        <button
          class="ws-icon-button"
          aria-label="Configurações"
          onClick={() => openModal({ type: "settings", config: "user" })}
        >
          <Settings2 size={17} />
        </button>
      </header>
      <div class="ws-home-scroll">
        <div class="ws-home-greeting">
          <span class="studio-eyebrow">SEU PONTO DE ENCONTRO</span>
          <h1>Bom te ver, {user()?.displayName ?? user()?.username}.</h1>
          <p>Uma boa conversa começa com um espaço para chamar de seu.</p>
        </div>
        <button
          class="ws-home-studio"
          onClick={() => state.layout.setStudioOpen(true)}
        >
          <span class="ws-home-studio-icon">
            <Sparkles size={25} />
          </span>
          <span>
            <small>STOAT STUDIO</small>
            <strong>Monte seu próprio espaço.</strong>
            <p>Temas, módulos e layouts. Tudo do seu jeito.</p>
          </span>
          <ArrowRight size={21} />
        </button>
        <div class="ws-home-section">
          <h2>Continue a conversa</h2>
          <a href="/friends">
            Ver amigos <ArrowRight size={13} />
          </a>
        </div>
        <Show
          when={conversations().length}
          fallback={
            <div class="ws-home-empty">
              <MessageSquare size={24} />
              <strong>O próximo papo está logo ali.</strong>
              <span>Encontre seus amigos ou crie um grupo para começar.</span>
              <a class="ws-button ws-button--quiet" href="/friends">
                <Users size={15} />
                Encontrar amigos
              </a>
            </div>
          }
        >
          <div class="ws-home-conversations">
            <For each={conversations()}>
              {(channel) => (
                <a href={`/channel/${channel.id}`}>
                  <Avatar
                    size={34}
                    src={channel.iconURL}
                    fallback={channel.displayName}
                  />
                  <span>
                    <strong>{channel.displayName}</strong>
                    <small>
                      {channel.unread
                        ? "Novas mensagens esperando por você"
                        : "Continuar conversando"}
                    </small>
                  </span>
                  <Show when={channel.unread}>
                    <i />
                  </Show>
                  <ArrowRight size={15} />
                </a>
              )}
            </For>
          </div>
        </Show>
        <div class="ws-home-section">
          <h2>Mais possibilidades</h2>
        </div>
        <div class="ws-home-grid">
          <button
            onClick={() =>
              openModal({ type: "create_group_or_server", client: client() })
            }
          >
            <Plus size={20} />
            <strong>Crie um ponto de encontro</strong>
            <span>Um grupo de amigos ou sua próxima comunidade.</span>
          </button>
          <Show when={instance.isStoat}>
            <button onClick={() => navigate("/discover")}>
              <Compass size={20} />
              <strong>Descubra comunidades</strong>
              <span>Encontre quem compartilha os seus interesses.</span>
            </button>
            <button onClick={lounge}>
              <Users size={20} />
              <strong>Stoat Lounge</strong>
              <span>Converse com a comunidade e acompanhe o projeto.</span>
            </button>
          </Show>
          <button
            onClick={() =>
              window.open(
                "https://ko-fi.com/stoatchat",
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            <Heart size={20} />
            <strong>Apoie o Stoat</strong>
            <span>Ajude a manter a conversa aberta.</span>
          </button>
        </div>
        <footer class="ws-home-footer">
          <span>Feito para conectar pessoas.</span>
          <button
            onClick={() =>
              openModal({
                type: "settings",
                config: "user",
                context: { page: "feedback" },
              })
            }
          >
            Enviar feedback <ArrowRight size={12} />
          </button>
        </footer>
      </div>
    </div>
  );
}
