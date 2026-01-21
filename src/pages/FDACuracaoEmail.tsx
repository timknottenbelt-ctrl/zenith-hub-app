import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ArrowLeft,
  Mail,
  Plus,
  X,
  FileText,
  Download,
  Eye,
  Loader2,
  Send,
  Upload,
  Trash2,
  Paperclip,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface FDACuracaoProject {
  project_id: string;
  lbh_number: string;
  ship_name: string;
  client_email: string | null;
  client_name: string | null;
  billing_email: string | null;
  email_subject: string | null;
  email_body: string | null;
  final_pdf_url: string | null;
  fda_responsible: string | null;
  total_invoices: number | null;
  total_amount: number | null;
  google_sheet_url: string | null;
  status: string | null;
}

interface FDAEmailDraft {
  id: string;
  project_id: string;
  email_to: string;
  email_cc: string | null;
  email_subject: string;
  email_body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  status: string | null;
  google_sheet_url: string | null;
  drive_folder_url: string | null;
}

interface ExtraAttachment {
  id: string;
  name: string;
  url: string;
}

const SEND_WEBHOOK_URL = "https://lbhcuracao.app.n8n.cloud/webhook/send-fda-curacao";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPABASE_URL = "https://oxkshjaombffbdemqrqb.supabase.co";

// Convert storage path to downloadable URL
function getPublicPdfUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  if (url.startsWith("/object/sign/")) {
    return encodeURI(`${SUPABASE_URL}/storage/v1${url}`);
  }
  if (url.includes("fda-final-packages/") || url.includes("fda-curacao/")) {
    return encodeURI(`${SUPABASE_URL}/storage/v1/object/public/${url}`);
  }
  return url;
}

export default function FDACuracaoEmail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<FDACuracaoProject | null>(null);
  const [emailDraft, setEmailDraft] = useState<FDAEmailDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Email form state
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [newToEmail, setNewToEmail] = useState("");
  const [newCcEmail, setNewCcEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [extraAttachments, setExtraAttachments] = useState<ExtraAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);

  // Polling refs
  const emailDraftRef = useRef<FDAEmailDraft | null>(null);
  const projectRef = useRef<FDACuracaoProject | null>(null);

  useEffect(() => {
    emailDraftRef.current = emailDraft;
  }, [emailDraft]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const fetchProjectAndDraft = useCallback(async () => {
    if (!projectId) return;

    // Fetch project data from fda_curacao_projects
    const { data: projectData, error: projectError } = await supabase
      .from("fda_curacao_projects")
      .select("*")
      .eq("project_id", projectId)
      .single();

    if (projectError) {
      console.error("Error fetching project:", projectError);
      toast({ title: "Error", description: "Project not found", variant: "destructive" });
      navigate("/fda-curacao");
      return;
    }

    setProject(projectData);

    // Fetch email draft from fda_email_drafts (created by n8n)
    const { data: draftData, error: draftError } = await supabase
      .from("fda_email_drafts")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draftData && !draftError && draftData.status === "draft") {
      // Use draft data from n8n
      setEmailDraft(draftData);

      // Parse TO emails
      const toList = draftData.email_to
        .split(",")
        .map((e: string) => e.trim())
        .filter((e: string) => e);
      setToEmails(toList);

      // Parse CC emails
      if (draftData.email_cc) {
        const ccList = draftData.email_cc
          .split(",")
          .map((e: string) => e.trim())
          .filter((e: string) => e);
        setCcEmails(ccList);
      }

      setSubject(draftData.email_subject);
      setBody(draftData.email_body);
    }
  }, [projectId, navigate]);

  // Initial load and polling
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      try {
        await fetchProjectAndDraft();
      } catch (error) {
        console.error("FDACuracaoEmail load error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    // Poll for draft (status = "draft") + Google Sheet URL
    let tries = 0;
    const maxTries = 60; // ~3 min

    const interval = setInterval(async () => {
      if (!projectId) return;
      tries += 1;

      // 1) Poll email draft until status = "draft"
      if (!emailDraftRef.current || emailDraftRef.current.status !== "draft") {
        const { data: draftData } = await supabase
          .from("fda_email_drafts")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (draftData && draftData.status === "draft") {
          setEmailDraft(draftData);

          const toList = (draftData.email_to || "")
            .split(",")
            .map((e: string) => e.trim())
            .filter(Boolean);
          setToEmails(toList);

          const ccList = (draftData.email_cc || "")
            .split(",")
            .map((e: string) => e.trim())
            .filter(Boolean);
          setCcEmails(ccList);

          setSubject(draftData.email_subject || "");
          setBody(draftData.email_body || "");
        }
      }

      // 2) Poll project for google_sheet_url
      const currentProject = projectRef.current;
      if (!currentProject?.google_sheet_url) {
        const { data } = await supabase
          .from("fda_curacao_projects")
          .select("google_sheet_url, final_pdf_url, status")
          .eq("project_id", projectId)
          .single();

        if (data) {
          setProject((prev) =>
            prev
              ? {
                  ...prev,
                  google_sheet_url: data.google_sheet_url,
                  final_pdf_url: data.final_pdf_url,
                  status: data.status,
                }
              : null
          );
        }
      }

      // Stop polling when we have draft with status "draft"
      const nowHasDraft = emailDraftRef.current?.status === "draft";
      if (nowHasDraft || tries > maxTries) {
        clearInterval(interval);
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchProjectAndDraft, projectId]);

  // Email validation
  function isValidEmail(email: string): boolean {
    return EMAIL_REGEX.test(email.trim());
  }

  function addToEmail() {
    const email = newToEmail.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (toEmails.includes(email)) {
      toast({ title: "Duplicate", description: "This email is already added", variant: "destructive" });
      return;
    }
    setToEmails([...toEmails, email]);
    setNewToEmail("");
  }

  function removeToEmail(index: number) {
    setToEmails(toEmails.filter((_, i) => i !== index));
  }

  function addCcEmail() {
    const email = newCcEmail.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (ccEmails.includes(email)) {
      toast({ title: "Duplicate", description: "This email is already added", variant: "destructive" });
      return;
    }
    setCcEmails([...ccEmails, email]);
    setNewCcEmail("");
  }

  function removeCcEmail(index: number) {
    setCcEmails(ccEmails.filter((_, i) => i !== index));
  }

  function handleToKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addToEmail();
    }
  }

  function handleCcKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addCcEmail();
    }
  }

  async function handleUploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Error", description: "File must be less than 10MB", variant: "destructive" });
      return;
    }

    setUploadingAttachment(true);

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${projectId}/extra/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("fda-attachments").upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = await supabase.storage
        .from("fda-attachments")
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (!urlData?.signedUrl) throw new Error("Failed to get URL");

      setExtraAttachments([...extraAttachments, { id: fileName, name: file.name, url: urlData.signedUrl }]);

      toast({ title: "Success", description: "Attachment uploaded" });
    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: "Error", description: "Failed to upload attachment", variant: "destructive" });
    } finally {
      setUploadingAttachment(false);
      e.target.value = "";
    }
  }

  function removeAttachment(id: string) {
    setExtraAttachments(extraAttachments.filter((a) => a.id !== id));
  }

  async function handleSendEmail() {
    if (toEmails.length === 0) {
      toast({ title: "Error", description: "Please add at least one recipient", variant: "destructive" });
      return;
    }

    if (!subject.trim()) {
      toast({ title: "Error", description: "Please enter a subject", variant: "destructive" });
      return;
    }

    if (!body.trim()) {
      toast({ title: "Error", description: "Please enter email body", variant: "destructive" });
      return;
    }

    setSending(true);

    try {
      const payload = {
        project_id: projectId,
        email_to: toEmails.join(","),
        email_cc: ccEmails.join(","),
        email_subject: subject,
        email_body: body,
        attachment_url: emailDraft?.attachment_url || project?.final_pdf_url || "",
        extra_attachments: extraAttachments.map((a) => a.url),
      };

      const response = await fetch(SEND_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Send failed: ${response.status}`);
      }

      toast({ title: "Success!", description: "Email sent successfully!" });
      navigate("/fda-curacao");
    } catch (error) {
      console.error("Send error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  function getMainPdfUrl(): string | null {
    if (emailDraft?.attachment_url) {
      return emailDraft.attachment_url;
    }
    return project?.final_pdf_url || null;
  }

  function getFilenameFromUrl(url: string | null): string {
    if (emailDraft?.attachment_name) {
      return emailDraft.attachment_name;
    }
    if (!url) return "FDA_Package.pdf";
    try {
      const urlParts = url.split("/");
      const fileNameWithParams = urlParts[urlParts.length - 1];
      return decodeURIComponent(fileNameWithParams.split("?")[0]) || "FDA_Package.pdf";
    } catch {
      return "FDA_Package.pdf";
    }
  }

  // Loading state - show AI generating message until draft status = "draft"
  if (loading) {
    return (
      <DashboardLayout title="FDA Curacao Email">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // AI Generating state - waiting for draft with status "draft"
  const isAiGenerating = !emailDraft || emailDraft.status !== "draft";

  if (isAiGenerating) {
    return (
      <DashboardLayout title="FDA Curacao Email">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/fda-curacao")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{project?.ship_name || "Loading..."}</h1>
              <p className="text-muted-foreground">{project?.lbh_number || ""}</p>
            </div>
          </div>

          {/* AI Generating Card */}
          <Card className="card-premium">
            <CardContent className="py-16">
              <div className="flex flex-col items-center justify-center gap-6 text-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                  <div className="relative p-4 rounded-full bg-primary/10">
                    <Sparkles className="w-12 h-12 text-primary animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">AI is generating your email...</h2>
                  <p className="text-muted-foreground max-w-md">
                    We're preparing your FDA package and generating the email content. 
                    This usually takes about 30-60 seconds.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing invoices and creating PDF...</span>
                </div>

                {/* Show Google Sheet link if available */}
                {project?.google_sheet_url && (
                  <Button
                    variant="outline"
                    onClick={() => window.open(project.google_sheet_url!, "_blank")}
                    className="mt-4"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Open Google Sheet
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const mainPdfUrl = getMainPdfUrl();
  const mainPdfFilename = getFilenameFromUrl(mainPdfUrl);

  return (
    <DashboardLayout title="FDA Curacao Email">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/fda-curacao")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{project?.ship_name}</h1>
              <p className="text-muted-foreground">{project?.lbh_number}</p>
            </div>
            <Badge className="bg-success/10 text-success border-success/20" variant="outline">
              Ready to Send
            </Badge>
          </div>
          <Button onClick={handleSendEmail} disabled={sending} size="lg">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Send Email
          </Button>
        </div>

        {/* Links Row */}
        {(project?.google_sheet_url || emailDraft?.drive_folder_url) && (
          <div className="flex gap-3">
            {project?.google_sheet_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(project.google_sheet_url!, "_blank")}
              >
                <FileText className="w-4 h-4 mr-2" />
                Google Sheet
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            )}
            {emailDraft?.drive_folder_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(emailDraft.drive_folder_url!, "_blank")}
              >
                <FileText className="w-4 h-4 mr-2" />
                Drive Folder
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email Form */}
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Compose
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* TO Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">To</label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]">
                  {toEmails.map((email, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {email}
                      <button onClick={() => removeToEmail(i)} className="ml-1 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    value={newToEmail}
                    onChange={(e) => setNewToEmail(e.target.value)}
                    onKeyDown={handleToKeyDown}
                    onBlur={addToEmail}
                    placeholder="Add email..."
                    className="flex-1 min-w-[150px] border-0 shadow-none focus-visible:ring-0 h-7 p-0"
                  />
                </div>
              </div>

              {/* CC Field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">CC</label>
                <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]">
                  {ccEmails.map((email, i) => (
                    <Badge key={i} variant="secondary" className="gap-1">
                      {email}
                      <button onClick={() => removeCcEmail(i)} className="ml-1 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  <Input
                    value={newCcEmail}
                    onChange={(e) => setNewCcEmail(e.target.value)}
                    onKeyDown={handleCcKeyDown}
                    onBlur={addCcEmail}
                    placeholder="Add CC..."
                    className="flex-1 min-w-[150px] border-0 shadow-none focus-visible:ring-0 h-7 p-0"
                  />
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
              </div>

              {/* Body */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Email body..."
                  className="min-h-[200px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card className="card-premium">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                Attachments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main FDA Package */}
              {mainPdfUrl && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{mainPdfFilename}</p>
                        <p className="text-xs text-muted-foreground">FDA Package</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => setPreviewOpen(true)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const url = getPublicPdfUrl(mainPdfUrl);
                          if (url) window.open(url, "_blank");
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Extra Attachments */}
              {extraAttachments.map((att) => (
                <div key={att.id} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <p className="text-sm">{att.name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeAttachment(att.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Upload */}
              <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                {uploadingAttachment ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="w-6 h-6 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">
                  {uploadingAttachment ? "Uploading..." : "Add extra attachment"}
                </span>
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUploadAttachment}
                  disabled={uploadingAttachment}
                />
              </label>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* PDF Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[85vh] p-0" aria-describedby={undefined}>
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {mainPdfFilename}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 px-4 pb-4 h-[calc(85vh-60px)]">
            {mainPdfUrl ? (
              <iframe
                src={`${getPublicPdfUrl(mainPdfUrl)}#toolbar=1&navpanes=0`}
                className="w-full h-full rounded-lg border"
                title={mainPdfFilename}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                PDF not available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
