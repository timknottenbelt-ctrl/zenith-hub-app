import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
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

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
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
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;

