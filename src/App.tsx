/**
 * App routes — based on thin-client-templates/App.tsx from master.
 *
 * 🚨 IMPORT RULE: AuthProvider AND RequireAuth MUST come from the same
 * engine entry (`@k-studio-pro/engine/shell`) on a single import line.
 * Importing them from different paths fragments the React context across
 * Vite dep-optimizer chunks and produces:
 *   "useAuth must be used within an AuthProvider"
 * See thin-client-templates/App.tsx in master for the full explanation.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, RequireAuth } from "@k-studio-pro/engine/shell";
import Index from "./pages/Index.tsx";
import SiteEditor from "./pages/SiteEditor.tsx";
import Auth from "./pages/Auth.tsx";
import ResetPassword from "./pages/ResetPassword.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <Index />
                </RequireAuth>
              }
            />
            {/* Legacy /landing-pages → unified workspace at "/" */}
            <Route path="/landing-pages" element={<Navigate to="/" replace />} />
            <Route
              path="/sites/:siteId"
              element={
                <RequireAuth>
                  <SiteEditor />
                </RequireAuth>
              }
            />
            {/* /admin route is master-only; thin clients redirect to dashboard */}
            <Route path="/admin" element={<Navigate to="/" replace />} />
            <Route path="/admin/users" element={<Navigate to="/" replace />} />
            {/* Legacy /export route → bounce to dashboard */}
            <Route path="/export" element={<Navigate to="/" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
