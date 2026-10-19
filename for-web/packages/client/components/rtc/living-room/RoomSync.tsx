import { useState } from "@revolt/state";
import {
  type RemoteParticipant,
  ConnectionState,
  RoomEvent,
} from "livekit-client";
import { createEffect, createSignal, onCleanup, untrack } from "solid-js";
import { useVoice } from "../state";
import { type Point, clamp, scenePoint } from "./model";
import {
  type SharedPosition,
  emptyRoomSync,
  newerPosition,
  readSharedPosition,
  roomIdentity,
} from "./syncModel";

const TOPIC = "bofonasu.living-room.v1";
const encoder = new TextEncoder(),
  decoder = new TextDecoder();
type Presence = {
  sid: string;
  seq: number;
  seen: number;
  viewing: boolean;
  synchronized: boolean;
};

/** Ephemeral per-call collaboration over the existing authenticated LiveKit room.
 * Local scenes are never overwritten by incoming coordinates. */
export function RoomSyncManager() {
  const voice = useVoice(),
    state = useState(),
    settings = state.livingRoom;
  const [visible, setVisible] = createSignal(
    document.visibilityState === "visible",
  );
  const visibility = () => setVisible(document.visibilityState === "visible");
  document.addEventListener("visibilitychange", visibility);
  onCleanup(() => document.removeEventListener("visibilitychange", visibility));
  createEffect(() => {
    const room = voice.room(),
      channel = voice.channel()?.id,
      account = state.auth.getSession()?.userId;
    settings.setSyncState(emptyRoomSync());
    if (!room || !channel || !account) return;
    const [connected, setConnected] = createSignal(
      room.state === ConnectionState.Connected,
    );
    const [canSend, setCanSend] = createSignal(
      room.localParticipant.permissions?.canPublishData !== false,
    );
    const peers = new Map<string, Presence>(),
      positions = new Map<string, SharedPosition>(),
      pending = new Map<string, SharedPosition>();
    const rates = new Map<string, { start: number; count: number }>();
    let alive = true,
      active = false,
      viewing = false,
      syncOption = false;
    let clock = 0,
      sequence = 0,
      sending = false,
      issue = "",
      ticks = 0;
    let bootstrapped = false,
      enteredAt = 0,
      generation = 0;
    let flushTimer: ReturnType<typeof setTimeout> | undefined,
      seedTimer: ReturnType<typeof setTimeout> | undefined;
    const selfId = () => room.localParticipant.identity;
    const writer = () => `${selfId()}:${room.localParticipant.sid}`;
    const identities = () =>
      [selfId(), ...room.remoteParticipants.keys()]
        .filter(roomIdentity)
        .sort()
        .slice(0, 80);
    const currentParticipant = (id: string) =>
      id === selfId() || room.remoteParticipants.has(id);
    const update = () => {
      if (!alive) return;
      const now = Date.now();
      const statusPeers = Object.fromEntries(
        [...peers]
          .filter(
            ([id, p]) =>
              room.remoteParticipants.get(id)?.sid === p.sid &&
              now - p.seen < 18000,
          )
          .map(([id, p]) => [
            id,
            { viewing: p.viewing, synchronized: p.synchronized },
          ]),
      );
      if (selfId())
        statusPeers[selfId()] = { viewing, synchronized: active && !issue };
      settings.setSyncState({
        channel,
        selfId: selfId(),
        active,
        status:
          !syncOption || (!active && connected() && canSend())
            ? "idle"
            : issue || !canSend()
              ? "error"
              : connected() && bootstrapped
                ? "ready"
                : "connecting",
        error: !canSend()
          ? "O servidor desta chamada não permite enviar dados de sincronização."
          : issue,
        positions: Object.fromEntries(
          [...positions].map(([id, p]) => [id, { x: p.x, y: p.y }]),
        ),
        peers: statusPeers,
      });
    };
    async function send(
      message: Record<string, unknown>,
      destination?: string,
    ) {
      if (!alive || !connected() || !canSend()) return false;
      const bytes = encoder.encode(JSON.stringify({ v: 1, ...message }));
      if (bytes.byteLength > 12000) return false;
      try {
        await room!.localParticipant.publishData(bytes, {
          reliable: true,
          topic: TOPIC,
          destinationIdentities: destination ? [destination] : undefined,
        });
        if (alive && issue) {
          issue = "";
          update();
        }
        return true;
      } catch {
        if (alive) {
          issue = "Não foi possível enviar as posições. Tentando reconectar…";
          update();
        }
        return false;
      }
    }
    function presence(request = false, destination?: string) {
      return send(
        {
          type: "presence",
          seq: ++sequence,
          viewing,
          synchronized: active,
          request,
        },
        destination,
      );
    }
    async function snapshot(destination?: string) {
      if (!active) return;
      const ticket = generation;
      const entries = [...positions.values()].filter((p) =>
        currentParticipant(p.id),
      );
      for (
        let i = 0;
        alive && active && ticket === generation && i < entries.length;
        i += 16
      )
        await send(
          {
            type: "snapshot",
            positions: entries.slice(i, i + 16),
            complete: i + 16 >= entries.length,
          },
          destination,
        );
    }
    function merge(entries: unknown[], senderWriter?: string) {
      let changed = false;
      for (const entry of entries.slice(0, 16)) {
        const point = readSharedPosition(entry);
        if (
          !point ||
          !currentParticipant(point.id) ||
          (senderWriter && point.writer !== senderWriter)
        )
          continue;
        clock = Math.max(clock, point.clock);
        if (newerPosition(point, positions.get(point.id))) {
          positions.set(point.id, point);
          changed = true;
        }
      }
      if (changed) update();
    }
    async function flush() {
      flushTimer = undefined;
      if (!alive || !active || sending || !pending.size) return;
      sending = true;
      const ticket = generation;
      const entries = [...pending.values()].slice(0, 16);
      entries.forEach((p) => pending.delete(p.id));
      const ok = await send({ type: "move", positions: entries });
      sending = false;
      if (!alive || !active) return;
      if (!ok && ticket === generation)
        entries.forEach((p) => {
          if (!pending.has(p.id)) pending.set(p.id, p);
        });
      if (pending.size)
        flushTimer = setTimeout(() => void flush(), ok ? 50 : 1000);
    }
    function move(id: string, point: Point) {
      if (
        !alive ||
        !active ||
        !canSend() ||
        !roomIdentity(id) ||
        !currentParticipant(id)
      )
        return;
      const next = {
        id,
        x: clamp(point.x, 0.015, 0.985),
        y: clamp(point.y, 0.015, 0.985),
        clock: ++clock,
        writer: writer(),
      };
      positions.set(id, next);
      pending.set(id, next);
      update(); // Own dragging follows the pointer immediately, independent of network cadence.
      if (!sending && !flushTimer)
        flushTimer = setTimeout(() => void flush(), 50);
    }
    function seed() {
      if (!active || !alive) return;
      // Existing peers may be responding over a slow connection. Do not replace
      // their seats with this client's local preset before the full snapshot arrives.
      if (
        !bootstrapped &&
        [...peers.values()].some(
          (p) => p.synchronized && Date.now() - p.seen < 18000,
        ) &&
        Date.now() - enteredAt < 5000
      ) {
        seedTimer = setTimeout(seed, 400);
        return;
      }
      bootstrapped = true;
      settings.assign(channel!, identities());
      for (const id of identities()) {
        if (positions.has(id)) continue;
        const point = scenePoint(settings.scene, channel!, id, id === selfId());
        move(id, point);
      }
      update();
    }
    const receive = (
      bytes: Uint8Array,
      participant?: RemoteParticipant,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (
        !alive ||
        topic !== TOPIC ||
        !participant ||
        bytes.byteLength > 12000 ||
        room.remoteParticipants.get(participant.identity)?.sid !==
          participant.sid
      )
        return;
      const now = Date.now(),
        rate = rates.get(participant.sid);
      if (rate && now - rate.start < 1000) {
        if (++rate.count > 60) return;
      } else rates.set(participant.sid, { start: now, count: 1 });
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(decoder.decode(bytes));
      } catch {
        return;
      }
      if (!message || message.v !== 1) return;
      if (message.type === "presence") {
        if (
          !Number.isSafeInteger(message.seq) ||
          Number(message.seq) < 1 ||
          typeof message.viewing !== "boolean" ||
          typeof message.synchronized !== "boolean"
        )
          return;
        const previous = peers.get(participant.identity);
        if (
          previous?.sid === participant.sid &&
          Number(message.seq) <= previous.seq
        )
          return;
        peers.set(participant.identity, {
          sid: participant.sid,
          seq: Number(message.seq),
          seen: now,
          viewing: message.viewing,
          synchronized: message.synchronized,
        });
        update();
        if (message.request === true) {
          void presence(false, participant.identity);
          if (message.synchronized) void snapshot(participant.identity);
        }
      } else if (
        active &&
        (message.type === "move" || message.type === "snapshot") &&
        Array.isArray(message.positions) &&
        message.positions.length <= 16
      ) {
        const peer = peers.get(participant.identity);
        if (!peer?.synchronized || now - peer.seen >= 18000) return;
        merge(
          message.positions,
          message.type === "move"
            ? `${participant.identity}:${participant.sid}`
            : undefined,
        );
        if (message.type === "snapshot" && message.complete === true) {
          bootstrapped = true;
          clearTimeout(seedTimer);
          seed();
        }
      }
    };
    const connection = () => {
      setConnected(room.state === ConnectionState.Connected);
      setCanSend(room.localParticipant.permissions?.canPublishData !== false);
    };
    const joined = (p: RemoteParticipant) => {
      void presence(true, p.identity);
      if (active) {
        clearTimeout(seedTimer);
        seedTimer = setTimeout(seed, 400);
      }
    };
    const left = (p: RemoteParticipant) => {
      peers.delete(p.identity);
      positions.delete(p.identity);
      pending.delete(p.identity);
      rates.delete(p.sid);
      update();
    };
    // eslint-disable-next-line solid/reactivity -- SDK event handlers intentionally sample current preferences on receipt.
    room.on(RoomEvent.DataReceived, receive);
    room.on(RoomEvent.ConnectionStateChanged, connection);
    room.on(RoomEvent.ParticipantPermissionsChanged, connection);
    // eslint-disable-next-line solid/reactivity -- SDK connection events read the current scene once.
    room.on(RoomEvent.ParticipantConnected, joined);
    // eslint-disable-next-line solid/reactivity -- SDK disconnect events update ephemeral presence once.
    room.on(RoomEvent.ParticipantDisconnected, left);
    // eslint-disable-next-line solid/reactivity -- Called by explicit drag and keyboard events, not a reactive computation.
    settings.bindSharedMove(move);
    createEffect(() => {
      const isConnected = connected(),
        permitted = canSend();
      const nextViewing =
        settings.enabled && settings.viewing === channel && visible();
      const nextOption = settings.synchronized;
      const roomMode = settings.enabled;
      untrack(() => {
        const nextActive = isConnected && permitted && roomMode && nextOption;
        const entering = nextActive && !active;
        if (nextActive !== active) generation++;
        viewing = nextViewing;
        syncOption = nextOption;
        active = nextActive;
        if (!active) {
          clearTimeout(flushTimer);
          flushTimer = undefined;
          clearTimeout(seedTimer);
          pending.clear();
          positions.clear();
          bootstrapped = false;
        }
        update();
        if (isConnected && permitted) void presence(true);
        if (entering) {
          enteredAt = Date.now();
          clearTimeout(seedTimer);
          seedTimer = setTimeout(seed, 400);
        }
      });
    });
    const heartbeat = setInterval(() => {
      if (!alive) return;
      for (const [id, p] of peers)
        if (Date.now() - p.seen >= 18000) peers.delete(id);
      update();
      if (connected()) {
        void presence();
        if (active && ++ticks % 2 === 0) void snapshot(); // Heal missed final updates and reconnecting peers.
      }
    }, 5000);
    onCleanup(() => {
      if (connected() && canSend()) {
        viewing = active = false;
        void presence();
      }
      alive = false;
      clearTimeout(flushTimer);
      clearTimeout(seedTimer);
      clearInterval(heartbeat);
      room.off(RoomEvent.DataReceived, receive);
      room.off(RoomEvent.ConnectionStateChanged, connection);
      room.off(RoomEvent.ParticipantPermissionsChanged, connection);
      room.off(RoomEvent.ParticipantConnected, joined);
      room.off(RoomEvent.ParticipantDisconnected, left);
      settings.bindSharedMove(undefined);
      settings.setSyncState(emptyRoomSync());
    });
  });
  return null;
}
