import { cn } from "@/lib/utils";
import { Check, FileText, Settings, Mail, Send } from "lucide-react";
import { motion } from "framer-motion";

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

  // If project is sent, everything is complete
  if (projectStatus === "sent") return "complete";
  
  // If we're on email page and have a draft, processing is complete
  if (stepId === "processing" && (hasDraft || projectStatus === "ready_to_send")) {
    return "complete";
  }
  
  // Email step is current when we have a draft or are ready to send
  if (stepId === "email" && (hasDraft || projectStatus === "ready_to_send")) {
    return currentStep === "email" ? "current" : "upcoming";
  }
  
  // Setup is complete if we have invoices or moved past it
  if (stepId === "setup") {
    return hasInvoices || currentIndex > 0 ? "complete" : "current";
  }
  
  // Invoices is complete if we have invoices and moved to processing/email
  if (stepId === "invoices") {
    if (hasInvoices && (currentIndex > 1 || projectStatus === "processing" || projectStatus === "ready_to_send")) {
      return "complete";
    }
    return hasInvoices ? (currentStep === "invoices" ? "current" : "complete") : "upcoming";
  }
  
  // Processing is current when actively processing
  if (stepId === "processing") {
    if (projectStatus === "processing") return "current";
    return stepIndex < currentIndex ? "complete" : stepIndex === currentIndex ? "current" : "upcoming";
  }

  return stepIndex < currentIndex ? "complete" : stepIndex === currentIndex ? "current" : "upcoming";
}

function isStepClickable(
  stepId: WizardStep,
  projectStatus?: string | null,
  hasInvoices?: boolean
): boolean {
  // Setup and invoices are always accessible
  if (stepId === "setup" || stepId === "invoices") return true;
  
  // Processing and email are clickable if project has been processed or has invoices
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
    <nav aria-label="Progress" className="mb-6">
      <ol className="flex items-center justify-between relative">
        {/* Background connector line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted mx-[12.5%]" aria-hidden="true" />
        
        {STEPS.map((step, index) => {
          const state = getStepState(step.id, currentStep, projectStatus, hasInvoices, hasDraft);
          const Icon = step.icon;
          const clickable = isStepClickable(step.id, projectStatus, hasInvoices) && onNavigate;
          
          // Calculate progress line width for this segment
          const prevState = index > 0 ? getStepState(STEPS[index - 1].id, currentStep, projectStatus, hasInvoices, hasDraft) : null;
          const showProgressLine = index > 0 && (prevState === "complete" || state === "complete" || state === "current");
          
          return (
            <li key={step.id} className="flex-1 relative z-10">
              {/* Animated progress line */}
              {index > 0 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: showProgressLine ? 1 : 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1, ease: "easeOut" }}
                  className="absolute top-5 right-1/2 w-full h-0.5 bg-primary origin-right"
                  style={{ transformOrigin: "right" }}
                  aria-hidden="true"
                />
              )}
              
              <motion.button
                type="button"
                onClick={() => clickable && onNavigate(step.id)}
                disabled={!clickable}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                whileHover={clickable ? { scale: 1.05 } : {}}
                whileTap={clickable ? { scale: 0.95 } : {}}
                className={cn(
                  "flex flex-col items-center relative w-full group",
                  clickable && "cursor-pointer",
                  !clickable && "cursor-default"
                )}
              >
                {/* Step circle */}
                <motion.div
                  initial={false}
                  animate={{
                    scale: state === "current" ? 1.1 : 1,
                    backgroundColor: state === "complete" 
                      ? "hsl(var(--primary))" 
                      : state === "current" 
                        ? "hsl(var(--primary) / 0.15)" 
                        : "hsl(var(--muted))",
                  }}
                  transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
                  className={cn(
                    "w-11 h-11 rounded-full flex items-center justify-center shadow-sm",
                    state === "complete" && "text-primary-foreground shadow-primary/25",
                    state === "current" && "text-primary ring-2 ring-primary ring-offset-2 ring-offset-background shadow-primary/20",
                    state === "upcoming" && "text-muted-foreground",
                    clickable && "group-hover:shadow-md transition-shadow"
                  )}
                >
                  {state === "complete" ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.3, type: "spring", stiffness: 400, damping: 20 }}
                    >
                      <Check className="w-5 h-5" strokeWidth={2.5} />
                    </motion.div>
                  ) : (
                    <Icon className={cn(
                      "w-5 h-5 transition-transform",
                      state === "current" && "animate-pulse"
                    )} />
                  )}
                </motion.div>
                
                {/* Label */}
                <motion.span
                  initial={false}
                  animate={{
                    color: state === "current" 
                      ? "hsl(var(--primary))" 
                      : state === "complete"
                        ? "hsl(var(--foreground))"
                        : "hsl(var(--muted-foreground))",
                    fontWeight: state === "current" ? 600 : 500,
                  }}
                  transition={{ duration: 0.2 }}
                  className="mt-2.5 text-xs tracking-wide"
                >
                  {step.label}
                </motion.span>
                
                {/* Active indicator dot */}
                {state === "current" && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-primary"
                  />
                )}
              </motion.button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
