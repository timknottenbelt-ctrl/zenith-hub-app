import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Loader2, ExternalLink, FileText, Receipt, Mail, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProcessingStep {
  id: string;
  label: string;
  icon: React.ElementType;
  status: "pending" | "processing" | "complete";
  url?: string | null;
}

interface FDACuracaoProcessingStatusProps {
  projectId: string;
  onComplete: () => void;
  onNavigateToEmail: () => void;
}

export function FDACuracaoProcessingStatus({
  projectId,
  onComplete,
  onNavigateToEmail,
}: FDACuracaoProcessingStatusProps) {
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { id: "extract", label: "Facturen verwerken", icon: FileText, status: "processing" },
    { id: "sheet", label: "Excel genereren", icon: FileText, status: "pending" },
    { id: "agency", label: "Agency factuur", icon: Receipt, status: "pending" },
    { id: "email", label: "E-mail voorbereiden", icon: Mail, status: "pending" },
  ]);
  
  const [isComplete, setIsComplete] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const triesRef = useRef(0);

  useEffect(() => {
    const poll = async () => {
      triesRef.current += 1;
      
      const { data } = await supabase
        .from("fda_curacao_projects")
        .select("google_sheet_url, agency_cost_url, status")
        .eq("project_id", projectId)
        .single();

      if (!data) return;

      const { data: draftData } = await supabase
        .from("fda_email_drafts")
        .select("status")
        .eq("project_id", projectId)
        .eq("status", "draft")
        .limit(1);

      const hasDraft = draftData && draftData.length > 0;

      setSteps((prev) => {
        const updated = [...prev];
        
        // Step 1: Extract (always processing first, then complete when sheet exists)
        if (data.google_sheet_url) {
          updated[0].status = "complete";
          updated[1].status = "complete";
          updated[1].url = data.google_sheet_url;
        } else {
          updated[0].status = "processing";
        }

        // Step 3: Agency cost
        if (data.agency_cost_url) {
          updated[2].status = "complete";
          updated[2].url = data.agency_cost_url;
        } else if (data.google_sheet_url) {
          updated[2].status = "processing";
        }

        // Step 4: Email draft
        if (hasDraft || data.status === "ready_to_send" || data.status === "sent") {
          updated[3].status = "complete";
        } else if (data.agency_cost_url) {
          updated[3].status = "processing";
        }

        return updated;
      });

      // Check if all complete
      if (hasDraft || data.status === "ready_to_send" || data.status === "sent") {
        setIsComplete(true);
        onComplete();
        if (pollingRef.current) clearInterval(pollingRef.current);
      }

      // Stop after 3 minutes
      if (triesRef.current > 60) {
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    };

    poll(); // Initial poll
    pollingRef.current = setInterval(poll, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [projectId, onComplete]);

  const completedSteps = steps.filter((s) => s.status === "complete").length;
  const progressPercent = (completedSteps / steps.length) * 100;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isComplete ? (
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary animate-pulse" />
              </div>
            )}
            <div>
              <h3 className="font-semibold">
                {isComplete ? "Klaar!" : "AI verwerkt je facturen..."}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isComplete 
                  ? "Alles is gereed. Je kunt nu de e-mail versturen."
                  : "Dit duurt meestal 1-2 minuten. Je kunt alvast verder."}
              </p>
            </div>
          </div>
          
          {isComplete && (
            <Button onClick={onNavigateToEmail} className="gap-2">
              <Mail className="w-4 h-4" />
              Naar E-mail
            </Button>
          )}
        </div>

        <Progress value={progressPercent} className="h-2" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`
                  p-3 rounded-lg border transition-all
                  ${step.status === "complete" 
                    ? "bg-success/10 border-success/30" 
                    : step.status === "processing"
                    ? "bg-primary/10 border-primary/30"
                    : "bg-muted/50 border-transparent"}
                `}
              >
                <div className="flex items-center gap-2 mb-1">
                  {step.status === "complete" ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : step.status === "processing" ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium">{step.label}</span>
                </div>
                
                {step.url && step.status === "complete" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-6 text-xs justify-start p-0 hover:bg-transparent"
                    onClick={() => window.open(step.url!, "_blank")}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Openen
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {!isComplete && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={onNavigateToEmail}>
              Ga alvast naar e-mail →
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
