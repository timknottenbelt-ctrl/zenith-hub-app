import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Suspense, lazy } from "react";

const Overview = lazy(() => import("./pages/Overview"));
const AIInquiries = lazy(() => import("./pages/AIInquiries"));
const ManualEmails = lazy(() => import("./pages/ManualEmails"));
const FDACreator = lazy(() => import("./pages/FDACreator"));
const FDAPreview = lazy(() => import("./pages/FDAPreview"));
const FDAFrontPage = lazy(() => import("./pages/FDAFrontPage"));
const FDAEmailPreview = lazy(() => import("./pages/FDAEmailPreview"));
const KnowledgeBase = lazy(() => import("./pages/KnowledgeBase"));
const Vessels = lazy(() => import("./pages/Vessels"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Settings = lazy(() => import("./pages/Settings"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Suspense fallback={<div className="min-h-screen bg-background" />}>
              <BrowserRouter>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
                  <Route path="/inquiries" element={<ProtectedRoute><AIInquiries /></ProtectedRoute>} />
                  <Route path="/inquiries/manual" element={<ProtectedRoute><ManualEmails /></ProtectedRoute>} />
                  <Route path="/fda" element={<ProtectedRoute><FDACreator /></ProtectedRoute>} />
                  <Route path="/fda-preview/:projectId" element={<ProtectedRoute><FDAPreview /></ProtectedRoute>} />
                  <Route path="/fda-front-page/:projectId" element={<ProtectedRoute><FDAFrontPage /></ProtectedRoute>} />
                  <Route path="/fda/email/:projectId" element={<ProtectedRoute><FDAEmailPreview /></ProtectedRoute>} />
                  <Route path="/knowledge" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
                  <Route path="/vessels" element={<ProtectedRoute><Vessels /></ProtectedRoute>} />
                  <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </Suspense>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;

