// eslint-disable-next-line @typescript-eslint/no-var-requires -- Standalone CommonJS launcher, outside the TypeScript build.
const { spawn } = require("node:child_process");
// eslint-disable-next-line @typescript-eslint/no-var-requires -- Standalone CommonJS launcher, outside the TypeScript build.
const path = require("node:path");

/** Locate the local frontend and launch a development profile independent of the installed Stoat. */
async function main() {
  const root = path.resolve(__dirname, "..");
  const tooling = path.resolve(root, "../tooling");
  const requested = process.argv[2] || process.env.STOAT_DEV_URL;
  const candidates = requested
    ? [requested]
    : ["http://localhost:5173", "http://localhost:5174"];
  let server;
  for (const candidate of candidates) {
    const url = new URL(candidate);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
      throw new Error(
        "Use a URL local do Vite, por exemplo http://localhost:5174.",
      );
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2000),
        redirect: "error",
      });
      const html = await response.text();
      if (response.ok && /<title>\s*Stoat\s*<\/title>/i.test(html)) {
        server = url.href;
        break;
      }
    } catch {
      /* The next default port may contain the running frontend. */
    }
  }
  if (!server)
    throw new Error(
      "Frontend não encontrado. Inicie o Vite e execute pnpm start:local http://localhost:PORTA com a URL exibida no terminal.",
    );
  const profile = path.join(tooling, "desktop-dev-profile");
  console.log(`Abrindo ${server}\nPerfil de desenvolvimento: ${profile}`);
  const env = {
    ...process.env,
    ELECTRON_CACHE: path.join(tooling, "electron-cache"),
    npm_config_cache: path.join(tooling, "npm-cache"),
    npm_config_devdir: path.join(tooling, "node-gyp-cache"),
    npm_config_loglevel: "error",
  };
  const child = spawn(
    process.execPath,
    [
      require.resolve("@electron-forge/cli/dist/electron-forge.js"),
      "start",
      "--",
      `--force-server=${server}`,
      `--dev-profile=${profile}`,
    ],
    { cwd: root, env, stdio: "inherit", windowsHide: true },
  );
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
