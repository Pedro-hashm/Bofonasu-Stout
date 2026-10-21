const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const web = path.join(root, "for-web");
const client = path.join(web, "packages/client");
const env = {
  ...process.env,
  BASE_PATH: "/",
  PWA_SCOPE: "/",
  NODE_OPTIONS:
    `${process.env.NODE_OPTIONS || ""} --max-old-space-size=4096`.trim(),
};
function run(script, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Compilação interrompida (${code}).`)),
    );
  });
}
async function bin(cwd, name, command, args = []) {
  const manifest = path.join(cwd, "node_modules", name, "package.json");
  const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const executable = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.[command];
  if (!executable) throw new Error(`Executável ausente: ${name}/${command}`);
  console.log(`Compilando ${command} ${args.join(" ")}`);
  await run(path.resolve(path.dirname(manifest), executable), args, cwd);
}
async function main() {
  await run(path.join(root, "scripts/release.cjs"), ["check"], root);
  await bin(path.join(web, "packages/stoat.js"), "typescript", "tsc");
  await bin(
    path.join(web, "packages/solid-livekit-components"),
    "tsup",
    "tsup",
  );
  await bin(client, "@lingui/cli", "lingui", ["compile", "--typescript"]);
  await bin(client, "@pandacss/dev", "panda", ["codegen"]);
  await run(path.join(client, "scripts/copyAssets.mjs"), [], client);
  await bin(client, "vite", "vite", ["build"]);
  const catalog = fs.readFileSync(path.join(root, "releases.json"));
  fs.writeFileSync(
    path.join(client, "dist/bofonasu-build.json"),
    JSON.stringify({
      version: JSON.parse(catalog).versions[0].version,
      catalogHash: crypto
        .createHash("sha256")
        .update(JSON.stringify(JSON.parse(catalog)))
        .digest("hex"),
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
