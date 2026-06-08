import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Suspense, lazy, useEffect } from "react";

const Overview = lazy(() => import("./pages/Overview"));
const AIInquiries = lazy(() => import("./pages/AIInquiries"));
const ManualEmails = lazy(() => import("./pages/ManualEmails"));
const SentPDAs = lazy(() => import("./pages/SentPDAs"));
const FDACreator = lazy(() => import("./pages/FDACreator"));
const FDACuracao = lazy(() => import("./pages/FDACuracao"));
const FDAEmailHistory = lazy(() => import("./pages/FDAEmailHistory"));
const FDACuracaoHistory = lazy(() => import("./pages/FDACuracaoHistory"));
const FDAEmailPreview = lazy(() => import("./pages/FDAEmailPreview"));
const FDACuracaoEmail = lazy(() => import("./pages/FDACuracaoEmail"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));

const Contacts = lazy(() => import("./pages/Contacts"));
const Settings = lazy(() => import("./pages/Settings"));
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NotFound = lazy(() => import("./pages/NotFound"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const PDACreator = lazy(() => import("./pages/PDACreator"));
const DACreator = lazy(() => import("./pages/DACreator"));
const PortCalls = lazy(() => import("./pages/PortCalls"));
const PortCallDetail = lazy(() => import("./pages/PortCallDetail"));

// Warm ALL route chunks shortly after first load so subsequent navigation is
// instant (no chunk fetch, no Suspense flash). Vite dedupes already-loaded ones.
function preloadAllRoutes() {
  void import("./pages/Overview"); void import("./pages/AIInquiries");
  void import("./pages/ManualEmails"); void import("./pages/SentPDAs");
  void import("./pages/FDACreator"); void import("./pages/FDACuracao");
  void import("./pages/FDAEmailHistory"); void import("./pages/FDACuracaoHistory");
  void import("./pages/FDAEmailPreview"); void import("./pages/FDACuracaoEmail");
  void import("./pages/KnowledgeBase"); void import("./pages/Contacts");
  void import("./pages/Settings"); void import("./pages/UserManagement");
  void import("./pages/PDACreator"); void import("./pages/DACreator");
  void import("./pages/PortCalls"); void import("./pages/PortCallDetail");
  void import("./pages/NotFound");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => void };
    if (w.requestIdleCallback) w.requestIdleCallback(preloadAllRoutes);
    else setTimeout(preloadAllRoutes, 1200);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  <Route path="/auth" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><Auth /></Suspense>} />
                  <Route path="/forgot-password" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><ForgotPassword /></Suspense>} />
                  <Route path="/reset-password" element={<Suspense fallback={<div className="min-h-screen bg-background" />}><ResetPassword /></Suspense>} />
                  <Route path="/" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
                  <Route path="/inquiries" element={<ProtectedRoute><AIInquiries /></ProtectedRoute>} />
                  <Route path="/inquiries/manual" element={<ProtectedRoute><ManualEmails /></ProtectedRoute>} />
                  <Route path="/inquiries/sent" element={<ProtectedRoute><SentPDAs /></ProtectedRoute>} />
                  <Route path="/port-calls" element={<ProtectedRoute><Suspense fallback={<div className="min-h-screen bg-background" />}><PortCalls /></Suspense></ProtectedRoute>} />
                  <Route path="/port-calls/:key" element={<ProtectedRoute><Suspense fallback={<div className="min-h-screen bg-background" />}><PortCallDetail /></Suspense></ProtectedRoute>} />
                  <Route path="/pda-admin" element={<ProtectedRoute><PDACreator /></ProtectedRoute>} />
                  <Route path="/da-creator" element={<ProtectedRoute><DACreator /></ProtectedRoute>} />
                  <Route path="/fda" element={<ProtectedRoute><FDACreator /></ProtectedRoute>} />
                  <Route path="/fda-curacao" element={<ProtectedRoute><FDACuracao /></ProtectedRoute>} />
                  <Route path="/fda-curacao/history" element={<ProtectedRoute><FDACuracaoHistory /></ProtectedRoute>} />
                  <Route path="/fda-curacao/email/:projectId" element={<ProtectedRoute><FDACuracaoEmail /></ProtectedRoute>} />
                  <Route path="/fda/history" element={<ProtectedRoute><FDAEmailHistory /></ProtectedRoute>} />
                  <Route path="/fda/email/:projectId" element={<ProtectedRoute><FDAEmailPreview /></ProtectedRoute>} />
                  <Route path="/knowledge" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
                  
                  <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/admin/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
                  <Route path="*" element={<Suspense fallback={null}><NotFound /></Suspense>} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

