/* eslint-disable @typescript-eslint/no-var-requires -- Standalone Node build script. */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const desktop = path.resolve(__dirname, "..");
const web = path.resolve(desktop, "../for-web");
const client = path.join(web, "packages/client");
const tooling = path.resolve(desktop, "../tooling");
const temp = path.join(tooling, "build-temp");
fs.mkdirSync(temp, { recursive: true });

const env = {
  ...process.env,
  // Both runtimes need to resolve assets at their origin's root.
  BASE_PATH: "/",
  PWA_SCOPE: "/",
  NODE_OPTIONS:
    `${process.env.NODE_OPTIONS || ""} --max-old-space-size=4096`.trim(),
  ELECTRON_CACHE: path.join(tooling, "electron-cache"),
  npm_config_cache: path.join(tooling, "npm-cache"),
  npm_config_devdir: path.join(tooling, "node-gyp-cache"),
  npm_config_loglevel: "error",
  TEMP: temp,
  TMP: temp,
  TMPDIR: temp,
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
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Build interrompida (${signal || code}).`));
    });
  });
}

async function bin(cwd, name, command, args = []) {
  // Read through the installed link: some CLIs deliberately do not export
  // package.json, so require.resolve("package/package.json") cannot locate it.
  const manifest = path.join(cwd, "node_modules", name, "package.json");
  const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const relative = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.[command];
  if (!relative)
    throw new Error(`Executável ${command} indisponível em ${name}.`);
  console.log(`\nCompilando: ${command} ${args.join(" ")}`);
  await run(path.resolve(path.dirname(manifest), relative), args, cwd);
}

async function main() {
  if (process.platform !== "win32")
    throw new Error("Execute build:win no Windows.");
  const runtime = await require("./build-runtime.cjs")();
  if (runtime !== process.execPath) {
    await new Promise((resolve, reject) => {
      const child = spawn(runtime, [__filename, ...process.argv.slice(2)], {
        cwd: desktop,
        env,
        stdio: "inherit",
        windowsHide: true,
      });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`Build interrompida (${code}).`)),
      );
    });
    return;
  }
  const targetArch = process.arch;
  if (!["x64", "arm64"].includes(targetArch))
    throw new Error(`Arquitetura não suportada: ${targetArch}.`);

  await run(
    path.resolve(desktop, "../scripts/release.cjs"),
    ["check"],
    desktop,
  );

  if (!process.argv.includes("--prebuilt-web"))
    await run(path.resolve(desktop, "../scripts/build-web.cjs"), [], desktop);
  const stamp = JSON.parse(
    fs.readFileSync(path.join(client, "dist/bofonasu-build.json"), "utf8"),
  );
  const catalog = fs.readFileSync(path.resolve(desktop, "../releases.json"));
  const digest = require("node:crypto")
    .createHash("sha256")
    .update(JSON.stringify(JSON.parse(catalog)))
    .digest("hex");
  if (stamp.catalogHash !== digest)
    throw new Error("A interface pré-compilada não corresponde a esta versão.");

  await bin(desktop, "@electron-forge/cli", "electron-forge", [
    "make",
    "--platform=win32",
    `--arch=${targetArch}`,
  ]);
  await run(
    path.resolve(desktop, "../scripts/release.cjs"),
    ["manifest"],
    desktop,
  );
  console.log(
    `\nBuild pronta. Instalador: ${path.join(desktop, "out/make/squirrel.windows", targetArch, "Bofonasu-Stout-Setup.exe")}\nZIP: ${path.join(desktop, "out/make/zip/win32", targetArch)}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
