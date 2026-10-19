import { stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { app, net, protocol } from "electron";

const scheme = "bofonasu";

// Register before app.ready. Standard, secure origins support storage, media,
// workers and absolute asset URLs without a local HTTP server or open port.
protocol.registerSchemesAsPrivileged([
  {
    scheme,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      allowServiceWorkers: true,
      stream: true,
    },
  },
]);

export const BUILD_URL = new URL(
  app.isPackaged
    ? `${scheme}://app/`
    : app.commandLine.hasSwitch("force-server")
      ? app.commandLine.getSwitchValue("force-server")
      : "https://stoat.chat/app",
);

/** Serve only the compiled frontend copied into app.asar by Forge. */
export async function registerBundledFrontend() {
  if (!app.isPackaged) return;
  const root = path.join(app.getAppPath(), "frontend");
  await stat(path.join(root, "index.html"));

  protocol.handle(scheme, async (request) => {
    const url = new URL(request.url);
    if (url.host !== "app") return new Response(null, { status: 404 });
    if (!["GET", "HEAD"].includes(request.method))
      return new Response(null, { status: 405 });

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response(null, { status: 400 });
    }
    if (/[\\:\0]/.test(pathname)) return new Response(null, { status: 400 });
    let file = path.resolve(root, pathname.replace(/^\/+/, ""));
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      return new Response(null, { status: 403 });

    try {
      if ((await stat(file)).isDirectory())
        file = path.join(file, "index.html");
      await stat(file);
    } catch {
      // Only document navigations may fall back to the SPA, never missing JS,
      // CSS, audio, workers or images. Refreshing /channel/... must still work.
      if (
        request.mode !== "navigate" &&
        !request.headers.get("accept")?.includes("text/html")
      )
        return new Response(null, { status: 404 });
      file = path.join(root, "index.html");
    }
    return net.fetch(pathToFileURL(file).toString(), {
      method: request.method,
    });
  });
}
