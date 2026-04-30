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
    force: true,
    include: ["react", "react/jsx-runtime", "react-dom", "react-dom/client", "react-router-dom", "jszip"],
    exclude: ["@k-studio-pro/engine"],
    esbuildOptions: {
      loader: {
        ".zip": "empty",
      },
    },
  },

  resolve: {
    // Order matters: more-specific aliases MUST come before the "@" catch-all.
    alias: [
      // Force AuthProvider/useAuth to resolve to the exact source module used by engine pages
      { find: /^@engine-auth$/, replacement: engineFile("shell/hooks/useAuth.tsx") },

      // Engine package subpaths + bare entry
      { find: /^@k-studio-pro\/engine\/data$/, replacement: engineFile("data/index.ts") },
      { find: /^@k-studio-pro\/engine\/shell$/, replacement: engineFile("shell/index.ts") },
      { find: /^@k-studio-pro\/engine\/vite$/, replacement: engineFile("vite.ts") },
      { find: /^@k-studio-pro\/engine$/, replacement: engineFile("index.ts") },

      // Legacy engine self-import
      { find: "@kajabi-studio/engine", replacement: engineFile("index.ts") },

      // Legacy @/blocks, @/engines, @/lib/siteDesign, @/types deep + barrel imports
      { find: /^@\/blocks\//, replacement: engineDir("blocks") },
      { find: /^@\/engines\//, replacement: engineDir("engines") },
      { find: /^@\/lib\/siteDesign\//, replacement: engineDir("siteDesign") },
      { find: /^@\/types\//, replacement: engineDir("types") },
      { find: /^@\/blocks$/, replacement: engineFile("blocks/index.ts") },
      { find: /^@\/engines$/, replacement: engineFile("engines/index.ts") },
      { find: /^@\/lib\/siteDesign$/, replacement: engineFile("siteDesign/index.ts") },

      // Thin-client catch-all — MUST be last
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
    ],
  },
}));
