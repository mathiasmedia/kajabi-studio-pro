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
        // importer may carry a query / null-byte prefix — strip both.
        const cleanImporter = importer.split("?")[0].replace(/^\0/, "");
        absPath = path.resolve(path.dirname(cleanImporter), withoutQuery);
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
    config(cfg) {
      const esbuildPlugin = {
        name: "k-studio-engine-zip-url-esbuild",
        setup(build: {
          onResolve: (
            opts: { filter: RegExp },
            cb: (args: { path: string; importer: string }) => unknown,
          ) => void;
          onLoad: (
            opts: { filter: RegExp; namespace: string },
            cb: (args: { path: string }) => unknown,
          ) => void;
        }) {
          const NS = "k-engine-zip";

          build.onResolve({ filter: /\.zip\?url$/ }, (args) => {
            const withoutQuery = args.path.slice(0, -"?url".length);
            let absPath: string;
            if (path.isAbsolute(withoutQuery)) {
              absPath = withoutQuery;
            } else if (args.importer) {
              absPath = path.resolve(path.dirname(args.importer), withoutQuery);
            } else {
              return null;
            }
            if (!fs.existsSync(absPath)) return null;
            return { path: absPath, namespace: NS };
          });

          build.onLoad({ filter: /.*/, namespace: NS }, (args) => {
            const importPath = args.path + "?url";
            return {
              contents: `export { default } from ${JSON.stringify(importPath)};`,
              loader: "js",
              resolveDir: path.dirname(args.path),
            };
          });
        },
      };

      return {
        optimizeDeps: {
          esbuildOptions: {
            plugins: [
              ...(cfg.optimizeDeps?.esbuildOptions?.plugins ?? []),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              esbuildPlugin as any,
            ],
          },
        },
      };
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
  },
}));
