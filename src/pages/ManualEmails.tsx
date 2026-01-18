import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Ship,
  Upload,
  X,
  PlusCircle,
  Send,
  ArrowLeft,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";

interface ManualEmail {
  id: number;
  created_at: string | null;
  email_content: string;
  agent_type: string;
  vessel_name: string | null;
  imo: string | null;
  port: string | null;
  status: string | null;
  subject: string | null;
  body: string | null;
  pda_link_1: string | null;
  pda_link_2: string | null;
  company_name: string | null;
  contact_name: string | null;
}

export default function ManualEmails() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>("create");
  const [emails, setEmails] = useState<ManualEmail[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<ManualEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterAgentType, setFilterAgentType] = useState<string>("all");

  // Manual email creation state
  const [manualEmailContent, setManualEmailContent] = useState("");
  const [manualAgentType, setManualAgentType] = useState<"OWNERS_AGENT" | "CARGO_AGENT">("CARGO_AGENT");
  const [manualPdfFile, setManualPdfFile] = useState<File | null>(null);
  const [manualSending, setManualSending] = useState(false);
  const [processingEmailId, setProcessingEmailId] = useState<number | null>(null);

  useEffect(() => {
    fetchManualEmails();
  }, [filterAgentType]);

  // Poll for status updates when an email is processing
  useEffect(() => {
    if (!processingEmailId) return;

    const pollInterval = setInterval(async () => {
      const { data, error } = await supabase
        .from("manual_emails")
        .select("*")
        .eq("id", processingEmailId)
        .single();

      if (error) {
        console.error("Polling error:", error);
        return;
      }

      if (data && data.status === "completed") {
        setProcessingEmailId(null);
        setSelectedEmail(data as ManualEmail);
        fetchManualEmails();
        toast({ title: "AI Complete", description: "Email has been processed by AI!" });
      } else if (data && data.status === "error") {
        setProcessingEmailId(null);
        fetchManualEmails();
        toast({ title: "Error", description: "AI processing failed", variant: "destructive" });
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [processingEmailId]);

  async function fetchManualEmails() {
    setLoading(true);

    let query = supabase.from("manual_emails").select("*").order("created_at", { ascending: false });

    if (filterAgentType !== "all") {
      query = query.eq("agent_type", filterAgentType);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setEmails((data as ManualEmail[]) || []);
    }
    setLoading(false);
  }

  async function handleManualSubmit() {
    if (!manualEmailContent.trim()) {
      toast({ title: "Error", description: "Please paste an email message", variant: "destructive" });
      return;
    }

    setManualSending(true);

    try {
      const formData = new FormData();
      formData.append("email_content", manualEmailContent);
      formData.append("agent_type", manualAgentType);

      if (manualPdfFile) {
        formData.append("pdf", manualPdfFile);
      }

      const response = await fetch("https://lbhcuracao.app.n8n.cloud/webhook/MANUAL-EMAIL-CREATION", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Webhook request failed");
      }

      // Get the response to find the new email ID
      const responseData = await response.json().catch(() => null);
      
      toast({ title: "Sent to AI", description: "AI is generating your email..." });
      setManualEmailContent("");
      setManualPdfFile(null);
      // Reset file input
      const fileInput = document.getElementById("manual-pdf-input") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      // Switch to history tab and refresh
      setActiveTab("history");
      await fetchManualEmails();

      // Find the most recent email and start polling
      const { data: latestEmails } = await supabase
        .from("manual_emails")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (latestEmails && latestEmails.length > 0) {
        const latestEmail = latestEmails[0] as ManualEmail;
        setSelectedEmail(latestEmail);
        if (latestEmail.status === "processing" || !latestEmail.status) {
          setProcessingEmailId(latestEmail.id);
        }
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to send email to AI", variant: "destructive" });
    } finally {
      setManualSending(false);
    }
  }

  async function handleDeleteEmail(emailId: number) {
    if (!confirm("Weet je zeker dat je deze email wilt verwijderen?")) return;

    const { error } = await supabase
      .from("manual_emails")
      .delete()
      .eq("id", emailId);

    if (error) {
      toast({ title: "Error", description: "Failed to delete email", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Email has been deleted" });
      setSelectedEmail(null);
      fetchManualEmails();
    }
  }

  const getStatusBadge = (status: string | null) => {
    const styles: Record<string, string> = {
      processing: "bg-amber-500/10 text-amber-600",
      completed: "bg-success/10 text-success",
      error: "bg-destructive/10 text-destructive",
    };
    return styles[status || "processing"] || "bg-muted text-muted-foreground";
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "processing":
        return <Clock className="w-3 h-3" />;
      case "completed":
        return <CheckCircle className="w-3 h-3" />;
      case "error":
        return <XCircle className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  return (
    <DashboardLayout title="Manual Emails">
      <div className="mb-4">
        <Link to="/inquiries">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to AI Inquiries
          </Button>
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="create" className="flex items-center gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" />
            Create New
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            Email History
          </TabsTrigger>
        </TabsList>

        {/* Create New Email Tab */}
        <TabsContent value="create" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Manual Creation Form */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-primary" />
                  Manual Email Creation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Agent Type Selection */}
                <div className="space-y-2">
                  <Label htmlFor="agent-type">Agent Type</Label>
                  <Select
                    value={manualAgentType}
                    onValueChange={(value: "OWNERS_AGENT" | "CARGO_AGENT") => setManualAgentType(value)}
                  >
                    <SelectTrigger id="agent-type">
                      <SelectValue placeholder="Select agent type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CARGO_AGENT">Cargo Agent</SelectItem>
                      <SelectItem value="OWNERS_AGENT">Owners Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Email Content */}
                <div className="space-y-2">
                  <Label htmlFor="email-content">Email Content</Label>
                  <Textarea
                    id="email-content"
                    placeholder="Paste email content here..."
                    value={manualEmailContent}
                    onChange={(e) => setManualEmailContent(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>

                {/* PDF Upload */}
                <div className="space-y-2">
                  <Label htmlFor="manual-pdf-input">PDF Attachment (Optional)</Label>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer flex-1">
                      <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {manualPdfFile ? manualPdfFile.name : "Click to upload PDF"}
                        </span>
                      </div>
                      <input
                        id="manual-pdf-input"
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && file.type === "application/pdf") {
                            setManualPdfFile(file);
                          } else if (file) {
                            toast({
                              title: "Error",
                              description: "Only PDF files are allowed",
                              variant: "destructive",
                            });
                          }
                        }}
                      />
                    </label>
                    {manualPdfFile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setManualPdfFile(null);
                          const fileInput = document.getElementById("manual-pdf-input") as HTMLInputElement;
                          if (fileInput) fileInput.value = "";
                        }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleManualSubmit}
                  disabled={manualSending || !manualEmailContent.trim()}
                >
                  {manualSending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending to AI...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send to AI
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Preview / Instructions */}
            <Card className="card-premium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <h4 className="font-medium">How to use Manual Email Creation:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Select the agent type (Cargo Agent or Owners Agent)</li>
                    <li>Copy and paste the email content into the text area</li>
                    <li>Optionally attach a PDF document</li>
                    <li>Click "Send to Webhook" to process the email</li>
                  </ol>
                </div>

                {manualEmailContent && (
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <div className="p-4 bg-muted/50 rounded-lg border max-h-[300px] overflow-auto">
                      <pre className="whitespace-pre-wrap text-sm">{manualEmailContent}</pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Email History Tab */}
        <TabsContent value="history" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Email List */}
            <Card className="card-premium lg:col-span-1">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Emails ({emails.length})
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={fetchManualEmails}>
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
                <div className="pt-2">
                  <Select value={filterAgentType} onValueChange={setFilterAgentType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="CARGO_AGENT">Cargo Agent</SelectItem>
                      <SelectItem value="OWNERS_AGENT">Owners Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[calc(100vh-340px)]">
                  {loading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : emails.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">No manual emails found</div>
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
                            <p className="text-sm font-medium line-clamp-2">
                              {email.vessel_name || email.subject || "No subject"}
                            </p>
                            <Badge className={`${getStatusBadge(email.status)} text-xs shrink-0 flex items-center gap-1`} variant="secondary">
                              {processingEmailId === email.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                getStatusIcon(email.status)
                              )}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {email.agent_type === "OWNERS_AGENT" ? "Owners" : "Cargo"}
                            </Badge>
                            {email.port && <span className="text-xs text-muted-foreground">{email.port}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {email.created_at ? new Date(email.created_at).toLocaleString("nl-NL") : "Unknown date"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Email Detail */}
            <Card className="card-premium lg:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Email Details</CardTitle>
                  {selectedEmail && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteEmail(selectedEmail.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {selectedEmail ? (
                  <div className="space-y-4">
                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Agent Type</Label>
                        <p className="text-sm font-medium">
                          {selectedEmail.agent_type === "OWNERS_AGENT" ? "Owners Agent" : "Cargo Agent"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <Badge className={`${getStatusBadge(selectedEmail.status)} flex items-center gap-1.5 w-fit`}>
                          {processingEmailId === selectedEmail.id ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              AI Generating...
                            </>
                          ) : (
                            selectedEmail.status || "processing"
                          )}
                        </Badge>
                      </div>
                      {selectedEmail.vessel_name && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Vessel</Label>
                          <p className="text-sm font-medium flex items-center gap-1">
                            <Ship className="w-3 h-3" />
                            {selectedEmail.vessel_name}
                          </p>
                        </div>
                      )}
                      {selectedEmail.imo && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">IMO</Label>
                          <p className="text-sm">{selectedEmail.imo}</p>
                        </div>
                      )}
                      {selectedEmail.port && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Port</Label>
                          <p className="text-sm">{selectedEmail.port}</p>
                        </div>
                      )}
                      {selectedEmail.company_name && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Company</Label>
                          <p className="text-sm">{selectedEmail.company_name}</p>
                        </div>
                      )}
                    </div>

                    {/* PDA Links */}
                    {(selectedEmail.pda_link_1 || selectedEmail.pda_link_2) && (
                      <div className="flex gap-2">
                        {selectedEmail.pda_link_1 && (
                          <a href={selectedEmail.pda_link_1} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="gap-1">
                              <ExternalLink className="w-3 h-3" />
                              PDA Link 1
                            </Button>
                          </a>
                        )}
                        {selectedEmail.pda_link_2 && (
                          <a href={selectedEmail.pda_link_2} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="gap-1">
                              <ExternalLink className="w-3 h-3" />
                              PDA Link 2
                            </Button>
                          </a>
                        )}
                      </div>
                    )}

                    {/* AI Generated Content */}
                    {processingEmailId === selectedEmail.id ? (
                      <div className="space-y-4 p-6 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                        <div className="flex items-center justify-center gap-3">
                          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                          <div className="text-center">
                            <p className="font-medium text-blue-700 dark:text-blue-400">AI is generating your email...</p>
                            <p className="text-sm text-muted-foreground">This may take a few moments</p>
                          </div>
                        </div>
                      </div>
                    ) : selectedEmail.status === "completed" && (selectedEmail.subject || selectedEmail.body) ? (
                      <div className="space-y-4">
                        {selectedEmail.subject && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-green-600" />
                              AI Generated Subject
                            </Label>
                            <div className="p-3 bg-green-50/50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                              <p className="text-sm font-medium">{selectedEmail.subject}</p>
                            </div>
                          </div>
                        )}
                        {selectedEmail.body && (
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1">
                              <CheckCircle className="w-3 h-3 text-green-600" />
                              AI Generated Email Body
                            </Label>
                            <ScrollArea className="h-[250px] border border-green-200 dark:border-green-800 rounded-lg bg-green-50/50 dark:bg-green-950/20">
                              <pre className="p-4 text-sm whitespace-pre-wrap">{selectedEmail.body}</pre>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Original Email Content */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Original Email Content</Label>
                      <ScrollArea className="h-[200px] border rounded-lg">
                        <pre className="p-4 text-sm whitespace-pre-wrap font-mono">{selectedEmail.email_content}</pre>
                      </ScrollArea>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    Select an email to view details
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
