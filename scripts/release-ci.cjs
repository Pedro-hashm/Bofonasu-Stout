const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const catalog = JSON.parse(fs.readFileSync(path.join(root, "releases.json")));
const version = catalog.versions[0].version;
const tag = `v${version}`;
function validate() {
  if (process.env.BUILD_TAG !== tag)
    throw new Error(`A tag precisa ser ${tag}.`);
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts/release.cjs"), "check"],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error("Histórico inconsistente.");
  if (process.env.GITHUB_OUTPUT)
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `version=${version}\ntag=${tag}\n`,
    );
}
function collectWindows() {
  const desktop = path.join(root, "for-desktop");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(desktop, "out/make/release-manifest.json")),
  );
  if (manifest.version !== version)
    throw new Error("Build Windows de outra versão.");
  const target = path.join(root, "artifacts/windows");
  fs.mkdirSync(target, { recursive: true });
  for (const artifact of manifest.artifacts) {
    const source = path.resolve(desktop, artifact.path);
    if (!source.startsWith(path.join(desktop, "out/make") + path.sep))
      throw new Error("Caminho inválido.");
    const basename = source.endsWith(".zip")
      ? `Bofonasu-Stout-Windows-x64-${version}.zip`
      : path.basename(source);
    fs.copyFileSync(source, path.join(target, basename));
  }
}
function prepareMobile() {
  const stamp = JSON.parse(
    fs.readFileSync(
      path.join(root, "for-web/packages/client/dist/bofonasu-build.json"),
    ),
  );
  const catalogHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(catalog))
    .digest("hex");
  if (stamp.catalogHash !== catalogHash)
    throw new Error("Interface mobile de outra versão.");
  fs.mkdirSync(path.join(root, "artifacts/mobile"), { recursive: true });
}
function notes() {
  const latest = catalog.versions[0];
  const body = `# ${latest.title}\n\n${latest.changes.map((change) => `- ${change}`).join("\n")}\n\n## Downloads\n\n- Windows: instalador EXE (atualização automática) ou ZIP portátil.\n- Android: APK assinado, Android 7 ou posterior.\n- iOS: IPA **sem assinatura**, para iPhone/iPad (iOS 15+). Não instala diretamente pelo download; exige assinatura/provisionamento antes da instalação.\n\nOs clientes mobile reutilizam a interface web. Chamadas em segundo plano e envio da própria tela ainda não têm integração nativa nesta versão.\n`;
  fs.writeFileSync(path.join(root, "release-notes-ci.md"), body);
}
try {
  const command = process.argv[2];
  if (command === "validate") validate();
  else if (command === "windows") collectWindows();
  else if (command === "mobile") prepareMobile();
  else if (command === "notes") notes();
  else throw new Error("Comando CI desconhecido.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
