import { cn } from "@/lib/utils";
import { Check, FileText, Settings, Mail, Send } from "lucide-react";

export type WizardStep = "setup" | "invoices" | "processing" | "email";

interface WizardStepsProps {
  currentStep: WizardStep;
  projectStatus?: string | null;
  hasInvoices?: boolean;
  hasDraft?: boolean;
  projectId?: string;
  onNavigate?: (step: WizardStep) => void;
}

const STEPS = [
  { id: "setup" as const, label: "Setup", icon: Settings },
  { id: "invoices" as const, label: "Facturen", icon: FileText },
  { id: "processing" as const, label: "Verwerken", icon: Send },
  { id: "email" as const, label: "E-mail", icon: Mail },
];

function getStepState(
  stepId: WizardStep,
  currentStep: WizardStep,
  projectStatus?: string | null,
  hasInvoices?: boolean,
  hasDraft?: boolean
): "complete" | "current" | "upcoming" {
  const stepOrder: WizardStep[] = ["setup", "invoices", "processing", "email"];
  const currentIndex = stepOrder.indexOf(currentStep);
  const stepIndex = stepOrder.indexOf(stepId);

  // Mark as complete based on project progress
  if (projectStatus === "sent") return "complete";
  
  if (stepId === "setup") {
    return currentIndex > 0 ? "complete" : currentIndex === 0 ? "current" : "upcoming";
  }
  
  if (stepId === "invoices") {
    if (hasInvoices && currentIndex > 1) return "complete";
    return stepIndex === currentIndex ? "current" : stepIndex < currentIndex ? "complete" : "upcoming";
  }
  
  if (stepId === "processing") {
    if (hasDraft || projectStatus === "ready_to_send") return "complete";
    if (projectStatus === "processing") return "current";
    return stepIndex < currentIndex ? "complete" : stepIndex === currentIndex ? "current" : "upcoming";
  }
  
  if (stepId === "email") {
    if (projectStatus === "sent") return "complete";
    return stepIndex === currentIndex ? "current" : "upcoming";
  }

  return stepIndex < currentIndex ? "complete" : stepIndex === currentIndex ? "current" : "upcoming";
}

function isStepClickable(
  stepId: WizardStep,
  projectStatus?: string | null,
  hasInvoices?: boolean
): boolean {
  // Setup and invoices are always accessible on the main page
  if (stepId === "setup" || stepId === "invoices") return true;
  
  // Processing and email are only clickable if project has been processed
  if (stepId === "processing" || stepId === "email") {
    return !!(projectStatus === "processing" || projectStatus === "ready_to_send" || projectStatus === "sent" || hasInvoices);
  }
  
  return false;
}

export function FDACuracaoWizardSteps({ 
  currentStep, 
  projectStatus, 
  hasInvoices, 
  hasDraft,
  onNavigate 
}: WizardStepsProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const state = getStepState(step.id, currentStep, projectStatus, hasInvoices, hasDraft);
          const Icon = step.icon;
          const clickable = isStepClickable(step.id, projectStatus, hasInvoices) && onNavigate;
          
          return (
            <li key={step.id} className="flex-1 relative">
              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "absolute top-5 left-1/2 w-full h-0.5 transition-colors duration-300",
                    state === "complete" ? "bg-primary" : "bg-muted"
                  )}
                  aria-hidden="true"
                />
              )}
              
              <button
                type="button"
                onClick={() => clickable && onNavigate(step.id)}
                disabled={!clickable}
                className={cn(
                  "flex flex-col items-center relative z-10 w-full",
                  clickable && "cursor-pointer hover:opacity-80 transition-opacity",
                  !clickable && "cursor-default"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300",
                    state === "complete" && "bg-primary text-primary-foreground",
                    state === "current" && "bg-primary/20 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background",
                    state === "upcoming" && "bg-muted text-muted-foreground"
                  )}
                >
                  {state === "complete" ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={cn(
                    "mt-2 text-xs font-medium transition-colors duration-300",
                    state === "current" ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
