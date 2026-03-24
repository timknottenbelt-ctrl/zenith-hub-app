import { cn } from "@/lib/utils";
import { Check, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type StepStatus = "complete" | "processing" | "warning" | "pending";

export interface StepConfig {
  id: string;
  label: string;
  icon: React.ElementType;
  status: StepStatus;
}

interface FDAStepSidebarProps {
  projectName: string;
  lbhNumber: string;
  steps: StepConfig[];
  activeStepId: string;
  onStepClick: (stepId: string) => void;
  onBack: () => void;
  projectStatus?: string | null;
}

function getStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "processing": return "Verwerken";
    case "ready_to_send": return "Gereed";
    case "sent": case "completed": case "email_sent": return "Verstuurd";
    default: return "Concept";
  }
}

function getStatusVariant(status: string | null | undefined): string {
  switch (status) {
    case "processing": return "bg-warning/10 text-warning border-warning/20";
    case "ready_to_send": return "bg-success/10 text-success border-success/20";
    case "sent": case "completed": case "email_sent": return "bg-success/10 text-success border-success/20";
    default: return "bg-muted text-muted-foreground";
  }
}

export function FDAStepSidebar({
  projectName,
  lbhNumber,
  steps,
  activeStepId,
  onStepClick,
  onBack,
  projectStatus,
}: FDAStepSidebarProps) {
  return (
    <aside className="w-[220px] shrink-0 border-r border-border bg-card/50 flex flex-col">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-b border-border"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Terug naar projecten</span>
      </button>

      {/* Project info */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm truncate">{projectName || "Nieuw project"}</h3>
        <p className="text-xs text-muted-foreground truncate">{lbhNumber}</p>
      </div>

      {/* Steps */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {steps.map((step, index) => {
          const isActive = step.id === activeStepId;

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150",
                isActive
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {/* Status indicator */}
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                  isActive && "bg-primary-foreground/20",
                  !isActive && step.status === "complete" && "bg-success/15 text-success",
                  !isActive && step.status === "processing" && "bg-primary/15 text-primary",
                  !isActive && step.status === "warning" && "bg-warning/15 text-warning",
                  !isActive && step.status === "pending" && "bg-muted-foreground/10 text-muted-foreground"
                )}
              >
                {step.status === "complete" && !isActive ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                ) : step.status === "processing" && !isActive ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : step.status === "warning" && !isActive ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-[10px] font-bold">{index + 1}</span>
                )}
              </div>
              <span className="truncate">{step.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Project status */}
      <div className="p-3 border-t border-border">
        <Badge
          variant="outline"
          className={cn("text-[10px] w-full justify-center", getStatusVariant(projectStatus))}
        >
          {getStatusLabel(projectStatus)}
        </Badge>
      </div>
    </aside>
  );
}
