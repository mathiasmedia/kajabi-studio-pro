import { createRoot } from "react-dom/client";
import { setSupabaseClient } from "@k-studio-pro/engine/data";
import { supabase } from "@/integrations/supabase/client";
import App from "./App.tsx";
import "./index.css";

// Wire this project's Supabase client into the engine BEFORE rendering so
// engine data-layer calls (siteStore, imageStore, etc.) hit the right project.
setSupabaseClient(supabase);

createRoot(document.getElementById("root")!).render(<App />);
