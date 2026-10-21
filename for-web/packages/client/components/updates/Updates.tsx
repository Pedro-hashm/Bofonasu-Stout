import { mobilePlatform } from "@revolt/common/lib/mobile";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Clock3,
  History,
  LoaderCircle,
  Package,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-solid";
import { createMemo, createSignal, For, onMount, Show } from "solid-js";
import {
  checkUpdates,
  compareVersions,
  hasAppUpdate,
  releasesURL,
  updateState,
} from ".";
import { type AppRelease } from "../../../../../shared/updates";

function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(value.length === 10 ? { timeZone: "UTC" } : {}),
  });
}

/** Release notes are rendered as text, never as remote HTML. */
function ReleaseNotes(props: { notes: string }) {
  return (
    <div class="updates-notes">
      <For each={props.notes.split("\n").filter((line) => line.trim())}>
        {(line) => (
          <div
            classList={{
              "updates-notes-heading": /^#{1,6}\s/.test(line),
              "updates-notes-bullet": /^[-*]\s/.test(line),
            }}
          >
            {line.replace(/^#{1,6}\s+/, "").replace(/^[-*]\s+/, "")}
          </div>
        )}
      </For>
    </div>
  );
}

function VersionCard(props: { release: AppRelease }) {
  const current = () => props.release.version === updateState().currentVersion;
  const newer = () =>
    props.release.published &&
    compareVersions(props.release.version, updateState().currentVersion) > 0;
  return (
    <article
      class="updates-release"
      classList={{
        "updates-release-current": current(),
        "updates-release-new": newer(),
      }}
    >
      <header>
        <div class="updates-release-version">
          <strong>v{props.release.version}</strong>
          <Show when={current()}>
            <span class="updates-tag">Sua versão</span>
          </Show>
          <Show when={newer()}>
            <span class="updates-tag updates-tag-new">Nova para você</span>
          </Show>
          <Show
            when={updateState().downloadedVersion === props.release.version}
          >
            <span class="updates-tag">Baixada</span>
          </Show>
        </div>
        <span class="updates-date">{dateLabel(props.release.date)}</span>
      </header>
      <h3>{props.release.title}</h3>
      <ReleaseNotes notes={props.release.notes} />
      <Show
        when={props.release.published}
        fallback={
          <span class="updates-included">Histórico incluído nesta build</span>
        }
      >
        <a
          class="updates-release-link"
          href={props.release.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver release <ArrowUpRight size={14} />
        </a>
      </Show>
    </article>
  );
}

export function Updates() {
  const [query, setQuery] = createSignal("");
  const [onlyNew, setOnlyNew] = createSignal(false);
  const [actionError, setActionError] = createSignal("");
  const busy = () => ["checking", "downloading"].includes(updateState().status);
  const ready = () => !!updateState().downloadedVersion;
  const newVersions = createMemo(() =>
    updateState().releases.filter(
      (release) =>
        release.published &&
        compareVersions(release.version, updateState().currentVersion) > 0,
    ),
  );
  const visible = createMemo(() =>
    (onlyNew() ? newVersions() : updateState().releases).filter((release) =>
      `${release.version} ${release.title} ${release.notes}`
        .toLocaleLowerCase()
        .includes(query().trim().toLocaleLowerCase()),
    ),
  );
  const headline = () => {
    const state = updateState();
    if (state.status === "downloading")
      return "Sua próxima versão está a caminho";
    if (ready()) return "Pronta para o próximo início";
    if (state.status === "checking") return "Buscando novidades…";
    if (hasAppUpdate()) return "Tem uma versão nova para você";
    if (state.status === "unpublished")
      return "Ainda não há releases publicadas";
    if (state.status === "current") return "Você está em dia";
    return "Seu aplicativo, sempre por perto";
  };
  async function install() {
    setActionError("");
    try {
      const accepted = await window.native?.updates?.install();
      if (!accepted)
        setActionError("Saia da chamada antes de reiniciar para atualizar.");
    } catch {
      setActionError(
        "Não foi possível reiniciar. Feche e abra o aplicativo para aplicar a atualização baixada.",
      );
    }
  }
  async function openDownload() {
    setActionError("");
    try {
      const bridge = window.native?.updates;
      if (bridge) await bridge.openDownload();
      else {
        const latest = updateState().releases.find(
          (entry) =>
            entry.version === updateState().latestVersion && entry.published,
        );
        const download =
          mobilePlatform() === "android"
            ? latest?.androidDownloadURL
            : mobilePlatform() === "ios"
              ? latest?.iosDownloadURL
              : undefined;
        window.open(download ?? releasesURL, "_blank", "noopener,noreferrer");
      }
    } catch {
      setActionError(
        "Não foi possível abrir o download. Tente o link das releases abaixo.",
      );
    }
  }
  onMount(() => {
    if (updateState().status === "idle") void checkUpdates();
  });

  return (
    <section class="updates-page" aria-label="Atualizações e novidades">
      <div class="updates-hero" aria-live="polite">
        <div class="updates-eyebrow">
          <Sparkles size={15} /> BOFONASU STOUT
        </div>
        <div class="updates-hero-main">
          <div class="updates-hero-icon">
            <Show
              when={busy()}
              fallback={
                ready() || hasAppUpdate() ? <ArrowDownToLine /> : <Package />
              }
            >
              <LoaderCircle class="updates-spin" />
            </Show>
          </div>
          <div>
            <h2>{headline()}</h2>
            <p>
              Instalado <strong>v{updateState().currentVersion}</strong>
              <Show when={updateState().latestVersion}>
                {" "}
                · Mais recente <strong>v{updateState().latestVersion}</strong>
              </Show>
            </p>
          </div>
        </div>
        <p class="updates-explainer">
          {updateState().mode === "automatic"
            ? "Novas versões são baixadas ao abrir e a cada 30 minutos. A atualização é aplicada ao reabrir, ou quando você escolher reiniciar abaixo."
            : updateState().mode === "development"
              ? "Modo de desenvolvimento. Você pode consultar o histórico e as releases publicadas."
              : updateState().mode === "mobile"
                ? mobilePlatform() === "ios"
                  ? "Cliente iOS. As próximas builds IPA aparecem aqui, mas exigem assinatura antes de instalar."
                  : "Cliente Android. Baixe o APK da nova versão e instale por cima para preservar os dados."
                : updateState().mode === "web"
                  ? "Esta é a versão web. O aplicativo desktop instalado também pode baixar atualizações automaticamente."
                  : "Esta instalação usa atualização manual. Baixe o instalador para habilitar as próximas atualizações automáticas."}
        </p>
        <div class="updates-actions">
          <Show
            when={ready()}
            fallback={
              <Show
                when={hasAppUpdate() && updateState().status !== "downloading"}
              >
                <button
                  class="updates-button updates-button-primary"
                  onClick={() => void openDownload()}
                >
                  <ArrowDownToLine size={16} />{" "}
                  {mobilePlatform() === "android"
                    ? "Baixar APK"
                    : mobilePlatform() === "ios"
                      ? "Baixar IPA sem assinatura"
                      : "Baixar instalador"}
                </button>
              </Show>
            }
          >
            <button
              class="updates-button updates-button-primary"
              disabled={updateState().inCall}
              onClick={() => void install()}
            >
              <RefreshCw size={16} /> Reiniciar e atualizar
            </button>
          </Show>
          <button
            class="updates-button"
            disabled={busy()}
            onClick={() => void checkUpdates()}
          >
            <RefreshCw size={15} classList={{ "updates-spin": busy() }} />{" "}
            {busy()
              ? updateState().status === "downloading"
                ? "Baixando atualização…"
                : "Verificando…"
              : "Verificar agora"}
          </button>
        </div>
        <Show when={ready() && updateState().inCall}>
          <p class="updates-call-note">
            <Clock3 size={14} /> A atualização já está baixada. O botão será
            liberado quando você sair da chamada.
          </p>
        </Show>
        <Show when={updateState().checkedAt}>
          <small class="updates-last-check">
            <Check size={12} /> Última consulta:{" "}
            {new Date(updateState().checkedAt!).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </small>
        </Show>
      </div>
      <Show when={updateState().error || actionError()}>
        <div class="updates-error" role="status">
          {actionError() || updateState().error}
        </div>
      </Show>
      <div class="updates-history-heading">
        <div>
          <h2>
            <History size={19} /> Histórico de versões
          </h2>
          <p>Veja o que mudou e o que chegou depois da sua versão.</p>
        </div>
        <Show when={newVersions().length}>
          <span class="updates-count">
            {newVersions().length} nova
            {newVersions().length > 1 ? "s versões" : " versão"}
          </span>
        </Show>
      </div>
      <div class="updates-filters">
        <div class="updates-tabs" role="group" aria-label="Filtrar versões">
          <button
            classList={{ active: !onlyNew() }}
            onClick={() => setOnlyNew(false)}
          >
            Todas
          </button>
          <button
            classList={{ active: onlyNew() }}
            onClick={() => setOnlyNew(true)}
          >
            Novidades para você
          </button>
        </div>
        <label class="updates-search">
          <Search size={15} />
          <input
            type="search"
            aria-label="Pesquisar versões e alterações"
            placeholder="Buscar versão ou mudança"
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
      </div>
      <div class="updates-timeline">
        <For
          each={visible()}
          fallback={
            <div class="updates-empty">
              {query()
                ? "Nenhuma alteração encontrada para essa busca."
                : "Nenhuma versão mais nova publicada nesta consulta."}
            </div>
          }
        >
          {(release) => <VersionCard release={release} />}
        </For>
      </div>
      <a
        class="updates-all-releases"
        href={releasesURL}
        target="_blank"
        rel="noopener noreferrer"
      >
        Todas as releases no GitHub <ArrowUpRight size={14} />
      </a>
    </section>
  );
}
