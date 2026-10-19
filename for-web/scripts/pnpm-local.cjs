/* eslint-disable no-undef, @typescript-eslint/no-require-imports -- Node CommonJS launcher. */
// Run the pinned pnpm with Node and explicit ESM metadata. The mise standalone
// distribution omits package.json, so worker.js can inherit a parent's CommonJS
// setting. Keep this repair inside the project's tooling directory.
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const version = pkg.packageManager.match(/^pnpm@(\d+\.\d+\.\d+)/)[1];
const runtime = path.resolve(root, "../tooling/pnpm-runtime", version);
const cli = path.join(runtime, "dist/pnpm.mjs");

try {
  if (!fs.existsSync(cli)) {
    if (!process.env.LOCALAPPDATA)
      throw new Error("Use o pnpm instalado normalmente neste sistema.");
    const source = path.join(
      process.env.LOCALAPPDATA,
      "mise/installs/pnpm",
      version,
      "dist",
    );
    if (!fs.existsSync(path.join(source, "pnpm.mjs")))
      throw new Error(`Instale o pnpm ${version} com mise install primeiro.`);
    fs.mkdirSync(runtime, { recursive: true });
    fs.cpSync(source, path.join(runtime, "dist"), { recursive: true });
  }
  fs.writeFileSync(
    path.join(runtime, "package.json"),
    '{"private":true,"type":"module"}\n',
  );
  const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
