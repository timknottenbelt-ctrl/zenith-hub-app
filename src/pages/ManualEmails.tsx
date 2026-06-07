import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Mail, ArrowLeft, Loader2 } from "lucide-react";
import { TransitionLink } from "@/components/TransitionLink";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useManualEmails } from "@/hooks/useManualEmails";
import type { ManualEmail } from "@/hooks/useManualEmails";
import { ManualEmailCreateForm } from "@/components/manual-emails/ManualEmailCreateForm";
import { ManualEmailList } from "@/components/manual-emails/ManualEmailList";
import { ManualEmailDetail } from "@/components/manual-emails/ManualEmailDetail";

export default function ManualEmails() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "history" ? "history" : "create";
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [filterAgentType, setFilterAgentType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [emailToDelete, setEmailToDelete] = useState<{ id: number; pdfPath: string | null } | null>(null);
  const [waitingForAI, setWaitingForAI] = useState(false);
  const waitingRef = useRef(false);

  const {
    emails,
    setEmails,
    selectedEmail,
    setSelectedEmail,
    loading,
    fetchManualEmails,
  } = useManualEmails(filterAgentType);

  useEffect(() => {
    waitingRef.current = waitingForAI;
  }, [waitingForAI]);

  const prevEmailCountRef = useRef(emails.length);
  useEffect(() => {
    if (waitingRef.current && emails.length > prevEmailCountRef.current) {
      const newest = emails[0];
      if (newest) {
        setSelectedEmail(newest);
        setWaitingForAI(false);
        toast({ title: "Email ontvangen", description: "AI verwerkt uw aanvraag..." });
      }
    }
    prevEmailCountRef.current = emails.length;
  }, [emails, setSelectedEmail]);

  function handleSubmitted() {
    setWaitingForAI(true);
  }

  function openDeleteDialog(emailId: number, pdfPath: string | null) {
    setEmailToDelete({ id: emailId, pdfPath });
    setDeleteDialogOpen(true);
  }

  async function confirmDeleteEmail() {
    if (!emailToDelete) return;

    if (emailToDelete.id < 0) {
      setEmails((prev) => prev.filter((e) => e.id !== emailToDelete.id));
      setSelectedEmail(null);
      toast({ title: "Verwijderd", description: "Concept e-mail is verwijderd" });
      setDeleteDialogOpen(false);
      setEmailToDelete(null);
      return;
    }

    try {
      if (emailToDelete.pdfPath) {
        await supabase.storage.from("pdfs").remove([emailToDelete.pdfPath]);
      }
      const { error } = await supabase.from("manual_emails").delete().eq("id", emailToDelete.id);
      if (error) throw error;

      setEmails((prev) => prev.filter((e) => e.id !== emailToDelete.id));
      setSelectedEmail(null);
      toast({ title: "Verwijderd", description: "E-mail is succesvol verwijderd" });
      await fetchManualEmails({ showLoading: false });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Verwijderen mislukt",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setEmailToDelete(null);
    }
  }

  function handleEmailUpdated(updated: ManualEmail) {
    setEmails((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setSelectedEmail((prev) => (prev?.id === updated.id ? updated : prev));
  }

  return (
    <DashboardLayout title="Handmatige E-mails">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        {/* Header: back link left, Nieuw/Geschiedenis tabs right (same row) */}
        <div className="flex items-center justify-between gap-3">
          <TransitionLink to="/inquiries">
            <Button variant="ghost" size="sm" className="gap-2 rounded-lg text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" />
              Terug naar AI Aanvragen
            </Button>
          </TransitionLink>
          <TabsList className="bg-card/60 backdrop-blur-sm p-1 rounded-xl h-auto inline-flex gap-1"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <TabsTrigger value="create" className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <PlusCircle className="w-3.5 h-3.5" />
              Nieuw
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Mail className="w-3.5 h-3.5" />
              Geschiedenis
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="create" className="mt-5">
          <ManualEmailCreateForm
            onSubmitted={handleSubmitted}
            onSwitchToHistory={() => setActiveTab("history")}
            filterAgentType={filterAgentType}
            setFilterAgentType={setFilterAgentType}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <ManualEmailList
              emails={emails}
              selectedEmail={selectedEmail}
              loading={loading}
              filterAgentType={filterAgentType}
              setFilterAgentType={setFilterAgentType}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              onSelectEmail={setSelectedEmail}
              onRefresh={() => fetchManualEmails({ showLoading: false })}
            />
            {waitingForAI && !selectedEmail ? (
              <Card className="card-premium lg:col-span-2 overflow-hidden">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <CardTitle className="text-sm font-medium">AI verwerkt je aanvraag…</CardTitle>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => setWaitingForAI(false)}>
                    Annuleren
                  </Button>
                </CardHeader>
                <CardContent>
                  {/* Skeleton that mimics the email detail while the AI runs */}
                  <div className="space-y-5 animate-pulse">
                    <div className="space-y-2">
                      <div className="h-5 bg-muted rounded w-2/3" />
                      <div className="flex gap-2">
                        <div className="h-4 bg-muted/70 rounded w-24" />
                        <div className="h-4 bg-muted/70 rounded w-28" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="h-3 bg-muted/60 rounded w-24" />
                        <div className="h-3 bg-muted rounded w-full" />
                        <div className="h-3 bg-muted rounded w-5/6" />
                        <div className="h-3 bg-muted rounded w-4/6" />
                        <div className="h-3 bg-muted rounded w-3/4" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-3 bg-primary/15 rounded w-28" />
                        <div className="h-3 bg-muted rounded w-full" />
                        <div className="h-3 bg-muted rounded w-11/12" />
                        <div className="h-3 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-5/6" />
                      </div>
                    </div>
                    <div className="h-9 bg-muted rounded-lg w-40" />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <ManualEmailDetail
                email={selectedEmail}
                onDelete={openDeleteDialog}
                onEmailUpdated={handleEmailUpdated}
                onRefresh={() => fetchManualEmails({ showLoading: false })}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              Deze actie kan niet ongedaan worden gemaakt. De e-mail en bijbehorende PDF worden permanent verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteEmail}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
