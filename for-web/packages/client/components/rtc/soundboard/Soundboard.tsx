import { useClient } from "@revolt/client";
import { useState } from "@revolt/state";
import {
  type JSX,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  untrack,
  useContext,
} from "solid-js";
import { useVoice } from "../state";
import { SoundboardAudio } from "./audio";
import {
  type CachedAvatar,
  type SharedAvatar,
  AVATAR_BUCKET,
  MAX_AVATAR_BYTES,
  avatarImage,
  avatarPath,
  cachedAvatarKey,
  loadAvatarFile,
  readAvatar,
} from "./avatar";
import { type SoundBackend, soundboardBackend } from "./backend";
import { accountKey, createSoundCache, digest, settings } from "./cache";
import {
  type Playback,
  type SoundEffect,
  type SoundPreferences,
  defaults,
  readPlayback,
  readSound,
} from "./model";
import { SoundboardPanel } from "./SoundboardPanel";
import { uploadBytes } from "./uploads";

function createSoundboard() {
  const state = useState(),
    voice = useVoice(),
    client = useClient();
  const [open, setOpen] = createSignal(false);
  const [sounds, setSounds] = createSignal<SoundEffect[]>([]);
  const [prefs, setPrefs] = createSignal(defaults());
  const [cached, setCached] = createSignal<string[]>([]);
  const [status, setStatus] = createSignal<
    "connecting" | "invite" | "ready" | "offline"
  >("connecting");
  const [error, setError] = createSignal("");
  const [notice, setNotice] = createSignal("");
  const [avatarUrl, setAvatarUrl] = createSignal("");
  const [avatarProfile, setAvatarProfile] = createSignal<SharedAvatar>();
  let avatarToken = 0;
  function displayAvatar(blob?: Blob) {
    const previous = untrack(avatarUrl);
    setAvatarUrl(blob ? URL.createObjectURL(blob) : "");
    if (previous) URL.revokeObjectURL(previous);
  }
  const [working, setWorking] = createSignal(false);
  const [commandBusy, setCommandBusy] = createSignal(false);
  let commandGeneration = 0;
  const [online, setOnline] = createSignal(navigator.onLine);
  const [connected, setConnected] = createSignal(false);
  const [userId, setUserId] = createSignal("");
  const [playback, setPlayback] = createSignal<Playback>();
  const [now, setNow] = createSignal(Date.now());
  const [previewId, setPreviewId] = createSignal("");
  const [blocked, setBlocked] = createSignal(false);
  const [cacheRevision, setCacheRevision] = createSignal(0);
  const [audioRevision, setAudioRevision] = createSignal(0);
  const [downloads, setDownloads] = createSignal<{
    done: number;
    total: number;
    failed: number;
  }>();
  const [clockOffset, setClockOffset] = createSignal(0);
  let backend: SoundBackend | undefined,
    cache: ReturnType<typeof createSoundCache> | undefined;
  let audio: SoundboardAudio | undefined,
    epoch = 0,
    refreshToken = 0,
    cancelDownload = false;
  let persistTimer: ReturnType<typeof setTimeout> | undefined;
  const account = () => state.auth.getSession()?.userId ?? "";
  const pending = createMemo(() =>
    sounds().filter((s) => !cached().includes(s.id)),
  );
  const newSounds = createMemo(() =>
    sounds().filter((s) => Date.parse(s.created_at) > prefs().seenAt),
  );
  const current = createMemo(() => {
    const p = playback(),
      s = sounds().find((s) => s.id === p?.sound_id);
    if (
      !p?.enabled ||
      !s ||
      !p.started_at ||
      now() + clockOffset() >= Date.parse(p.started_at) + s.duration * 1000
    )
      return;
    return s;
  });
  const enabled = () => !!playback()?.enabled;
  const sharedMuted = createMemo(
    () =>
      voice.deafen() ||
      !voice.listenPermission ||
      prefs().muted ||
      prefs().volume === 0,
  );
  const playbackKey = createMemo(
    () =>
      `${playback()?.event_id}:${current()?.id}:${sharedMuted()}:${connected()}:${online()}:${blocked()}`,
  );
  const activeChannel = () => voice.room() && voice.channel()?.id;
  const localKey = () => accountKey(account());
  const fail = (e: unknown) =>
    setError(
      e instanceof Error
        ? e.message
        : typeof e === "object" && e && "message" in e
          ? String(e.message)
          : "Não foi possível concluir. Tente novamente.",
    );
  function preferences(patch: Partial<SoundPreferences>) {
    setPrefs((p) => ({ ...p, ...patch }));
    const key = localKey(),
      data = untrack(prefs);
    clearTimeout(persistTimer);
    persistTimer = setTimeout(
      () => void settings.setItem(`${key}:preferences`, data).catch(fail),
      150,
    );
  }
  async function task(
    action: (generation: number) => Promise<void>,
    controls = false,
    interrupt = false,
  ) {
    if ((controls ? commandBusy() : working()) && !interrupt) return;
    const generation = controls ? ++commandGeneration : 0;
    const ticket = epoch;
    if (controls) setCommandBusy(true);
    else setWorking(true);
    setError("");
    setNotice("");
    try {
      await action(generation);
    } catch (e) {
      if (ticket === epoch && (!controls || generation === commandGeneration))
        fail(e);
    } finally {
      if (ticket === epoch) {
        if (controls) {
          if (generation === commandGeneration) setCommandBusy(false);
        } else setWorking(false);
      }
    }
  }
  async function updateCache() {
    const ticket = epoch,
      currentCache = cache;
    if (!currentCache) return;
    const available = await currentCache.available(untrack(sounds));
    if (ticket === epoch) setCached(available);
  }
  async function refresh() {
    const b = backend,
      ticket = epoch,
      token = ++refreshToken,
      key = localKey();
    if (!b || !userId()) return;
    const data: unknown[] = [];
    for (let offset = 0; ; offset += 500) {
      const page = await b
        .from("soundboard_sounds")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id")
        .range(offset, offset + 499);
      if (ticket !== epoch || token !== refreshToken) return;
      if (page.error)
        throw new Error(
          "Biblioteca indisponível. Confira a conexão ou a configuração do Supabase.",
        );
      data.push(...(page.data ?? []));
      if ((page.data?.length ?? 0) < 500) break;
      if (data.length >= 20000)
        throw new Error(
          "A biblioteca excedeu 20 mil efeitos. Peça ao administrador para arquivar os antigos.",
        );
    }
    const list = data.map(readSound).filter((s): s is SoundEffect => !!s);
    setSounds(list);
    await settings.setItem(`${key}:catalogue`, list);
    await cache?.prune(list);
    await updateCache();
  }
  async function measureClock() {
    const b = backend,
      ticket = epoch;
    if (!b) return;
    const start = Date.now();
    const { data, error } = await b.rpc("soundboard_clock");
    if (
      !error &&
      ticket === epoch &&
      typeof data === "string" &&
      Number.isFinite(Date.parse(data))
    )
      setClockOffset(Date.parse(data) - (start + Date.now()) / 2);
  }
  async function refreshAvatar() {
    const b = backend,
      ticket = epoch,
      token = ++avatarToken,
      key = localKey();
    if (!b || !userId()) return;
    const { data, error } = await b
      .from("soundboard_profile")
      .select("*")
      .eq("id", 1)
      .single();
    if (ticket !== epoch || token !== avatarToken) return;
    if (error)
      throw new Error("Não foi possível sincronizar a imagem compartilhada.");
    const profile = readAvatar(data);
    if (!profile || profile.revision < (avatarProfile()?.revision ?? -1))
      return;
    if (profile.avatar_path === avatarProfile()?.avatar_path && avatarUrl()) {
      setAvatarProfile(profile);
      return;
    }
    const blob = profile.avatar_path
      ? await loadAvatarFile(b, key, profile.avatar_path)
      : undefined;
    if (ticket !== epoch || token !== avatarToken) return;
    setAvatarProfile(profile);
    displayAvatar(blob);
    if (!blob) await settings.removeItem(cachedAvatarKey(key));
  }
  async function setAvatar(file?: File) {
    await task(() =>
      // eslint-disable-next-line solid/reactivity -- One-shot command; reads after await intentionally use current state.
      untrack(async () => {
        const b = backend,
          ticket = epoch,
          owner = userId(),
          previous = avatarProfile()?.avatar_path;
        if (!b || !owner || !online())
          throw new Error(
            "Conecte a biblioteca para alterar a imagem de todos.",
          );
        let path: string | null = null;
        if (file) {
          const format = await avatarImage(file);
          if (ticket !== epoch) return;
          path = `${owner}/${crypto.randomUUID()}.${format.extension}`;
          await uploadBytes(
            b,
            AVATAR_BUCKET,
            path,
            file,
            format.mime,
            "a imagem",
          );
        }
        if (ticket !== epoch) {
          if (path) await b.storage.from(AVATAR_BUCKET).remove([path]);
          return;
        }
        const result = await b.rpc("soundboard_set_avatar", {
          image_path: path,
        });
        if (result.error) {
          if (path) await b.storage.from(AVATAR_BUCKET).remove([path]);
          throw new Error(
            "Não foi possível salvar a imagem compartilhada. Tente novamente.",
          );
        }
        if (ticket !== epoch) return;
        await refreshAvatar();
        if (previous?.startsWith(`${owner}/`) && previous !== path)
          await b.storage.from(AVATAR_BUCKET).remove([previous]);
        setNotice(
          file
            ? "Foto ou GIF atualizado para todos."
            : "Ícone padrão restaurado para todos.",
        );
      }),
    );
  }
  async function restore() {
    const b = backend,
      ticket = epoch;
    if (!b) return;
    const {
      data: { session },
    } = await b.auth.getSession();
    if (ticket !== epoch) return;
    if (!session) {
      setStatus("invite");
      return;
    }
    const result = await b
      .from("soundboard_members")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (ticket !== epoch) return;
    if (result.error) {
      setStatus("offline");
      throw new Error(
        "A biblioteca ainda não está configurada no Supabase ou está sem conexão.",
      );
    }
    if (!result.data) {
      setStatus("invite");
      return;
    }
    setUserId(session.user.id);
    setStatus("ready");
    await refresh();
    await refreshAvatar();
    await measureClock();
  }
  async function join(invite: string) {
    await task(() =>
      // eslint-disable-next-line solid/reactivity -- One-shot command; reads after await intentionally use current state.
      untrack(async () => {
        const b = backend,
          ticket = epoch;
        if (!b) return;
        const {
          data: { session },
        } = await b.auth.getSession();
        if (!session) {
          const result = await b.auth.signInAnonymously();
          if (result.error)
            throw new Error(
              "Ative o login anônimo no Supabase para conectar esta instalação à biblioteca.",
            );
        }
        if (ticket !== epoch) return;
        const { error } = await b.rpc("soundboard_redeem_invite", {
          invite: invite.trim(),
          display_name:
            client().user?.displayName ?? client().user?.username ?? "Amigo",
        });
        if (ticket !== epoch) return;
        if (error)
          throw new Error(
            "Convite inválido ou expirado. Peça um novo convite ao administrador.",
          );
        await restore();
      }),
    );
  }
  function accept(value: unknown) {
    const next = readPlayback(value),
      current = untrack(playback);
    if (
      !next ||
      next.channel_id !== activeChannel() ||
      (current && next.version <= current.version)
    )
      return;
    setPlayback(next);
  }
  async function snapshot(channel: string) {
    const b = backend,
      ticket = epoch;
    if (!b) return;
    const { data, error } = await b
      .from("soundboard_playback")
      .select("*")
      .eq("channel_id", channel)
      .maybeSingle();
    if (ticket === epoch && activeChannel() === channel) {
      if (error)
        fail(
          new Error("Não foi possível sincronizar os efeitos. Reconectando…"),
        );
      else if (data) accept(data);
    }
  }
  async function command(
    command: "enable" | "disable" | "play" | "stop",
    sound?: SoundEffect,
  ) {
    await task(
      (generation) =>
        // eslint-disable-next-line solid/reactivity -- One-shot command; reads after await intentionally use current state.
        untrack(async () => {
          const b = backend,
            channel = activeChannel(),
            ticket = epoch;
          if (!b || !channel || !connected() || !online())
            throw new Error(
              "Conecte-se à chamada e à biblioteca para tocar para todos.",
            );
          if (command === "play" && !voice.speakingPermission)
            throw new Error(
              "Você precisa de permissão para falar nesta chamada.",
            );
          if (command === "play" && sound) {
            audio?.stop("preview");
            setPreviewId("");
            await cache!.get(sound);
          }
          await audio?.unlock();
          if (
            ticket !== epoch ||
            activeChannel() !== channel ||
            generation !== commandGeneration
          )
            return;
          const { data, error } = await b.rpc("soundboard_command", {
            target_channel: channel,
            command,
            target_sound: sound?.id ?? null,
          });
          if (
            ticket !== epoch ||
            activeChannel() !== channel ||
            generation !== commandGeneration
          )
            return;
          if (error) throw error;
          accept(data);
          if (sound)
            preferences({
              recent: [
                sound.id,
                ...prefs().recent.filter((id) => id !== sound.id),
              ].slice(0, 30),
            });
        }),
      true,
      command === "stop" || command === "disable",
    );
  }
  async function preview(sound: SoundEffect) {
    if (previewId() === sound.id) {
      audio?.stop("preview");
      setPreviewId("");
      return;
    }
    const ticket = epoch,
      id = sound.id;
    setError("");
    setPreviewId(id);
    try {
      await audio?.unlock();
      const file = await cache!.get(sound, !online() || status() !== "ready");
      if (ticket !== epoch || previewId() !== id) return;
      await audio?.play(
        file,
        Date.now(),
        "preview",
        () => setPreviewId(""),
        sound.sha256,
      );
    } catch (e) {
      if (ticket === epoch) {
        setPreviewId("");
        fail(e);
      }
    }
  }
  async function downloadAll() {
    if (downloads()) {
      cancelDownload = true;
      return;
    }
    const list = [...pending()],
      ticket = epoch,
      c = cache;
    if (!c || !list.length) return;
    cancelDownload = false;
    setError("");
    setDownloads({ done: 0, total: list.length, failed: 0 });
    let next = 0,
      done = 0,
      failed = 0;
    await Promise.all(
      Array.from({ length: Math.min(3, list.length) }, async () => {
        while (!cancelDownload && ticket === epoch && next < list.length) {
          const sound = list[next++];
          try {
            await c.get(sound);
          } catch {
            failed++;
          }
          if (ticket !== epoch) return;
          done++;
          setDownloads({ done, total: list.length, failed });
        }
      }),
    );
    if (ticket !== epoch) return;
    setDownloads(undefined);
    await updateCache();
    setNotice(
      cancelDownload
        ? "Download pausado. Os arquivos concluídos foram mantidos."
        : failed
          ? `${done - failed} baixados; ${failed} falharam. Clique novamente para tentar os que faltam.`
          : "Tudo baixado. Sua biblioteca local está atualizada.",
    );
  }
  async function upload(file: File, name: string, tags: string[]) {
    await task(() =>
      // eslint-disable-next-line solid/reactivity -- One-shot command; reads after await intentionally use current state.
      untrack(async () => {
        const b = backend,
          c = cache,
          ticket = epoch,
          owner = userId();
        if (!b || !c || !owner || !online())
          throw new Error("Conecte a biblioteca antes de enviar efeitos.");
        const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
        const formats: Record<string, string> = {
          mp3: "audio/mpeg",
          wav: "audio/wav",
          ogg: "audio/ogg",
          webm: "audio/webm",
          m4a: "audio/mp4",
          flac: "audio/flac",
        };
        const mime = formats[extension];
        if (!mime || !file.size || file.size > 10485760)
          throw new Error(
            "Escolha MP3, WAV, OGG, WebM, M4A ou FLAC de até 10 MB.",
          );
        if (!name.trim()) throw new Error("Dê um nome ao efeito.");
        let duration: number;
        try {
          duration = await audio!.duration(file);
        } catch {
          throw new Error(
            "Não foi possível abrir este áudio. Tente um arquivo MP3 ou WAV válido.",
          );
        }
        if (!Number.isFinite(duration) || duration <= 0 || duration > 60)
          throw new Error("O efeito precisa ter até 60 segundos.");
        const sha256 = await digest(file);
        if (sounds().some((s) => s.sha256 === sha256))
          throw new Error("Este arquivo já está na biblioteca.");
        const id = crypto.randomUUID(),
          path = `${owner}/${id}.${extension}`;
        if (ticket !== epoch) return;
        await uploadBytes(b, "soundboard", path, file, mime, "o áudio");
        if (ticket !== epoch) {
          await b.storage.from("soundboard").remove([path]);
          return;
        }
        const item: SoundEffect = {
          id,
          owner_id: owner,
          name: name.trim().slice(0, 80),
          tags: tags
            .map((t) => t.trim().slice(0, 24))
            .filter(Boolean)
            .slice(0, 8),
          storage_path: path,
          sha256,
          mime,
          bytes: file.size,
          duration,
          created_at: new Date().toISOString(),
        };
        const inserted = await b
          .from("soundboard_sounds")
          .insert({ ...item, created_at: undefined });
        if (inserted.error) {
          await b.storage.from("soundboard").remove([path]);
          throw new Error(
            "O arquivo foi recebido, mas não foi possível adicionar à biblioteca. Tente novamente.",
          );
        }
        if (ticket !== epoch) return;
        await c.put(item, file);
        await refresh();
        setNotice(
          "Efeito adicionado. Seus amigos receberão a novidade na biblioteca.",
        );
      }),
    );
  }
  async function remove(sound: SoundEffect) {
    await task(() =>
      // eslint-disable-next-line solid/reactivity -- One-shot command; reads after await intentionally use current state.
      untrack(async () => {
        const b = backend,
          ticket = epoch;
        if (sound.owner_id !== userId() || !b) return;
        const { error } = await b
          .from("soundboard_sounds")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", sound.id);
        if (error) throw error;
        // A soft deletion also reaches connected clients via Realtime.
        const removed = await b.storage
          .from("soundboard")
          .remove([sound.storage_path]);
        if (ticket !== epoch) return;
        if (removed.error)
          setNotice(
            "Efeito removido da biblioteca. O arquivo remoto poderá precisar de limpeza pelo administrador.",
          );
        await refresh();
      }),
    );
  }
  async function edit(sound: SoundEffect, name: string, tags: string[]) {
    await task(() =>
      // eslint-disable-next-line solid/reactivity -- One-shot command; reads after await intentionally use current state.
      untrack(async () => {
        const b = backend,
          ticket = epoch;
        if (!b || sound.owner_id !== userId()) return;
        if (!name.trim()) throw new Error("Dê um nome ao efeito.");
        const { error } = await b
          .from("soundboard_sounds")
          .update({
            name: name.trim().slice(0, 80),
            tags: tags
              .map((t) => t.trim().slice(0, 24))
              .filter(Boolean)
              .slice(0, 8),
          })
          .eq("id", sound.id);
        if (ticket !== epoch) return;
        if (error) throw error;
        await refresh();
        setNotice("Efeito atualizado para todos.");
      }),
    );
  }
  createEffect(() => {
    const id = account();
    const ticket = ++epoch;
    avatarToken++;
    displayAvatar();
    setAvatarProfile(undefined);
    setSounds([]);
    setCached([]);
    setPrefs(defaults());
    setUserId("");
    setPlayback(undefined);
    setStatus("connecting");
    setError("");
    setNotice("");
    setDownloads(undefined);
    setWorking(false);
    commandGeneration++;
    setCommandBusy(false);
    setPreviewId("");
    setConnected(false);
    if (!id) return;
    const b = (backend = soundboardBackend(id));
    cache = createSoundCache(id, b, () => setCacheRevision((n) => n + 1));
    audio = new SoundboardAudio(setBlocked, () =>
      setAudioRevision((n) => n + 1),
    );
    void (async () => {
      try {
        const key = accountKey(id);
        const [saved, list, savedAvatar] = await Promise.all([
          settings.getItem<Partial<SoundPreferences>>(`${key}:preferences`),
          settings.getItem<unknown[]>(`${key}:catalogue`),
          settings.getItem<CachedAvatar>(cachedAvatarKey(key)),
        ]);
        if (ticket !== epoch) return;
        if (
          savedAvatar &&
          avatarPath(savedAvatar.path) &&
          savedAvatar.blob instanceof Blob &&
          savedAvatar.blob.size > 0 &&
          savedAvatar.blob.size <= MAX_AVATAR_BYTES
        )
          displayAvatar(savedAvatar.blob);
        if (saved)
          setPrefs({
            ...defaults(),
            volume:
              typeof saved.volume === "number" && Number.isFinite(saved.volume)
                ? Math.max(0, Math.min(1, saved.volume))
                : 0.65,
            muted: saved.muted === true,
            spatial: saved.spatial !== false,
            favorites: Array.isArray(saved.favorites)
              ? saved.favorites
                  .filter((x) => typeof x === "string")
                  .slice(0, 2000)
              : [],
            recent: Array.isArray(saved.recent)
              ? saved.recent.filter((x) => typeof x === "string").slice(0, 30)
              : [],
            seenAt:
              typeof saved.seenAt === "number" && Number.isFinite(saved.seenAt)
                ? saved.seenAt
                : 0,
          });
        if (Array.isArray(list))
          setSounds(list.map(readSound).filter((s): s is SoundEffect => !!s));
        await updateCache();
        await restore();
      } catch (e) {
        if (ticket === epoch) {
          setStatus("offline");
          fail(e);
        }
      }
    })();
    const unlock = () => void audio?.unlock();
    const connectivity = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void restore().catch(fail);
      else {
        cancelDownload = true;
        setConnected(false);
        audio?.stop("shared");
      }
    };
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    const timer = setInterval(() => setNow(Date.now()), 250);
    onCleanup(() => {
      epoch++;
      avatarToken++;
      displayAvatar();
      cancelDownload = true;
      clearInterval(timer);
      clearTimeout(persistTimer);
      audio?.close();
      audio = undefined;
      cache = undefined;
      backend = undefined;
      void b.removeAllChannels();
      b.auth.stopAutoRefresh();
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
    });
  });
  createEffect(() => {
    cacheRevision();
    void updateCache().catch(fail);
  });
  createEffect(() => {
    const member = userId(),
      b = backend;
    if (!member || !b) return;
    let timer: ReturnType<typeof setTimeout>;
    const refreshSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh().catch(fail), 200);
    };
    const catalogue = b
      .channel(`soundboard-library:${member}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "soundboard_profile" },
        // eslint-disable-next-line solid/reactivity -- Realtime callback intentionally samples the current profile once.
        () => void refreshAvatar().catch(fail),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "soundboard_sounds" },
        refreshSoon,
      )
      // eslint-disable-next-line solid/reactivity -- Subscription status callback samples the current profile once.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          refreshSoon();
          void refreshAvatar().catch(fail);
        }
      });
    const fallback = setInterval(() => {
      void refresh().catch(fail);
      void refreshAvatar().catch(fail);
    }, 60000);
    onCleanup(() => {
      clearTimeout(timer);
      clearInterval(fallback);
      void b.removeChannel(catalogue);
    });
  });
  createEffect(() => {
    const isOnline = online();
    const channel = activeChannel(),
      member = userId(),
      b = backend;
    setPlayback(undefined);
    setConnected(false);
    audio?.stop("shared");
    if (!channel || !member || !b || !isOnline) return;
    let alive = true;
    const subscription = b
      .channel(`soundboard-call:${channel}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "soundboard_playback",
          filter: `channel_id=eq.${channel}`,
        },
        (event) => accept(event.new),
      )
      .subscribe((status) => {
        if (!alive || activeChannel() !== channel) return;
        setConnected(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") {
          void snapshot(channel);
          void measureClock();
        } else {
          audio?.stop("shared");
        }
      });
    const poll = setInterval(() => {
      if (online()) {
        void snapshot(channel);
        void measureClock();
      }
    }, 15000);
    onCleanup(() => {
      alive = false;
      clearInterval(poll);
      void b.removeChannel(subscription);
    });
  });
  createEffect(() => {
    playbackKey();
    const p = untrack(playback),
      s = untrack(current),
      c = cache,
      mixer = audio;
    const muted = untrack(sharedMuted);
    mixer?.stop("shared");
    if (
      !p?.enabled ||
      !s ||
      !c ||
      !mixer ||
      muted ||
      untrack(blocked) ||
      !untrack(connected) ||
      !untrack(online)
    )
      return;
    let stale = false;
    void c
      .get(s)
      .then(async (file) => {
        if (stale) return;
        await mixer.play(
          file,
          Date.parse(p.started_at!) - untrack(clockOffset),
          "shared",
          () => {},
          s.sha256,
        );
      })
      .catch((e) => {
        if (!stale) fail(e);
      });
    onCleanup(() => {
      stale = true;
      mixer.stop("shared");
    });
  });
  createEffect(() => {
    audioRevision();
    const preferences = prefs(),
      scene = state.livingRoom.scene;
    const point = scene.speaker;
    const listener = state.livingRoom.listenerPoint(voice.channel()?.id ?? "");
    const volume =
      voice.deafen() ||
      (voice.room() && !voice.listenPermission) ||
      preferences.muted
        ? 0
        : preferences.volume * state.voice.outputVolume;
    void audio
      ?.settings(volume, state.voice.preferredAudioOutputDevice ?? "default", {
        enabled:
          state.livingRoom.enabled &&
          scene.spatial.enabled &&
          preferences.spatial,
        x: point.x - listener.x,
        y: (point.y - listener.y) / scene.aspect,
        width: scene.spatial.width,
        distance: scene.spatial.distance,
        method: scene.spatial.method,
      })
      .catch(fail);
  });
  return {
    open,
    setOpen,
    sounds,
    prefs,
    cached,
    status,
    error,
    notice,
    avatarUrl,
    avatarProfile,
    setAvatar,
    working,
    commandBusy,
    online,
    connected,
    userId,
    playback,
    now,
    previewId,
    blocked,
    downloads,
    pending,
    newSounds,
    current,
    enabled,
    activeChannel,
    preferences,
    task,
    join,
    refresh: async () => {
      await Promise.all([refresh(), refreshAvatar()]);
    },
    command,
    preview,
    upload,
    remove,
    edit,
    downloadAll,
    download: (sound: SoundEffect) =>
      task(async () => {
        await cache?.get(sound);
        await updateCache();
        setNotice("Efeito baixado neste dispositivo.");
      }),
    favorite: (id: string) =>
      preferences({
        favorites: prefs().favorites.includes(id)
          ? prefs().favorites.filter((x) => x !== id)
          : [...prefs().favorites, id],
      }),
    markSeen: () => preferences({ seenAt: Date.now() + clockOffset() }),
    clearCache: () =>
      task(async () => {
        audio?.stop("preview");
        setPreviewId("");
        await cache?.clear();
        await updateCache();
        setNotice(
          "Arquivos locais removidos. A biblioteca compartilhada foi mantida.",
        );
      }),
    retry: () => task(restore),
    unlock: () => audio?.unlock(),
    dismissError: () => setError(""),
  };
}
export type Soundboard = ReturnType<typeof createSoundboard>;
const SoundboardContext = createContext<Soundboard>();
export const useSoundboard = () => useContext(SoundboardContext);
export function SoundboardProvider(props: { children: JSX.Element }) {
  const soundboard = createSoundboard();
  return (
    <SoundboardContext.Provider value={soundboard}>
      {props.children}
      <SoundboardPanel />
    </SoundboardContext.Provider>
  );
}
