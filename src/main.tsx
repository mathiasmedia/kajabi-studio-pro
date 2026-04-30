/**
 * THIN-CLIENT TEMPLATE — copy this into the thin client's `src/main.tsx`
 * (or update the existing one) when migrating to engine v0.2.0+ (data layer)
 * and v0.3.1+ (shell + verified Pro slider rendering).
 *
 * Two things this file MUST do, in this exact order, BEFORE <App /> renders:
 *
 *   1. Import Swiper's CSS GLOBALLY (before `./index.css`).
 *      The engine's slider (`packages/engine/src/blocks/sections.tsx`
 *      → `renderSlider`) imports Swiper from `swiper/react` but DOES NOT
 *      ship Swiper's stylesheet. Without these imports, `.swiper-wrapper`
 *      has no `display: flex` and `.swiper-slide` has no `flex-shrink: 0`,
 *      so every slide stacks vertically at full width — the classic
 *      "slider stuck at 1-up" / "cards stacking" symptom on migrated thin
 *      clients. Importing them here injects the correct flex layout
 *      globally; importing `./index.css` AFTER lets your design tokens
 *      override anything you want without losing Swiper's flex base.
 *
 *   2. Wire the per-project Supabase client into the engine's data layer
 *      via `setSupabaseClient(supabase)`. MUST run before any data-layer
 *      call (siteStore / imageStore / exportPersistence).
 *
 * After this is in place, every existing import like
 *   import { listSites } from '@/lib/siteStore';
 * keeps working through 1-line re-export shims at src/lib/{siteStore,
 * imageStore, exportPersistence}.ts:
 *   export * from '@k-studio-pro/engine/data';
 */
import { createRoot } from "react-dom/client";
import { setSupabaseClient } from "@k-studio-pro/engine";
import { BASE_THEME_URLS } from "@k-studio-pro/engine/src/engines/baseThemeValidator";
import { supabase } from "@/integrations/supabase/client";
import App from "./App.tsx";

// Override engine's bundled `.zip?url` imports — esbuild's dep-optimizer
// stubs them to "" because it doesn't grok Vite's `?url` suffix. The zips
// are copied into /public/base-theme/ and served by Vite's static handler.
BASE_THEME_URLS["streamlined-home"] = "/base-theme/streamlined-home.zip";
BASE_THEME_URLS["streamlined-home-pro"] = "/base-theme/streamlined-home-pro.zip";
BASE_THEME_URLS["encore-page"] = "/base-theme/encore-page.zip";
BASE_THEME_URLS["encore-page-pro"] = "/base-theme/encore-page-pro.zip";

// Swiper CSS — MUST come before ./index.css so engine sliders get correct
// flex layout (.swiper-wrapper{display:flex} / .swiper-slide{flex-shrink:0})
// while your design tokens still win cascade order.
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/effect-fade";
import "swiper/css/effect-cube";
import "swiper/css/effect-coverflow";
import "swiper/css/effect-flip";

import "./index.css";

// Wire the per-project Supabase client into the engine's data layer.
// MUST run before any data-layer call (siteStore / imageStore / exportPersistence).
setSupabaseClient(supabase);

createRoot(document.getElementById("root")!).render(<App />);
