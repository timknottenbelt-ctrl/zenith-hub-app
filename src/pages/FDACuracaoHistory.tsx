import { useState, useEffect } from "react";
import { useTransitionNavigate } from "@/hooks/useTransitionNavigate";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Mail,
  CheckCircle,
  Clock,
  Loader2,
  Ship,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  Download,
  Eye,
  Paperclip,
  User,
  Calendar,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface FDAEmailDraft {
  id: string;
  project_id: string;
  email_to: string;
  email_cc: string | null;
  email_subject: string;
  email_body: string;
  attachment_name: string | null;
  attachment_url: string | null;
  drive_folder_url: string | null;
  google_sheet_url: string | null;
  status: string | null;
  sent_at: string | null;
  created_at: string | null;
  ship_name: string | null;
  lbh_number: string | null;
}

const SUPABASE_URL = "https://oxkshjaombffbdemqrqb.supabase.co";

function getAttachmentDownloadUrl(attachmentUrl: string | null): string {
  if (!attachmentUrl) return "";
  
  if (attachmentUrl.startsWith("http://") || attachmentUrl.startsWith("https://")) {
    return attachmentUrl;
  }
  
  if (attachmentUrl.includes("fda-invoices/") || attachmentUrl.includes("fda-final-packages/")) {
    return `${SUPABASE_URL}/storage/v1/object/public/${attachmentUrl}`;
  }
  
  return attachmentUrl;
}

export default function FDACuracaoHistory() {
  const navigate = useTransitionNavigate();
  const [emails, setEmails] = useState<FDAEmailDraft[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<FDAEmailDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetchEmails();
  }, []);

  async function fetchEmails() {
    setLoading(true);
    
    // Fetch email drafts for FDA Curacao projects only
    // We identify Curacao emails by checking if the project exists in fda_curacao_projects
    const { data: curacaoProjects } = await supabase
      .from("fda_curacao_projects")
      .select("project_id");
    
    const curacaoProjectIds = (curacaoProjects || []).map(p => p.project_id);
    
    if (curacaoProjectIds.length === 0) {
      setEmails([]);
      setLoading(false);
      return;
    }

    const { data: emailData, error: emailError } = await supabase
      .from("fda_email_drafts")
      .select("*")
      .in("project_id", curacaoProjectIds)
      .order("created_at", { ascending: false });

    if (emailError) {
      toast({ title: "Error", description: emailError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    setEmails(emailData || []);
    setLoading(false);
  }

  const handleCopyEmail = async () => {
    if (!selectedEmail?.email_body) return;
    const textToCopy = `Subject: ${selectedEmail.email_subject}\n\n${selectedEmail.email_body}`;
    
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Gekopieerd", description: "Email gekopieerd naar klembord" });
  };

  return (
    <DashboardLayout title="FDA Curacao Email History">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/fda-curacao")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">FDA Curacao Email History</h1>
            <p className="text-muted-foreground">Bekijk alle verzonden FDA Curacao emails</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Email List */}
          <Card className="card-premium lg:col-span-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Emails ({emails.length})
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchEmails}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100vh-280px)]">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : emails.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nog geen FDA Curacao emails verstuurd</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {emails.map((email) => (
                      <div
                        key={email.id}
                        onClick={() => setSelectedEmail(email)}
                        className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedEmail?.id === email.id ? "bg-primary/5 border-l-2 border-primary" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium line-clamp-1">
                            {email.ship_name || "Unknown Ship"}
                          </p>
                          {email.sent_at ? (
                            <Badge className="bg-success/10 text-success border-success/20 text-xs shrink-0" variant="outline">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Sent
                            </Badge>
                          ) : (
                            <Badge className="text-xs shrink-0" variant="outline">
                              <Clock className="w-3 h-3 mr-1" />
                              Draft
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {email.lbh_number || "N/A"}
                          </Badge>
                          <Mail className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1 italic">
                          {email.email_subject}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {email.created_at 
                            ? new Date(email.created_at).toLocaleString("nl-NL", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Unknown date"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Email Details */}
          <Card className="card-premium lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Email Details</CardTitle>
            </CardHeader>
            <CardContent>
              {selectedEmail ? (
                <div className="space-y-4">
                  {/* Header Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Ship</Label>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Ship className="w-3 h-3" />
                        {selectedEmail.ship_name || "Unknown"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Status</Label>
                      {selectedEmail.sent_at ? (
                        <Badge className="bg-success/10 text-success border-success/20" variant="outline">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Sent
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <Clock className="w-3 h-3 mr-1" />
                          Draft
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">LBH Number</Label>
                      <p className="text-sm">{selectedEmail.lbh_number || "N/A"}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Sent At</Label>
                      <p className="text-sm flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {selectedEmail.sent_at 
                          ? new Date(selectedEmail.sent_at).toLocaleString("nl-NL")
                          : selectedEmail.created_at 
                            ? new Date(selectedEmail.created_at).toLocaleString("nl-NL")
                            : "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">To</Label>
                      <p className="text-sm flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {selectedEmail.email_to}
                      </p>
                    </div>
                    {selectedEmail.email_cc && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">CC</Label>
                        <p className="text-sm">{selectedEmail.email_cc}</p>
                      </div>
                    )}
                  </div>

                  {/* Links Section */}
                  <div className="flex flex-wrap gap-2">
                    {selectedEmail.drive_folder_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => window.open(selectedEmail.drive_folder_url!, "_blank")}
                      >
                        <FolderOpen className="w-3 h-3" />
                        Drive Folder
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    )}
                    {selectedEmail.attachment_url && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setPreviewOpen(true)}
                        >
                          <Eye className="w-3 h-3" />
                          Preview PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => window.open(getAttachmentDownloadUrl(selectedEmail.attachment_url), "_blank")}
                        >
                          <Download className="w-3 h-3" />
                          Download
                        </Button>
                      </>
                    )}
                    {selectedEmail.attachment_name && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Paperclip className="w-3 h-3" />
                        {selectedEmail.attachment_name}
                      </span>
                    )}
                  </div>

                  {/* Email Content */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Email Content</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyEmail}
                        className="h-7 gap-1.5 text-xs"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-green-500" />
                            Gekopieerd
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Kopieer
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-primary/5 px-4 py-3 border-b">
                        <p className="text-xs text-muted-foreground">Subject:</p>
                        <p className="font-medium">{selectedEmail.email_subject}</p>
                      </div>
                      <div className="p-4 bg-background">
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                          {selectedEmail.email_body}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Selecteer een email om details te bekijken</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PDF Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>PDF Preview</DialogTitle>
            <DialogDescription>
              {selectedEmail?.attachment_name}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 h-full">
            {selectedEmail?.attachment_url ? (
              <iframe
                src={getAttachmentDownloadUrl(selectedEmail.attachment_url)}
                className="w-full h-full min-h-[60vh] rounded-lg border"
                title="PDF Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No PDF available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
