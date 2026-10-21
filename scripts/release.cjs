const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "releases.json");
const packagePath = path.join(root, "for-desktop/package.json");
const mobilePath = path.join(root, "for-mobile/package.json");
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) =>
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const notes = (entry) =>
  `# ${entry.title}\n\n${entry.changes.map((change) => `- ${change}`).join("\n")}\n`;

function validate(catalog, pkg) {
  if (
    catalog.schemaVersion !== 1 ||
    catalog.repository !== "Pedro-hashm/Bofonasu-Stout"
  )
    throw new Error("Catálogo de releases inválido.");
  const seen = new Set();
  for (const entry of catalog.versions) {
    if (
      !/^\d+\.\d+\.\d+$/.test(entry.version) ||
      seen.has(entry.version) ||
      !entry.title ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
      !entry.changes?.length ||
      entry.changes.some(
        (change) => typeof change !== "string" || !change.trim(),
      )
    )
      throw new Error(`Entrada inválida no histórico: ${entry.version}.`);
    seen.add(entry.version);
  }
  if (pkg.version !== catalog.versions[0]?.version)
    throw new Error(
      "A versão do desktop deve ser igual à primeira versão de releases.json.",
    );
  if (fs.existsSync(mobilePath) && read(mobilePath).version !== pkg.version)
    throw new Error("A versão mobile deve ser igual à versão do desktop.");
}

function writeChangelog(catalog) {
  const content =
    "# Changelog — Bofonasu Stout\n\nHistórico das builds. As versões publicadas podem ser consultadas no GitHub Releases.\n\n" +
    catalog.versions
      .map(
        (entry) =>
          `## ${entry.version} — ${entry.date}\n\n${notes(entry).replace(/^# /, "### ")}`,
      )
      .join("\n");
  fs.writeFileSync(path.join(root, "CHANGELOG.md"), content);
}

async function hash(file) {
  const digest = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) digest.update(chunk);
  return digest.digest("hex");
}

async function manifest(catalog, pkg) {
  const desktop = path.join(root, "for-desktop");
  const directory = path.join(
    desktop,
    "out/make/squirrel.windows",
    process.arch,
  );
  const files = [
    "RELEASES",
    `BofonasuStout-${pkg.version}-full.nupkg`,
    "Bofonasu-Stout-Setup.exe",
  ].map((name) => path.join(directory, name));
  const zip = path.join(
    desktop,
    "out/make/zip/win32",
    process.arch,
    `Bofonasu Stout-win32-${process.arch}-${pkg.version}.zip`,
  );
  if (fs.existsSync(zip)) files.push(zip);
  const artifacts = [];
  for (const file of files) {
    if (!fs.existsSync(file) || !fs.statSync(file).size)
      throw new Error(`Artefato ausente: ${file}`);
    artifacts.push({
      path: path.relative(desktop, file),
      sha256: await hash(file),
    });
  }
  write(path.join(desktop, "out/make/release-manifest.json"), {
    version: pkg.version,
    arch: process.arch,
    platform: process.platform,
    catalogHash: await hash(catalogPath),
    builtAt: new Date().toISOString(),
    artifacts,
  });
  fs.writeFileSync(
    path.join(desktop, "out/make/release-notes.md"),
    notes(catalog.versions[0]),
  );
}

async function main() {
  const [command = "check", ...args] = process.argv
    .slice(2)
    .filter((arg) => arg !== "--");
  const catalog = read(catalogPath);
  const pkg = read(packagePath);
  validate(catalog, pkg);
  if (command === "prepare") {
    const [kind] = args;
    if (!["patch", "minor", "major"].includes(kind))
      throw new Error(
        "Use prepare patch|minor|major --title TÍTULO --change ALTERAÇÃO [--change ALTERAÇÃO].",
      );
    const titleIndex = args.indexOf("--title");
    const title = titleIndex >= 0 ? args[titleIndex + 1] : undefined;
    const changes = args.flatMap((arg, index) =>
      arg === "--change" ? [args[index + 1]] : [],
    );
    if (
      !title ||
      !changes.length ||
      changes.some((change) => !change || change.startsWith("--"))
    )
      throw new Error("Informe o título e pelo menos uma alteração.");
    const [major, minor, patch] = pkg.version.split(".").map(Number);
    const version =
      kind === "major"
        ? `${major + 1}.0.0`
        : kind === "minor"
          ? `${major}.${minor + 1}.0`
          : `${major}.${minor}.${patch + 1}`;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    catalog.versions.unshift({ version, date, title, changes });
    pkg.version = version;
    if (fs.existsSync(mobilePath)) {
      const mobile = read(mobilePath);
      mobile.version = version;
      write(mobilePath, mobile);
      const lockPath = path.join(root, "for-mobile/package-lock.json");
      if (fs.existsSync(lockPath)) {
        const lock = read(lockPath);
        lock.version = version;
        lock.packages[""].version = version;
        write(lockPath, lock);
      }
    }
    validate(catalog, pkg);
    write(catalogPath, catalog);
    write(packagePath, pkg);
    writeChangelog(catalog);
    console.log(
      `Versão ${version} preparada. Revise releases.json e CHANGELOG.md antes de compilar.`,
    );
  } else if (command === "notes")
    process.stdout.write(notes(catalog.versions[0]));
  else if (command === "manifest") await manifest(catalog, pkg);
  else if (command === "check" || command === "write") {
    if (command === "write") writeChangelog(catalog);
    console.log(`Versão ${pkg.version} e histórico consistentes.`);
  } else
    throw new Error(
      "Comando desconhecido. Use prepare, check, write, notes ou manifest.",
    );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
