import { useSound } from "@revolt/client";
import {
  type RemoteParticipant,
  ConnectionState,
  RoomEvent,
  Track,
} from "livekit-client";
import { createEffect, onCleanup } from "solid-js";
import { useVoice } from "../state";

const TOPIC = "bofonasu.stream-viewers.v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Viewer presence belongs to the call, not to a renderer. Fullscreen and room
 * handoffs therefore don't create duplicate join/leave notifications. No audio
 * is published: every client plays its bundled effect locally. */
export function StreamViewerSounds() {
  const voice = useVoice();
  const sound = useSound();
  createEffect(() => {
    const room = voice.room();
    if (!room) return;
    const peers = new Map<
      string,
      { sid: string; seq: number; tracks: Set<string> }
    >();
    const rates = new Map<string, { since: number; count: number }>();
    const absentSince = new Map<string, number>();
    let watched = new Set<string>();
    let lastSent = "",
      lastPublish = 0,
      sequence = 0;
    let alive = true,
      sending = false;
    let quietUntil = Date.now() + 1500;

    function ownerOf(sid: string) {
      for (const participant of [
        room!.localParticipant,
        ...room!.remoteParticipants.values(),
      ]) {
        const publication = participant.trackPublications.get(sid);
        if (publication?.source === Track.Source.ScreenShare)
          return participant.identity;
      }
    }
    function audible(sid: string) {
      // Ending a stream isn't a viewer leaving that stream.
      return !!ownerOf(sid) && room!.state === ConnectionState.Connected;
    }
    async function send(
      type: "watch" | "snapshot" | "hello",
      destination?: string,
    ) {
      if (
        !alive ||
        room!.state !== ConnectionState.Connected ||
        room!.localParticipant.permissions?.canPublishData === false
      )
        return false;
      try {
        await room!.localParticipant.publishData(
          encoder.encode(
            JSON.stringify({
              v: 1,
              type,
              seq: ++sequence,
              tracks: [...watched],
            }),
          ),
          {
            reliable: true,
            topic: TOPIC,
            destinationIdentities: destination ? [destination] : undefined,
          },
        );
        return true;
      } catch {
        // The next scan retries; this must never interrupt media playback.
        return false;
      }
    }
    function visible(element: HTMLMediaElement) {
      if (
        !element.isConnected ||
        getComputedStyle(element).visibility !== "visible"
      )
        return false;
      const rect = element.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < innerHeight &&
        rect.left < innerWidth
      );
    }
    function scan() {
      if (!alive || room!.state !== ConnectionState.Connected) return;
      const now = Date.now();
      const next = new Set<string>();
      for (const participant of room!.remoteParticipants.values()) {
        for (const publication of participant.videoTrackPublications.values()) {
          if (publication.source !== Track.Source.ScreenShare) continue;
          if (publication.track?.attachedElements.some(visible)) {
            next.add(publication.trackSid);
            absentSince.delete(publication.trackSid);
          } else if (watched.has(publication.trackSid)) {
            const absent = absentSince.get(publication.trackSid) ?? now;
            absentSince.set(publication.trackSid, absent);
            if (now - absent < 1000) next.add(publication.trackSid);
          }
        }
      }
      watched = next;
      for (const sid of absentSince.keys())
        if (!ownerOf(sid)) absentSince.delete(sid);
      const key = [...watched].sort().join(",");
      if (sending || (key === lastSent && now - lastPublish < 8000)) return;
      sending = true;
      void send("watch").then((ok) => {
        sending = false;
        if (ok) {
          lastSent = key;
          lastPublish = now;
        }
      });
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
        bytes.byteLength > 4096 ||
        room.remoteParticipants.get(participant.identity)?.sid !==
          participant.sid
      )
        return;
      const now = Date.now();
      const rate = rates.get(participant.identity) ?? { since: now, count: 0 };
      if (now - rate.since >= 1000) {
        rate.since = now;
        rate.count = 0;
      }
      rates.set(participant.identity, rate);
      if (++rate.count > 12) return;
      let message;
      try {
        message = JSON.parse(decoder.decode(bytes));
      } catch {
        return;
      }
      if (
        !message ||
        message.v !== 1 ||
        !["hello", "watch", "snapshot"].includes(message.type) ||
        !Number.isSafeInteger(message.seq) ||
        message.seq < 0 ||
        !Array.isArray(message.tracks) ||
        message.tracks.length > 80
      )
        return;
      const previous = peers.get(participant.identity);
      if (previous?.sid === participant.sid && message.seq <= previous.seq)
        return;
      const tracks = new Set<string>();
      for (const sid of message.tracks) {
        if (typeof sid !== "string" || sid.length > 128) return;
        const owner = ownerOf(sid);
        if (owner && owner !== participant.identity) tracks.add(sid);
      }
      peers.set(participant.identity, {
        sid: participant.sid,
        seq: message.seq,
        tracks,
      });
      if (message.type === "watch" && now > quietUntil) {
        const before =
          previous?.sid === participant.sid
            ? previous.tracks
            : new Set<string>();
        if ([...tracks].some((sid) => !before.has(sid)))
          sound.playSound("streamViewerJoin");
        if ([...before].some((sid) => !tracks.has(sid) && audible(sid)))
          sound.playSound("streamViewerLeave");
      }
      if (message.type === "hello") void send("snapshot", participant.identity);
    };
    const left = (participant: RemoteParticipant) => {
      const previous = peers.get(participant.identity);
      if (
        previous?.sid === participant.sid &&
        [...previous.tracks].some(audible)
      )
        sound.playSound("streamViewerLeave");
      peers.delete(participant.identity);
      rates.delete(participant.identity);
    };
    const connected = () => {
      if (room.state !== ConnectionState.Connected) return;
      quietUntil = Date.now() + 1500;
      lastPublish = 0;
      scan();
      void send("hello");
    };
    room.on(RoomEvent.DataReceived, receive);
    room.on(RoomEvent.ParticipantDisconnected, left);
    room.on(RoomEvent.ConnectionStateChanged, connected);
    connected();
    const timer = setInterval(scan, 250);
    onCleanup(() => {
      if (watched.size) {
        watched = new Set();
        void send("watch");
      }
      alive = false;
      clearInterval(timer);
      room.off(RoomEvent.DataReceived, receive);
      room.off(RoomEvent.ParticipantDisconnected, left);
      room.off(RoomEvent.ConnectionStateChanged, connected);
    });
  });
  return null;
}
