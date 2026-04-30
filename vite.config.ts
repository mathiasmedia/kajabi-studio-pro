import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Engine path helpers — guarantee a trailing slash on directories so deep
// imports like `@/blocks/components/Slider` don't collapse into
// `…/blockscomponents/Slider` (path.resolve strips trailing slashes).
const ENGINE_SRC = path.resolve(
  __dirname,
  "node_modules/@k-studio-pro/engine/src",
);
function engineFile(file: string): string {
  return path.resolve(ENGINE_SRC, file);
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  optimizeDeps: {
    // Pre-bundle React + router so HMR + dedupe stay stable across the engine.
    include: [
      "react",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      "jszip",
    ],
    // The engine is consumed as source via the aliases below and ships
    // `import ... from '*.zip?url'` for its bundled base themes. Excluding it
    // from esbuild's dep pre-bundle scan avoids "No loader is configured for
    // .zip" errors — Vite's own asset pipeline handles `?url` at request time.
    exclude: [
      "@k-studio-pro/engine",
      "@k-studio-pro/engine/shell",
      "@k-studio-pro/engine/data",
      "@k-studio-pro/engine/vite",
    ],
    // Belt-and-braces: even with the engine excluded, esbuild's scanner still
    // walks transitively-discovered imports and chokes on `*.zip?url`. Teach
    // esbuild to treat `.zip` as a file asset (returns a URL string) so the
    // scan never fails, regardless of which package the import lives in.
    esbuildOptions: {
      // `empty` makes the scanner skip the asset's contents and emit nothing.
      // Vite's own asset pipeline still serves the real zip at request time.
      loader: { ".zip": "empty" },
    },
  },
  resolve: {
    // Order matters: more-specific aliases must come before "@".
    alias: [
      // ---- Engine package ----
      // Thin client consumes the published @k-studio-pro/engine package; these
      // explicit aliases mirror master's vite.config.ts so subpath resolution
      // is identical (no reliance on the package exports map).
      { find: /^@k-studio-pro\/engine\/data$/, replacement: engineFile("data/index.ts") },
      { find: /^@k-studio-pro\/engine\/shell$/, replacement: engineFile("shell/index.ts") },
      { find: /^@k-studio-pro\/engine\/vite$/, replacement: engineFile("vite.ts") },
      { find: /^@k-studio-pro\/engine$/, replacement: engineFile("index.ts") },
      // Legacy alias (kept for any straggler imports inside engine internals).
      { find: "@kajabi-studio/engine", replacement: engineFile("index.ts") },
      // Backward-compat: legacy @/blocks, @/engines, @/lib/siteDesign, @/types
      // imports inside the engine package resolve back into the engine source.
      // Trailing slash on the directory replacement is REQUIRED — without it,
      // deep imports like `@/blocks/components/Slider` collapse into
      // `…/blockscomponents/Slider` (path.resolve strips trailing slashes).
      { find: /^@\/blocks(\/.*)?$/, replacement: ENGINE_SRC + "/blocks$1" },
      { find: /^@\/engines(\/.*)?$/, replacement: ENGINE_SRC + "/engines$1" },
      { find: /^@\/lib\/siteDesign(\/.*)?$/, replacement: ENGINE_SRC + "/siteDesign$1" },
      { find: /^@\/types(\/.*)?$/, replacement: ENGINE_SRC + "/types$1" },
      // ---- Thin client ----
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
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
}));
