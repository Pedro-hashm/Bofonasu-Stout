import { useClient } from "@revolt/client";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js";
import type { Channel, Message } from "stoat.js";
import { type RoomChatMedia, roomChatMedia } from "./roomChatMedia";

export type RoomChatEntry = {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  shownAt: number;
  media?: RoomChatMedia[];
};
export type RoomChatFeed = {
  messages: RoomChatEntry[];
  channelName: string;
  status?: string;
};

/** Bounded, read-only view of the normal chat; does not acknowledge or persist messages. */
export function useRoomChat(
  channel: Accessor<Channel | undefined>,
  enabled: Accessor<boolean>,
): Accessor<RoomChatFeed> {
  const client = useClient();
  const [items, setItems] = createSignal<
    { message: Message; shownAt: number }[]
  >([]);
  const [status, setStatus] = createSignal("");
  createEffect(() => {
    const target = channel(),
      c = client();
    const readable = target?.havePermission("ViewChannel");
    setItems([]);
    setStatus("");
    if (!target || !enabled()) return;
    if (!readable) {
      setStatus("Sem acesso a este canal.");
      return;
    }
    let stale = false,
      request = 0;
    const deleted = new Set<string>();
    const merge = (messages: Message[]) =>
      setItems((previous) => {
        const all = new Map(
          messages
            .filter((m) => m.channelId === target.id && !deleted.has(m.id))
            .map((message) => [message.id, { message, shownAt: Date.now() }]),
        );
        for (const item of previous)
          if (!deleted.has(item.message.id)) all.set(item.message.id, item);
        return [...all.values()]
          .sort((a, b) => a.message.id.localeCompare(b.message.id))
          .slice(-50);
      });
    async function load() {
      const token = ++request;
      if (!target!.havePermission("ReadMessageHistory")) {
        setStatus(
          "O histórico está indisponível; novas mensagens aparecerão aqui.",
        );
        return;
      }
      try {
        const result = await target!.fetchMessagesWithUsers({ limit: 30 });
        if (!stale && token === request) {
          merge(result.messages);
          setStatus("");
        }
      } catch {
        if (!stale && token === request)
          setStatus(
            "Não foi possível carregar o histórico. Novas mensagens continuam aparecendo aqui.",
          );
      }
    }
    const add = (message: Message) => {
      if (message.channelId === target.id) merge([message]);
    };
    const update = (message: Message) => {
      if (message.channelId === target.id)
        setItems((previous) =>
          previous.map((item) =>
            item.message.id === message.id ? { ...item, message } : item,
          ),
        );
    };
    const remove = (message: { id: string; channelId: string }) => {
      if (message.channelId !== target.id) return;
      deleted.add(message.id);
      setItems((previous) =>
        previous.filter((item) => item.message.id !== message.id),
      );
    };
    const bulk = (messages: { id: string; channelId: string }[]) =>
      messages.forEach(remove);
    const reconnect = () => {
      deleted.clear();
      setItems([]);
      void load();
    };
    c.on("messageCreate", add);
    c.on("messageUpdate", update);
    c.on("messageDelete", remove);
    c.on("messageDeleteBulk", bulk);
    c.on("ready", reconnect);
    void load();
    onCleanup(() => {
      stale = true;
      c.off("messageCreate", add);
      c.off("messageUpdate", update);
      c.off("messageDelete", remove);
      c.off("messageDeleteBulk", bulk);
      c.off("ready", reconnect);
    });
  });
  const feed = createMemo(() => ({
    channelName: channel()?.displayName ?? "Chat da chamada",
    status: status(),
    messages: items()
      .filter(
        ({ message }) =>
          message.$exists && message.author?.relationship !== "Blocked",
      )
      .map(({ message, shownAt }) => ({
        id: message.id,
        author: message.username ?? "Sistema",
        createdAt: message.createdAt.getTime(),
        shownAt,
        media: roomChatMedia(message, client()),
        text: (
          message.contentPlain ||
          (message.attachments?.length
            ? "[Anexo]"
            : message.systemMessage
              ? "[Mensagem do sistema]"
              : "[Conteúdo incorporado]")
        ).slice(0, 1500),
      })),
  }));
  return feed;
}
