import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Overview from "./pages/Overview";
import AIInquiries from "./pages/AIInquiries";
import FDACreator from "./pages/FDACreator";
import KnowledgeBase from "./pages/KnowledgeBase";
import Vessels from "./pages/Vessels";
import Contacts from "./pages/Contacts";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
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
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
