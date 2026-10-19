/* eslint-disable no-undef, @typescript-eslint/no-require-imports -- Node CommonJS launcher. */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const client = path.join(root, "packages/client");

function run(script, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Processo encerrado com código ${code}.`)),
    );
  });
}

async function bin(cwd, pkg, command, args = []) {
  const manifest = path.join(cwd, "node_modules", pkg, "package.json");
  if (!fs.existsSync(manifest))
    throw new Error(
      "Dependências ausentes. Execute node scripts/pnpm-local.cjs install --frozen-lockfile.",
    );
  const info = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const entry = typeof info.bin === "string" ? info.bin : info.bin[command];
  await run(path.resolve(path.dirname(manifest), entry), args, cwd);
}

async function main() {
  if (!fs.existsSync(path.join(root, "packages/stoat.js/lib/index.js")))
    await bin(path.join(root, "packages/stoat.js"), "typescript", "tsc");
  if (
    !fs.existsSync(
      path.join(root, "packages/solid-livekit-components/dist/dev.jsx"),
    )
  )
    await bin(
      path.join(root, "packages/solid-livekit-components"),
      "tsup",
      "tsup",
    );
  await bin(client, "@lingui/cli", "lingui", ["compile", "--typescript"]);
  await bin(client, "@pandacss/dev", "panda", ["codegen"]);
  await run(path.join(client, "scripts/copyAssets.mjs"), [], client);
  // Vite invalidates its cache when the lockfile/config changes. Reusing a valid
  // cache avoids changing chunk URLs beneath already open development clients.
  await bin(client, "vite", "vite", [
    "--host",
    "localhost",
    ...process.argv.slice(2),
  ]);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
