import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// ──────────────────────────────────────────────────────────────────────
// Inlined from `@k-studio-pro/engine/vite`.
//
// We can't `import { … } from "@k-studio-pro/engine/vite"` here because
// the dev harness loads `vite.config.ts` via Node's native loader, and
// Node refuses to strip TypeScript types from files inside `node_modules`
// (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING). The engine ships its
// vite helpers as raw `.ts`, so we mirror them here. Behaviour is
// identical — keep this in sync if the engine helper ever changes
// meaningfully.
// ──────────────────────────────────────────────────────────────────────

function engineDir(projectRoot: string, sub: string): string {
  return (
    path.resolve(projectRoot, "node_modules/@k-studio-pro/engine/src", sub) +
    "/"
  );
}

function engineFile(projectRoot: string, file: string): string {
  return path.resolve(
    projectRoot,
    "node_modules/@k-studio-pro/engine/src",
    file,
  );
}

function viteEngineAliases(projectRoot: string) {
  return [
    { find: /^@\/blocks\//, replacement: engineDir(projectRoot, "blocks") },
    { find: /^@\/engines\//, replacement: engineDir(projectRoot, "engines") },
    {
      find: /^@\/lib\/siteDesign\//,
      replacement: engineDir(projectRoot, "siteDesign"),
    },
    { find: /^@\/types\//, replacement: engineDir(projectRoot, "types") },
    {
      find: /^@\/blocks$/,
      replacement: engineFile(projectRoot, "blocks/index.ts"),
    },
    {
      find: /^@\/engines$/,
      replacement: engineFile(projectRoot, "engines/index.ts"),
    },
    {
      find: /^@\/lib\/siteDesign$/,
      replacement: engineFile(projectRoot, "siteDesign/index.ts"),
    },
  ];
}

function viteEngineZipPlugin(): Plugin {
  const PREFIX = "\0engine-zip-url:";
  return {
    name: "k-studio-engine-zip-url",
    enforce: "pre",
    async resolveId(source, importer) {
      if (!source.endsWith(".zip?url")) return null;
      const withoutQuery = source.slice(0, -"?url".length);
      let absPath: string;
      if (path.isAbsolute(withoutQuery)) {
        absPath = withoutQuery;
      } else if (importer) {
        absPath = path.resolve(path.dirname(importer), withoutQuery);
      } else {
        return null;
      }
      if (!fs.existsSync(absPath)) return null;
      return PREFIX + absPath;
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return null;
      const absPath = id.slice(PREFIX.length);
      return `export { default } from ${JSON.stringify(absPath + "?url")};`;
    },
  };
}

// ──────────────────────────────────────────────────────────────────────

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
  },
  plugins: [
    react(),
    viteEngineZipPlugin(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: [
      ...viteEngineAliases(__dirname),
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react-dom/client",
      "react-router-dom",
      "@tanstack/react-query",
      "@tanstack/query-core",
      "swiper",
      "@k-studio-pro/engine",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react/jsx-runtime",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
    ],
    // esbuild's dep-scan walks the engine package and chokes on its
    // `*.zip?url` imports because esbuild has no built-in `.zip` loader.
    // Stub them out at scan time — Vite's main pipeline (via
    // viteEngineZipPlugin above) handles the real resolution at request
    // time, so the stub is never actually executed at runtime.
    esbuildOptions: {
      loader: { ".zip": "empty" },
      plugins: [
        {
          name: "k-studio-engine-zip-url-esbuild",
          setup(build) {
            build.onResolve({ filter: /\.zip\?url$/ }, (args) => ({
              path: args.path,
              namespace: "engine-zip-url-stub",
              external: false,
            }));
            build.onLoad(
              { filter: /.*/, namespace: "engine-zip-url-stub" },
              () => ({ contents: 'export default "";', loader: "js" }),
            );
          },
        },
      ],
    },
  },
}));
