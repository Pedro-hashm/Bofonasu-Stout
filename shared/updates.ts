import catalog from "../releases.json";

export const repository = catalog.repository;
export const releasesURL = `https://github.com/${repository}/releases`;
export const bundledVersion = catalog.versions[0].version;

export interface AppRelease {
  version: string;
  title: string;
  date: string;
  notes: string;
  url: string;
  published: boolean;
  /** Present only for a stable public release with the expected Squirrel assets. */
  feedURL?: string;
  downloadURL?: string;
  androidDownloadURL?: string;
  iosDownloadURL?: string;
}

export interface UpdateState {
  currentVersion: string;
  status:
    | "idle"
    | "checking"
    | "current"
    | "available"
    | "downloading"
    | "ready"
    | "error"
    | "unpublished";
  mode: "automatic" | "manual" | "development" | "web" | "mobile";
  latestVersion?: string;
  downloadedVersion?: string;
  checkedAt?: string;
  error?: string;
  inCall: boolean;
  releases: AppRelease[];
}

export interface UpdateBridge {
  getState(): Promise<UpdateState>;
  check(): Promise<UpdateState>;
  install(): Promise<boolean>;
  openDownload(): Promise<void>;
  setInCall(value: boolean): void;
  subscribe(callback: (state: UpdateState) => void): () => void;
}

export function stableVersion(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const match = /^v?((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(
    value,
  );
  return match?.[1];
}

export function compareVersions(a: string, b: string): number {
  const left = (stableVersion(a) ?? "0.0.0").split(".").map(Number);
  const right = (stableVersion(b) ?? "0.0.0").split(".").map(Number);
  for (let i = 0; i < 3; i++)
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

export const bundledReleases: AppRelease[] = catalog.versions.map((entry) => ({
  version: entry.version,
  title: entry.title,
  date: entry.date,
  notes: entry.changes.map((change) => `- ${change}`).join("\n"),
  url: releasesURL,
  published: false,
}));

export function mergeReleases(remote: AppRelease[]): AppRelease[] {
  const result = new Map(
    bundledReleases.map((entry) => [entry.version, entry]),
  );
  for (const entry of remote)
    result.set(entry.version, {
      ...entry,
      notes:
        entry.notes ||
        result.get(entry.version)?.notes ||
        "Sem notas para esta versão.",
    });
  return [...result.values()].sort((a, b) =>
    compareVersions(b.version, a.version),
  );
}

/** Public, stable GitHub Releases only. No client credentials are required. */
export async function fetchPublicReleases(): Promise<AppRelease[]> {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/releases?per_page=50`,
    {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 403 || response.status === 429
        ? "O GitHub limitou as consultas. Tente novamente mais tarde."
        : "Não foi possível consultar as versões no GitHub. Tente novamente.",
    );
  const raw: unknown = await response.json();
  if (!Array.isArray(raw))
    throw new Error("A resposta das versões não é válida.");
  const entries: AppRelease[] = [];
  for (const release of raw) {
    if (
      !release ||
      typeof release !== "object" ||
      release.draft ||
      release.prerelease
    )
      continue;
    const version = stableVersion(release.tag_name);
    if (!version || typeof release.tag_name !== "string") continue;
    const assets: string[] = Array.isArray(release.assets)
      ? release.assets
          .map((asset: { name?: unknown }) => asset?.name)
          .filter((name: unknown): name is string => typeof name === "string")
      : [];
    const tag = encodeURIComponent(release.tag_name);
    const downloadBase = `https://github.com/${repository}/releases/download/${tag}/`;
    const hasUpdater = [
      "RELEASES",
      `BofonasuStout-${version}-full.nupkg`,
      "Bofonasu-Stout-Setup.exe",
    ].every((name) => assets.includes(name));
    entries.push({
      version,
      title:
        typeof release.name === "string"
          ? release.name.slice(0, 200)
          : `Versão ${version}`,
      date:
        typeof release.published_at === "string" ? release.published_at : "",
      notes:
        typeof release.body === "string" ? release.body.slice(0, 64000) : "",
      url: `${releasesURL}/tag/${tag}`,
      published: true,
      feedURL: hasUpdater ? downloadBase : undefined,
      downloadURL: assets.includes("Bofonasu-Stout-Setup.exe")
        ? `${downloadBase}Bofonasu-Stout-Setup.exe`
        : undefined,
      androidDownloadURL: assets.includes(
        `Bofonasu-Stout-Android-${version}.apk`,
      )
        ? `${downloadBase}Bofonasu-Stout-Android-${version}.apk`
        : undefined,
      iosDownloadURL: assets.includes(
        `Bofonasu-Stout-iOS-${version}-unsigned.ipa`,
      )
        ? `${downloadBase}Bofonasu-Stout-iOS-${version}-unsigned.ipa`
        : undefined,
    });
  }
  return entries.sort((a, b) => compareVersions(b.version, a.version));
}
