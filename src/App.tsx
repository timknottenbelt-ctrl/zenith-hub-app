import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Suspense, lazy } from "react";

const Overview = lazy(() => import("./pages/Overview"));
const AIInquiries = lazy(() => import("./pages/AIInquiries"));
const FDACreator = lazy(() => import("./pages/FDACreator"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const Vessels = lazy(() => import("./pages/Vessels"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

function MissingSupabaseConfig() {
  const hasUrl = Boolean(import.meta.env.VITE_SUPABASE_URL);
  const hasKey = Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Supabase not configured</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Your frontend build does not currently have the required Vite env vars
            inlined.
          </p>
          <div className="rounded-md border p-3 text-xs">
            <div>VITE_SUPABASE_URL: {String(hasUrl)}</div>
            <div>VITE_SUPABASE_ANON_KEY: {String(hasKey)}</div>
          </div>
          <p>
            Fix: ensure Project → Secrets contains <code>VITE_SUPABASE_URL</code> and
            <code> VITE_SUPABASE_ANON_KEY</code>, then trigger a full rebuild/redeploy
            of the preview (a normal refresh is not enough).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const App = () => {
  const hasSupabase = Boolean(
    import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  // Temporary boolean-only log for debugging env injection
  console.info("[app] env check", {
    VITE_SUPABASE_URL: Boolean(import.meta.env.VITE_SUPABASE_URL),
    VITE_SUPABASE_ANON_KEY: Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY),
  });

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {hasSupabase ? (
            <Suspense fallback={null}>
              <BrowserRouter>
                <Routes>
                  <Route path="/" element={<Overview />} />
                  <Route path="/inquiries" element={<AIInquiries />} />
                  <Route path="/fda" element={<FDACreator />} />
                  <Route path="/knowledge" element={<KnowledgeBase />} />
                  <Route path="/vessels" element={<Vessels />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </Suspense>
          ) : (
            <MissingSupabaseConfig />
          )}
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;

