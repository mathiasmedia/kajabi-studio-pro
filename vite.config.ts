import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

const ENGINE_SRC = path.resolve(__dirname, "node_modules/@k-studio-pro/engine/src");

function engineDir(subdir: string): string {
  return `${path.resolve(ENGINE_SRC, subdir)}/`;
}

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
  // Treat .zip files as static assets so the engine's `?url` imports of
  // bundled base-theme zips resolve to fetchable URLs.
  assetsInclude: ["**/*.zip"],
  optimizeDeps: {
    include: ["jszip"],
    // The engine ships raw TS source and subpath exports from node_modules.
    // Exclude every imported subpath from dep optimization so Vite handles the
    // package directly instead of asking esbuild to pre-bundle .zip?url assets.
    exclude: [
      "@k-studio-pro/engine",
      "@k-studio-pro/engine/data",
      "@k-studio-pro/engine/shell",
      "@k-studio-pro/engine/vite",
    ],
  },
  resolve: {
    // Order matters: more-specific aliases must come before "@".
    alias: [
      { find: /^@kajabi-studio\/engine$/, replacement: engineFile("index.ts") },
      // Engine internals still use legacy @/blocks, @/engines, @/lib/siteDesign,
      // and @/types imports. These aliases must point into the engine package,
      // but the package entrypoints themselves should resolve normally so the
      // optimizeDeps excludes above can prevent esbuild zip-loader crashes.
      { find: /^@\/blocks\//, replacement: engineDir("blocks") },
      { find: /^@\/engines\//, replacement: engineDir("engines") },
      { find: /^@\/lib\/siteDesign\//, replacement: engineDir("siteDesign") },
      { find: /^@\/types\//, replacement: engineDir("types") },
      { find: /^@\/blocks$/, replacement: engineFile("blocks/index.ts") },
      { find: /^@\/engines$/, replacement: engineFile("engines/index.ts") },
      { find: /^@\/lib\/siteDesign$/, replacement: engineFile("siteDesign/index.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
      "swiper",
    ],
  },
}));
