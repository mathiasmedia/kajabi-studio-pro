import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
//
// Thin-client vite config. The engine alias block is inlined here (rather
// than imported from `@k-studio-pro/engine/vite`) because Node refuses to
// type-strip `.ts` files inside node_modules. This is the same logic as
// `viteEngineAliases()` in the engine package — keep it in sync if the
// engine ever changes its alias shape.
const ENGINE_SRC = path.resolve(__dirname, "node_modules/@k-studio-pro/engine/src");
const engineDir = (sub: string) => path.resolve(ENGINE_SRC, sub) + "/";
const engineFile = (file: string) => path.resolve(ENGINE_SRC, file);

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    // Order matters: more-specific aliases must come before "@".
    alias: [
      // Deep imports — regex pattern AND replacement MUST end with "/"
      { find: /^@\/blocks\//, replacement: engineDir("blocks") },
      { find: /^@\/engines\//, replacement: engineDir("engines") },
      { find: /^@\/lib\/siteDesign\//, replacement: engineDir("siteDesign") },
      { find: /^@\/types\//, replacement: engineDir("types") },
      // Bare (barrel) imports
      { find: /^@\/blocks$/, replacement: engineFile("blocks/index.ts") },
      { find: /^@\/engines$/, replacement: engineFile("engines/index.ts") },
      { find: /^@\/lib\/siteDesign$/, replacement: engineFile("siteDesign/index.ts") },
      // (no internal alias needed — main.tsx imports from public engine entry only)
      // Thin-client app shell catch-all — MUST be last
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    // Dedupe is CRITICAL — without this, the engine package and the thin-client
    // app can each get their own copy of React / React Router, fragmenting
    // React contexts and producing "useAuth must be used within an AuthProvider".
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-router-dom",
      "@tanstack/react-query",
      "@tanstack/query-core",
      "swiper",
      "@k-studio-pro/engine",
    ],
  },
  // Pre-bundle React + Router so Vite ships ONE copy across both the thin
  // client and the engine package's shell. Skipping this lets Vite split the
  // engine shell into a separate dep optimization chunk that imports its own
  // React/Router instance — the classic "AuthProvider context lost" failure.
  //
  // DO NOT add `@k-studio-pro/engine` (or its subpaths) to optimizeDeps.exclude.
  // Treat .zip files as static assets so the engine's `?url` imports of
  // bundled base-theme zips resolve to fetchable URLs at runtime.
  assetsInclude: ["**/*.zip"],
  optimizeDeps: {
    include: [
      "react",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      "jszip",
      // Pre-bundle the engine entry points so React/Router stay deduped
      // (prevents "useAuth must be used within an AuthProvider").
      "@k-studio-pro/engine",
      "@k-studio-pro/engine/shell",
      "@k-studio-pro/engine/data",
    ],
    // The engine package imports `.zip?url` files. esbuild's dep-optimizer
    // can't natively handle Vite's `?url` suffix, so we install a plugin
    // that intercepts every `*.zip?url` (and `*.zip`) resolution inside the
    // dep-cache and rewrites it to a tiny JS module that re-exports the
    // ABSOLUTE file path on disk. Vite's main pipeline (which DOES
    // understand `?url`) then takes that path through its asset transform
    // and serves the real fetchable URL — no copying zips into public/,
    // no manual URL overrides in main.tsx.
    esbuildOptions: {
      plugins: [
        {
          name: "resolve-engine-zips",
          setup(build) {
            build.onResolve({ filter: /\.zip(\?url)?$/ }, (args) => {
              const cleanPath = args.path.replace(/\?url$/, "");
              const abs = path.resolve(args.resolveDir, cleanPath);
              return { path: abs, namespace: "engine-zip-url" };
            });
            build.onLoad({ filter: /.*/, namespace: "engine-zip-url" }, (args) => ({
              contents: `export default ${JSON.stringify("/@fs" + args.path)};`,
              loader: "js",
            }));
          },
        },
      ],
    },
  },
}));
