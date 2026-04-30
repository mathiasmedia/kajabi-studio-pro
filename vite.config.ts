import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Inlined from `@k-studio-pro/engine/vite` because Node refuses to strip TS
// types from files under node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING).
// Engine path helpers — guarantee a trailing slash on directories so deep
// imports like `@/blocks/components/Slider` don't collapse into
// `…/blockscomponents/Slider` (path.resolve strips trailing slashes).
function engineDir(sub) {
  return (
    path.resolve(__dirname, "node_modules/@k-studio-pro/engine/src", sub) + "/"
  );
}
function engineFile(file) {
  return path.resolve(__dirname, "node_modules/@k-studio-pro/engine/src", file);
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
    include: ["jszip"],
  },
  resolve: {
    // Engine-managed aliases MUST come before the catch-all "@".
    alias: [
      // Deep imports — regex AND replacement both end with "/".
      { find: /^@\/blocks\//, replacement: engineDir("blocks") },
      { find: /^@\/engines\//, replacement: engineDir("engines") },
      { find: /^@\/lib\/siteDesign\//, replacement: engineDir("siteDesign") },
      { find: /^@\/types\//, replacement: engineDir("types") },
      // Bare (barrel) imports — point at the index file directly.
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
