import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import Overview from "./pages/Overview";
import AIInquiries from "./pages/AIInquiries";
import FDACreator from "./pages/FDACreator";
import KnowledgeBase from "./pages/KnowledgeBase";
import Vessels from "./pages/Vessels";
import Contacts from "./pages/Contacts";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function MissingSupabaseConfig() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Database niet geconfigureerd</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Ik kan je database-gegevens niet laden omdat de URL / anon key niet in de
            frontend beschikbaar is.
          </p>
          <p>
            Controleer in Project → Secrets of je <code>VITE_SUPABASE_URL</code> en
            <code> VITE_SUPABASE_ANON_KEY</code> hebt gezet (of <code>SUPABASE_URL</code> /
            <code> SUPABASE_ANON_KEY</code>).
          </p>
          <p>
            Open je browser-console: daar log ik welke env keys wel/niet aanwezig zijn.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const App = () => {
  const env = import.meta.env as Record<string, string | undefined>;
  const supabaseUrl = env.VITE_SUPABASE_URL ?? env.SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY ?? env.SUPABASE_ANON_KEY;
  const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {hasSupabase ? (
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
          ) : (
            <MissingSupabaseConfig />
          )}
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;

