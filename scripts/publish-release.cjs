const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

async function main() {
  const root = path.resolve(__dirname, "..");
  const desktop = path.join(root, "for-desktop");
  const pkg = JSON.parse(
    fs.readFileSync(path.join(desktop, "package.json"), "utf8"),
  );
  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, "releases.json"), "utf8"),
  );
  const manifestPath = path.join(desktop, "out/make/release-manifest.json");
  if (!fs.existsSync(manifestPath))
    throw new Error("Gere os artefatos primeiro com build:win.");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  async function hash(file) {
    const digest = crypto.createHash("sha256");
    for await (const chunk of fs.createReadStream(file)) digest.update(chunk);
    return digest.digest("hex");
  }
  if (
    manifest.version !== pkg.version ||
    manifest.arch !== "x64" ||
    manifest.platform !== "win32" ||
    manifest.catalogHash !== (await hash(path.join(root, "releases.json")))
  )
    throw new Error(
      "A build está desatualizada ou não é Windows x64. Execute build:win novamente.",
    );
  const files = [];
  for (const artifact of manifest.artifacts) {
    const file = path.resolve(desktop, artifact.path);
    const allowed = path.join(desktop, "out/make") + path.sep;
    if (
      !file.startsWith(allowed) ||
      !fs.existsSync(file) ||
      (await hash(file)) !== artifact.sha256
    )
      throw new Error("Os artefatos foram alterados. Gere a build novamente.");
    files.push(file);
  }
  // Creating the public tag is a separate, explicit source-control action.
  // --verify-tag prevents publishing a binary-only release from an unpushed tag.
  const args = [
    "release",
    "create",
    `v${pkg.version}`,
    ...files,
    "--repo",
    catalog.repository,
    "--verify-tag",
    "--latest",
    "--title",
    `Bofonasu Stout ${pkg.version}`,
    "--notes-file",
    path.join(desktop, "out/make/release-notes.md"),
  ];
  await new Promise((resolve, reject) => {
    const child = spawn("gh", args, {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", () =>
      reject(
        new Error(
          "GitHub CLI indisponível. Execute este comando com mise exec gh -- node ../scripts/publish-release.cjs.",
        ),
      ),
    );
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(
              "Publicação não concluída. Confira o login do GitHub CLI e se a tag foi enviada.",
            ),
          ),
    );
  });
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
