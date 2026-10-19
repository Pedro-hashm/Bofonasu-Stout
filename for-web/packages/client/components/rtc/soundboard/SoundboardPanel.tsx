import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  CloudDownload,
  Download,
  Headphones,
  LoaderCircle,
  MoreHorizontal,
  Music2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from "lucide-solid";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
  untrack,
} from "solid-js";
import { Portal } from "solid-js/web";
import { type SoundEffect, formatBytes, searchText } from "./model";
import { SharedAvatarEditor } from "./SharedAvatarEditor";
import { type Soundboard, useSoundboard } from "./Soundboard";
import "./soundboard.css";
import { SoundboardAvatar } from "./SoundboardAvatar";

export function SoundboardPanel() {
  const board = useSoundboard();
  return (
    <Show when={board?.open()}>
      <Portal
        mount={
          document.fullscreenElement ??
          document.getElementById("floating") ??
          document.body
        }
      >
        <Library board={board!} />
      </Portal>
    </Show>
  );
}

/** Native modal supplies focus trapping, Escape and top-layer/fullscreen support. */
function Library(props: { board: Soundboard }) {
  const b = untrack(() => props.board);
  const [query, setQuery] = createSignal("");
  const [tab, setTab] = createSignal("all");
  const [sort, setSort] = createSignal("newest");
  const [uploading, setUploading] = createSignal(false);
  const [options, setOptions] = createSignal(false);
  const [selected, setSelected] = createSignal<SoundEffect>();
  const [invite, setInvite] = createSignal("");
  const [shownCount, setShownCount] = createSignal(120);
  createEffect(() => {
    query();
    tab();
    sort();
    setShownCount(120);
  });
  let dialog!: HTMLDialogElement, search!: HTMLInputElement;
  const filtered = createMemo(() => {
    const terms = searchText(query().trim()).split(/\s+/).filter(Boolean);
    const p = b.prefs(),
      mode = tab(),
      list = b.sounds().filter((sound) => {
        if (mode === "favorites" && !p.favorites.includes(sound.id))
          return false;
        if (mode === "downloaded" && !b.cached().includes(sound.id))
          return false;
        if (mode === "new" && Date.parse(sound.created_at) <= p.seenAt)
          return false;
        if (mode === "recent" && !p.recent.includes(sound.id)) return false;
        const text = searchText(`${sound.name} ${sound.tags.join(" ")}`);
        return terms.every((t) => text.includes(t));
      });
    const order = sort();
    return list.sort((a, c) =>
      mode === "recent"
        ? p.recent.indexOf(a.id) - p.recent.indexOf(c.id)
        : order === "name"
          ? a.name.localeCompare(c.name)
          : order === "duration"
            ? a.duration - c.duration
            : Date.parse(c.created_at) - Date.parse(a.created_at),
    );
  });
  const bytes = () => b.pending().reduce((n, s) => n + s.bytes, 0);
  const canPlay = () => b.connected() && b.online() && b.enabled();
  onMount(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    search?.focus();
    onCleanup(() => {
      dialog.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    });
  });
  return (
    <dialog
      ref={dialog}
      class="sb-dialog"
      aria-labelledby="sb-title"
      data-ui-sound="off"
      onClose={() => b.setOpen(false)}
      onCancel={() => b.setOpen(false)}
      onClick={(e) => {
        if (e.target === dialog) {
          const r = dialog.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            b.setOpen(false);
        }
      }}
      onKeyDown={(e) => {
        if (
          e.key === "/" &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement)
        ) {
          e.preventDefault();
          search.focus();
        }
      }}
    >
      <div class="sb-shell">
        <header class="sb-header">
          <div class="sb-brand-icon">
            <SoundboardAvatar />
          </div>
          <div>
            <span class="sb-eyebrow">SUA CHAMADA, COM MAIS PERSONALIDADE</span>
            <h2 id="sb-title">Efeitos sonoros</h2>
          </div>
          <button
            type="button"
            class="sb-icon"
            aria-label="Fechar biblioteca"
            onClick={() => b.setOpen(false)}
          >
            <X />
          </button>
        </header>
        <div class="sb-call-switch">
          <span class="sb-connection" data-connected={b.connected()} />
          <div>
            <strong>
              {!b.activeChannel()
                ? "Entre em uma chamada"
                : b.enabled()
                  ? "Efeitos ativos nesta chamada"
                  : "Efeitos desativados nesta chamada"}
            </strong>
            <small>
              {!b.online()
                ? "Sem internet · prévias baixadas continuam disponíveis"
                : b.status() === "ready"
                  ? "Todos no cliente personalizado podem ouvir e controlar."
                  : "Conecte esta instalação à biblioteca compartilhada."}
            </small>
          </div>
          <button
            type="button"
            class={b.enabled() ? "sb-button" : "sb-button sb-primary"}
            disabled={
              (!b.enabled() && b.commandBusy()) || !b.connected() || !b.online()
            }
            onClick={() => void b.command(b.enabled() ? "disable" : "enable")}
          >
            {b.enabled() ? "Desativar" : "Ativar efeitos"}
          </button>
        </div>
        <Show when={b.status() === "invite"}>
          <form
            class="sb-connect"
            onSubmit={(e) => {
              e.preventDefault();
              void b.join(invite());
            }}
          >
            <div>
              <strong>Entre na biblioteca dos amigos</strong>
              <p>
                Cole o convite uma vez. Esta instalação será lembrada, sem criar
                outra senha.
              </p>
            </div>
            <input
              aria-label="Convite da biblioteca"
              type="password"
              autocomplete="off"
              value={invite()}
              onInput={(e) => setInvite(e.currentTarget.value)}
              placeholder="Convite da biblioteca"
              required
              minlength={32}
            />
            <button class="sb-button sb-primary" disabled={b.working()}>
              Conectar
            </button>
          </form>
        </Show>
        <Show when={b.status() === "connecting"}>
          <div class="sb-banner" role="status">
            <LoaderCircle class="sb-spin" size={16} /> Conectando biblioteca…
          </div>
        </Show>
        <Show when={b.status() === "offline"}>
          <div class="sb-banner">
            <WifiOff size={17} />
            <span>
              Biblioteca sem conexão. Os efeitos baixados continuam disponíveis
              para prévia.
            </span>
            <button
              type="button"
              class="sb-link"
              disabled={b.working()}
              onClick={() => void b.retry()}
            >
              Tentar novamente
            </button>
          </div>
        </Show>
        <Show when={b.error()}>
          <div class="sb-banner sb-error" role="alert">
            <span>{b.error()}</span>
            <button
              type="button"
              class="sb-icon"
              aria-label="Dispensar erro"
              onClick={b.dismissError}
            >
              <X size={15} />
            </button>
          </div>
        </Show>
        <Show when={b.notice()}>
          <div class="sb-banner" role="status">
            <Check size={16} />
            {b.notice()}
          </div>
        </Show>
        <Show when={b.blocked()}>
          <div class="sb-banner">
            <Headphones size={17} />
            <span>
              Seu navegador precisa de um clique para liberar o áudio.
            </span>
            <button
              type="button"
              class="sb-link"
              onClick={() => void b.unlock()}
            >
              Ativar áudio
            </button>
          </div>
        </Show>
        <div class="sb-tools">
          <label class="sb-search">
            <Search size={18} />
            <input
              ref={search}
              type="search"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder="Buscar efeitos ou tags…"
              aria-label="Buscar efeitos por nome ou tags"
            />
            <kbd>/</kbd>
          </label>
          <button
            type="button"
            class="sb-button"
            title="Atualizar biblioteca"
            disabled={b.working() || b.status() !== "ready" || !b.online()}
            onClick={() => void b.task(b.refresh)}
          >
            <RefreshCw size={16} />
            <span>Atualizar</span>
          </button>
          <button
            type="button"
            class="sb-button sb-primary"
            disabled={b.working() || b.status() !== "ready" || !b.online()}
            aria-expanded={uploading()}
            onClick={() => setUploading(!uploading())}
          >
            <Plus size={17} />
            <span>Adicionar</span>
          </button>
        </div>
        <Show when={uploading()}>
          <UploadForm board={b} onClose={() => setUploading(false)} />
        </Show>
        <div class="sb-download-row">
          <div>
            <CloudDownload size={21} />
            <span>
              <strong>
                {b.pending().length
                  ? `${b.pending().length} ${b.cached().length ? "novos arquivos para baixar" : "efeitos disponíveis para baixar"}`
                  : "Biblioteca local atualizada"}
              </strong>
              <small>
                {b.pending().length
                  ? `${formatBytes(bytes())} · baixa apenas o que falta`
                  : `${b.cached().length} efeitos salvos neste dispositivo`}
              </small>
            </span>
          </div>
          <button
            type="button"
            class="sb-button"
            disabled={
              !b.downloads() &&
              (!b.pending().length || b.status() !== "ready" || !b.online())
            }
            onClick={() => void b.downloadAll()}
          >
            <Show
              when={b.downloads()}
              fallback={
                <>
                  <ArrowDownToLine size={16} />
                  {b.cached().length ? "Baixar novidades" : "Baixar todos"}
                </>
              }
            >
              {(progress) => (
                <>
                  <Pause size={15} />
                  {progress().done}/{progress().total} · Pausar
                </>
              )}
            </Show>
          </button>
        </div>
        <Show when={b.downloads()}>
          {(progress) => (
            <progress
              class="sb-progress"
              max={progress().total}
              value={progress().done}
              aria-label={`Download de efeitos: ${progress().done} de ${progress().total}`}
            />
          )}
        </Show>
        <nav class="sb-tabs" aria-label="Filtrar efeitos">
          <For
            each={[
              ["all", "Todos"],
              ["favorites", "Favoritos"],
              ["recent", "Recentes"],
              ["downloaded", "Baixados"],
              ["new", "Novos"],
            ]}
          >
            {([id, label]) => (
              <button
                type="button"
                aria-pressed={tab() === id}
                onClick={() => setTab(id)}
              >
                {id === "favorites" ? (
                  <Star size={13} />
                ) : id === "new" ? (
                  <Sparkles size={13} />
                ) : null}
                {label}
                <Show when={id === "new" && b.newSounds().length}>
                  <em>{b.newSounds().length}</em>
                </Show>
              </button>
            )}
          </For>
          <label class="sb-sort">
            <span class="sb-sr">Ordenar efeitos</span>
            <select
              value={sort()}
              onChange={(e) => setSort(e.currentTarget.value)}
            >
              <option value="newest">Mais novos</option>
              <option value="name">Nome A–Z</option>
              <option value="duration">Mais curtos</option>
            </select>
            <ChevronDown size={13} />
          </label>
        </nav>
        <div class="sb-results-bar">
          <span>
            {filtered().length} efeitos{query() ? ` para “${query()}”` : ""}
          </span>
          <Show when={tab() === "new" && b.newSounds().length}>
            <button type="button" class="sb-link" onClick={b.markSeen}>
              Marcar novidades como vistas
            </button>
          </Show>
        </div>
        <div
          class="sb-grid"
          aria-label="Biblioteca de efeitos"
          onKeyDown={(e) => {
            const target = e.target as HTMLElement;
            if (
              !target.matches(".sb-pad") ||
              !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                e.key,
              )
            )
              return;
            const buttons = [
                ...e.currentTarget.querySelectorAll<HTMLButtonElement>(
                  ".sb-pad:not(:disabled)",
                ),
              ],
              index = buttons.indexOf(target as HTMLButtonElement);
            const columns = Math.max(
              1,
              Math.round(
                e.currentTarget.clientWidth /
                  ((target.parentElement as HTMLElement).getBoundingClientRect()
                    .width +
                    10),
              ),
            );
            const delta =
              e.key === "ArrowLeft"
                ? -1
                : e.key === "ArrowRight"
                  ? 1
                  : e.key === "ArrowUp"
                    ? -columns
                    : columns;
            const next = buttons[index + delta];
            if (next) {
              e.preventDefault();
              next.focus();
            }
          }}
        >
          <For each={filtered().slice(0, shownCount())}>
            {(sound) => (
              <article
                class="sb-card"
                data-playing={b.current()?.id === sound.id}
                data-preview={b.previewId() === sound.id}
              >
                <button
                  type="button"
                  class="sb-pad"
                  disabled={b.commandBusy() || !canPlay()}
                  aria-label={`Tocar ${sound.name} para a chamada`}
                  onClick={() => void b.command("play", sound)}
                >
                  <span class="sb-pad-symbol">
                    <Show
                      when={b.current()?.id === sound.id}
                      fallback={<Play size={21} fill="currentColor" />}
                    >
                      <span class="sb-equalizer">
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                    </Show>
                  </span>
                  <strong>{sound.name}</strong>
                  <small>
                    {sound.duration.toFixed(1)} s <span>·</span>{" "}
                    {formatBytes(sound.bytes)}
                  </small>
                </button>
                <div class="sb-card-top">
                  <button
                    type="button"
                    class="sb-icon"
                    aria-label={
                      b.prefs().favorites.includes(sound.id)
                        ? `Remover ${sound.name} dos favoritos`
                        : `Favoritar ${sound.name}`
                    }
                    aria-pressed={b.prefs().favorites.includes(sound.id)}
                    onClick={() => b.favorite(sound.id)}
                  >
                    <Star
                      size={15}
                      fill={
                        b.prefs().favorites.includes(sound.id)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                  <Show when={Date.parse(sound.created_at) > b.prefs().seenAt}>
                    <span class="sb-new">NOVO</span>
                  </Show>
                </div>
                <div class="sb-card-bottom">
                  <span
                    title={
                      b.cached().includes(sound.id)
                        ? "Disponível neste dispositivo"
                        : "Ainda não baixado"
                    }
                  >
                    <Show
                      when={b.cached().includes(sound.id)}
                      fallback={<CloudDownload size={13} />}
                    >
                      <Check size={13} />
                    </Show>
                  </span>
                  <span class="sb-tag" title={sound.tags.join(", ")}>
                    {sound.tags[0] ?? "Efeito"}
                  </span>
                  <button
                    type="button"
                    class="sb-icon"
                    title={
                      b.previewId() === sound.id
                        ? "Parar prévia local"
                        : "Ouvir só para mim"
                    }
                    aria-label={`${b.previewId() === sound.id ? "Parar prévia de" : "Ouvir só para mim:"} ${sound.name}`}
                    aria-pressed={b.previewId() === sound.id}
                    disabled={
                      !b.cached().includes(sound.id) &&
                      (!b.online() || b.status() !== "ready")
                    }
                    onClick={() => void b.preview(sound)}
                  >
                    <Show
                      when={b.previewId() === sound.id}
                      fallback={<Headphones size={15} />}
                    >
                      <Square size={13} />
                    </Show>
                  </button>
                  <button
                    type="button"
                    class="sb-icon"
                    title="Detalhes do efeito"
                    aria-label={`Detalhes de ${sound.name}`}
                    onClick={() => setSelected(sound)}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                </div>
              </article>
            )}
          </For>
          <Show when={!filtered().length}>
            <div class="sb-empty">
              <Music2 size={36} />
              <strong>
                {query()
                  ? "Nenhum efeito encontrado"
                  : tab() === "favorites"
                    ? "Seus favoritos ficam aqui"
                    : tab() === "new"
                      ? "Você está em dia"
                      : "Sua trilha começa aqui"}
              </strong>
              <p>
                {query()
                  ? "Tente outro nome ou uma tag."
                  : tab() === "favorites"
                    ? "Toque na estrela dos efeitos que você mais usa."
                    : "Adicione efeitos ou mude o filtro para explorar a biblioteca."}
              </p>
            </div>
          </Show>
        </div>
        <Show when={filtered().length > shownCount()}>
          <button
            type="button"
            class="sb-load-more"
            onClick={() => setShownCount((n) => n + 120)}
          >
            Mostrar mais {Math.min(120, filtered().length - shownCount())}{" "}
            efeitos
          </button>
        </Show>
        <Show when={selected()} keyed>
          {(sound) => (
            <SoundDetails
              board={b}
              sound={sound}
              onClose={() => setSelected(undefined)}
            />
          )}
        </Show>
        <Show when={options()}>
          <div class="sb-options">
            <SharedAvatarEditor board={b} />
            <label>
              <input
                type="checkbox"
                checked={b.prefs().spatial}
                onChange={(e) =>
                  b.preferences({ spatial: e.currentTarget.checked })
                }
              />
              <span>
                <strong>Posicionar o som na sala</strong>
                <small>
                  Usa a posição do perfil quando o áudio espacial do Room está
                  ativo.
                </small>
              </span>
            </label>
            <button
              type="button"
              class="sb-link"
              disabled={!!b.downloads() || b.working()}
              onClick={() => void b.clearCache()}
            >
              Liberar arquivos locais
            </button>
            <span class="sb-hint">
              Limpar dados do navegador também apaga os downloads.
            </span>
          </div>
        </Show>
        <footer class="sb-footer">
          <div class="sb-now-icon">
            <SoundboardAvatar />
          </div>
          <div class="sb-now">
            <strong>
              {b.current()?.name ??
                (b.enabled() ? "Pronto para tocar" : "Efeitos desativados")}
            </strong>
            <small>
              {b.current()
                ? `Compartilhado por ${b.playback()?.actor_name}`
                : "▶ toca para todos · fones fazem uma prévia local"}
            </small>
          </div>
          <button
            type="button"
            class="sb-stop"
            title="Parar para todos"
            aria-label="Parar efeito para todos"
            disabled={(!b.current() && !b.commandBusy()) || !b.connected()}
            onClick={() => void b.command("stop")}
          >
            <Square size={17} fill="currentColor" />
          </button>
          <div class="sb-volume">
            <button
              type="button"
              class="sb-icon"
              aria-label={
                b.prefs().muted
                  ? "Ativar efeitos para mim"
                  : "Silenciar efeitos só para mim"
              }
              aria-pressed={b.prefs().muted}
              onClick={() => b.preferences({ muted: !b.prefs().muted })}
            >
              <Show when={!b.prefs().muted} fallback={<VolumeX size={18} />}>
                <Volume2 size={18} />
              </Show>
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(b.prefs().volume * 100)}
              aria-label="Volume dos efeitos só para mim"
              onInput={(e) =>
                b.preferences({ volume: Number(e.currentTarget.value) / 100 })
              }
            />
            <span>{Math.round(b.prefs().volume * 100)}%</span>
          </div>
          <button
            type="button"
            class="sb-icon"
            title="Configurações dos efeitos"
            aria-label="Configurações dos efeitos"
            aria-expanded={options()}
            onClick={() => setOptions(!options())}
          >
            <SlidersHorizontal size={18} />
          </button>
        </footer>
      </div>
    </dialog>
  );
}

function UploadForm(props: { board: Soundboard; onClose: () => void }) {
  const [file, setFile] = createSignal<File>();
  const [name, setName] = createSignal("");
  const [tags, setTags] = createSignal("");
  const select = (f?: File) => {
    setFile(f);
    if (f)
      setName(
        f.name
          .replace(/\.[^.]+$/, "")
          .replace(/[_-]+/g, " ")
          .slice(0, 80),
      );
  };
  return (
    <form
      class="sb-upload"
      onSubmit={(e) => {
        e.preventDefault();
        const f = file();
        if (f)
          void props.board.upload(f, name(), tags().split(",")).then(() =>
            untrack(() => {
              if (!props.board.error()) props.onClose();
            }),
          );
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        select(e.dataTransfer?.files[0]);
      }}
    >
      <label class="sb-file">
        <Upload size={21} />
        <strong>{file()?.name ?? "Escolha ou arraste um efeito"}</strong>
        <small>Até 60 segundos · 10 MB</small>
        <input
          type="file"
          accept=".mp3,.wav,.ogg,.webm,.m4a,.flac"
          aria-label="Arquivo do efeito sonoro"
          onChange={(e) => select(e.currentTarget.files?.[0])}
        />
      </label>
      <div class="sb-upload-fields">
        <label>
          Nome
          <input
            value={name()}
            maxlength={80}
            required
            onInput={(e) => setName(e.currentTarget.value)}
            placeholder="Ex.: aplausos dramáticos"
          />
        </label>
        <label>
          Tags, separadas por vírgula
          <input
            value={tags()}
            maxlength={200}
            onInput={(e) => setTags(e.currentTarget.value)}
            placeholder="memes, reação, vitória"
          />
        </label>
        <div>
          <button
            type="button"
            class="sb-button"
            disabled={props.board.working()}
            onClick={() => props.onClose()}
          >
            Cancelar
          </button>
          <button
            class="sb-button sb-primary"
            disabled={!file() || props.board.working()}
          >
            <Show when={props.board.working()} fallback={<Upload size={15} />}>
              <LoaderCircle class="sb-spin" size={15} />
            </Show>
            {props.board.working() ? "Enviando…" : "Adicionar para todos"}
          </button>
        </div>
      </div>
    </form>
  );
}

function SoundDetails(props: {
  board: Soundboard;
  sound: SoundEffect;
  onClose: () => void;
}) {
  const [name, setName] = createSignal(untrack(() => props.sound.name)),
    [tags, setTags] = createSignal(untrack(() => props.sound.tags.join(", "))),
    [confirm, setConfirm] = createSignal(false);
  const mine = () => props.sound.owner_id === props.board.userId();
  createEffect(() => {
    if (!props.board.sounds().some((s) => s.id === props.sound.id))
      props.onClose();
  });
  return (
    <section class="sb-details" aria-label={`Detalhes de ${props.sound.name}`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void props.board
            .edit(props.sound, name(), tags().split(","))
            .then(() =>
              untrack(() => {
                if (!props.board.error()) props.onClose();
              }),
            );
        }}
      >
        <label>
          Nome
          <input
            value={name()}
            maxlength={80}
            disabled={!mine()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </label>
        <label>
          Tags
          <input
            value={tags()}
            maxlength={200}
            disabled={!mine()}
            onInput={(e) => setTags(e.currentTarget.value)}
          />
        </label>
        <Show when={mine()}>
          <button
            class="sb-button"
            disabled={props.board.working() || !name().trim()}
          >
            Salvar
          </button>
        </Show>
        <button
          type="button"
          class="sb-icon"
          aria-label="Fechar detalhes"
          onClick={() => props.onClose()}
        >
          <X size={16} />
        </button>
      </form>
      <div>
        <button
          type="button"
          class="sb-link"
          disabled={
            props.board.working() ||
            props.board.cached().includes(props.sound.id) ||
            !props.board.online()
          }
          onClick={() => void props.board.download(props.sound)}
        >
          <Download size={13} />
          {props.board.cached().includes(props.sound.id)
            ? "Já baixado"
            : "Baixar este efeito"}
        </button>
        <span>
          {props.sound.duration.toFixed(1)} s · {formatBytes(props.sound.bytes)}{" "}
          · {new Date(props.sound.created_at).toLocaleDateString()}
        </span>
        <Show when={mine()}>
          <Show
            when={confirm()}
            fallback={
              <button
                type="button"
                class="sb-link sb-danger"
                onClick={() => setConfirm(true)}
              >
                <Trash2 size={13} />
                Excluir da biblioteca
              </button>
            }
          >
            <span>Excluir para todos?</span>
            <button
              type="button"
              class="sb-link"
              onClick={() => setConfirm(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              class="sb-link sb-danger"
              disabled={props.board.working()}
              onClick={() => void props.board.remove(props.sound)}
            >
              Excluir
            </button>
          </Show>
        </Show>
      </div>
    </section>
  );
}
