import { lingui as linguiSolidPlugin } from "@lingui/vite-plugin";
import devtools from "@solid-devtools/transform";
import legacy from "@vitejs/plugin-legacy";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import Inspect from "vite-plugin-inspect";
import { VitePWA } from "vite-plugin-pwa";
import solidPlugin from "vite-plugin-solid";
import solidSvg from "vite-plugin-solid-svg";

import codegenPlugin from "./codegen.plugin";
import { addFontPreload } from "./fontpreload.plugin";

const base = process.env.BASE_PATH ?? "/";
const pwaScope = process.env.PWA_SCOPE || base;

export default defineConfig(({ mode }) => {
  const devtoolsEnabled =
    loadEnv(mode, process.cwd(), "VITE_").VITE_DEVTOOLS === "true";
  return {
    base,
    cacheDir: "node_modules/.vite-bofonasu-dev",
    plugins: [
      Inspect(),
      ...(devtoolsEnabled ? [devtools()] : []),
      {
        name: "bofonasu-dev-entry",
        apply: "serve",
        transformIndexHtml(html) {
          // Run worker cleanup before loading the application's ESM graph.
          return html.replace('src="/src/index.tsx"', 'src="/src/devEntry.ts"');
        },
      },
      codegenPlugin(),
      solidPlugin({
        // The dedicated Lingui transform must also run on plain TypeScript
        // (e.g. client/Controller.ts), not only on JSX components.
        extensions: [[".ts", { typescript: true }]],
        babel: {
          plugins: ["@lingui/babel-plugin-lingui-macro"],
        },
      }),
      linguiSolidPlugin(),
      solidSvg({
        defaultAsComponent: false,
      }),
      addFontPreload(),
      legacy({
        // Chrome, Edge and Firefox are set by Uint8Array.prototype.toBase64.
        // Safari stays at 17 on purpose: iPad 6 and similar devices can't update past iPadOS 17
        modernTargets: [
          "chrome >= 140",
          "edge >= 140",
          "firefox >= 133",
          "safari >= 17",
          "ios_saf >= 17",
        ],
        modernPolyfills: true,
        renderLegacyChunks: false,
      }),
      VitePWA({
        srcDir: "src",
        registerType: "autoUpdate",
        filename: "serviceWorker.ts",
        strategies: "injectManifest",
        injectManifest: {
          maximumFileSizeToCacheInBytes: 8000000,
          globPatterns: [
            "**/*.{js,css,html,wav}",
            "**/material-symbols-*.woff2",
          ],
        },
        devOptions: {
          enabled: false,
          type: "module",
        },
        manifest: {
          name: "Stoat",
          short_name: "Stoat",
          description: "User-first open source chat platform.",
          categories: ["communication", "chat", "messaging"],
          start_url: base,
          scope: pwaScope,
          display_override: ["window-controls-overlay"],
          display: "standalone",
          background_color: "#101823",
          theme_color: "#101823",
          icons: [
            {
              src: `${base}assets/web/android-chrome-192x192.png`,
              type: "image/png",
              sizes: "192x192",
            },
            {
              src: `${base}assets/web/android-chrome-512x512.png`,
              type: "image/png",
              sizes: "512x512",
            },
            {
              src: `${base}assets/web/monochrome.svg`,
              type: "image/svg+xml",
              sizes: "48x48 72x72 96x96 128x128 256x256",
              purpose: "monochrome",
            },
            {
              src: `${base}assets/web/masking-512x512.png`,
              type: "image/png",
              sizes: "512x512",
              purpose: "maskable",
            },
          ],
          // TODO: take advantage of shortcuts
        },
      }),
    ],
    build: {
      target: "esnext",
      cssTarget: "esnext",
      rollupOptions: {
        external: ["hast"],
        output: {
          manualChunks: {
            markdown: [
              "lowlight",
              "rehype-highlight",
              "rehype-katex",
              "remark-breaks",
              "remark-gfm",
              "remark-math",
              "remark-parse",
              "remark-rehype",
              "vfile",
            ],
          },
        },
      },
      sourcemap: true,
    },
    optimizeDeps: {
      entries: ["index.html", "src/index.tsx"],
      holdUntilCrawlEnd: true,
      include: [
        "workbox-precaching",
        "workbox-window",
        "solid-livekit-components > @solid-primitives/intersection-observer",
        "solid-livekit-components > @solid-primitives/scheduled",
        ...(devtoolsEnabled
          ? ["@solid-devtools/debugger", "@solid-devtools/overlay"]
          : []),
      ],
      exclude: ["hast"],
    },
    server: {
      strictPort: true,
    },
    resolve: {
      dedupe: ["solid-js", "solid-livekit-components", "livekit-client"],
      // Component aliases include the local update/changelog module.
      alias: {
        "styled-system": resolve(__dirname, "styled-system"),
        ...readdirSync(resolve(__dirname, "components")).reduce(
          (p, f) => ({
            ...p,
            [`@revolt/${f}`]: resolve(__dirname, "components", f),
          }),
          {},
        ),
      },
    },
  };
});
