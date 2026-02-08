import { cn } from "@/lib/utils";
import { Check, FileText, Settings, Mail, Send } from "lucide-react";
import { motion } from "framer-motion";

export type WizardStep = "setup" | "invoices" | "processing" | "email";

interface WizardStepsProps {
  /** Which page the user is currently viewing */
  currentStep: WizardStep;
  /** The project's actual status from database */
  projectStatus?: string | null;
  /** Whether the project has invoices uploaded */
  hasInvoices?: boolean;
  /** Whether an email draft exists */
  hasDraft?: boolean;
  /** Navigation callback */
  onNavigate?: (step: WizardStep) => void;
}

const STEPS = [
  { id: "setup" as const, label: "Setup", icon: Settings },
  { id: "invoices" as const, label: "Facturen", icon: FileText },
  { id: "processing" as const, label: "Verwerken", icon: Send },
  { id: "email" as const, label: "E-mail", icon: Mail },
];

/**
 * Determines the HIGHEST completed step based on project progress.
 * This is independent of which page the user is currently viewing.
 */
function getProjectProgress(
  projectStatus?: string | null,
  hasInvoices?: boolean,
  hasDraft?: boolean
): number {
  // Project has been sent - all steps complete
  if (projectStatus === "sent") return 4;
  
  // Draft exists or ready to send - at email step
  if (hasDraft || projectStatus === "ready_to_send") return 3;
  
  // Currently processing
  if (projectStatus === "processing") return 2;
  
  // Has invoices uploaded
  if (hasInvoices) return 1;
  
  // Just setup
  return 0;
}

function getStepState(
  stepIndex: number,
  currentStepIndex: number,
  projectProgress: number
): "complete" | "current" | "upcoming" {
  // Step is complete if project progress has passed it
  if (stepIndex < projectProgress) {
    return "complete";
  }
  
  // Step is at the project's current progress level
  if (stepIndex === projectProgress) {
    // If user is viewing this step, show as current
    if (stepIndex === currentStepIndex) {
      return "current";
    }
    // Otherwise it's the project's frontier - show as current but user is elsewhere
    return "current";
  }
  
  // Step is beyond project progress
  return "upcoming";
}

function isStepClickable(
  stepId: WizardStep,
  projectProgress: number
): boolean {
  const stepOrder: WizardStep[] = ["setup", "invoices", "processing", "email"];
  const stepIndex = stepOrder.indexOf(stepId);
  
  // Can always go back to completed steps or current progress
  return stepIndex <= projectProgress;
}

export function FDACuracaoWizardSteps({ 
  currentStep, 
  projectStatus, 
  hasInvoices, 
  hasDraft,
  onNavigate 
}: WizardStepsProps) {
  const stepOrder: WizardStep[] = ["setup", "invoices", "processing", "email"];
  const currentStepIndex = stepOrder.indexOf(currentStep);
  const projectProgress = getProjectProgress(projectStatus, hasInvoices, hasDraft);
  
  return (
    <nav aria-label="Progress" className="mb-6">
      <ol className="flex items-center justify-between relative">
        {/* Background connector line */}
        <div className="absolute top-5 left-0 right-0 h-[2px] bg-border mx-[12.5%]" aria-hidden="true" />
        
        {STEPS.map((step, index) => {
          const state = getStepState(index, currentStepIndex, projectProgress);
          const isViewing = index === currentStepIndex;
          const Icon = step.icon;
          const clickable = isStepClickable(step.id, projectProgress) && onNavigate;
          
          // Show progress line if this step or previous is complete
          const showProgressLine = index > 0 && index <= projectProgress;
          
          return (
            <li key={step.id} className="flex-1 relative z-10">
              {/* Animated progress line */}
              {index > 0 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: showProgressLine ? 1 : 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1, ease: "easeOut" }}
                  className="absolute top-5 right-1/2 w-full h-[2px] bg-primary origin-right"
                  aria-hidden="true"
                />
              )}
              
              <motion.button
                type="button"
                onClick={() => clickable && onNavigate(step.id)}
                disabled={!clickable}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                whileHover={clickable ? { scale: 1.02 } : {}}
                whileTap={clickable ? { scale: 0.98 } : {}}
                className={cn(
                  "flex flex-col items-center relative w-full group",
                  clickable && "cursor-pointer",
                  !clickable && "cursor-default opacity-50"
                )}
              >
                {/* Step circle */}
                <motion.div
                  initial={false}
                  animate={{
                    scale: isViewing ? 1.05 : 1,
                  }}
                  transition={{ duration: 0.2, type: "spring", stiffness: 400, damping: 25 }}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                    // Completed steps - solid primary
                    state === "complete" && "bg-primary text-primary-foreground shadow-md shadow-primary/20",
                    // Current step (project progress frontier) - ring style
                    state === "current" && !isViewing && "bg-primary/10 text-primary ring-2 ring-primary/50",
                    // Currently viewing this step - prominent ring
                    state === "current" && isViewing && "bg-primary/15 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/10",
                    // Viewing a completed step - show it's selected
                    state === "complete" && isViewing && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    // Upcoming steps
                    state === "upcoming" && "bg-muted text-muted-foreground"
                  )}
                >
                  {state === "complete" ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.3, type: "spring", stiffness: 500, damping: 25 }}
                    >
                      <Check className="w-5 h-5" strokeWidth={2.5} />
                    </motion.div>
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </motion.div>
                
                {/* Label */}
                <span
                  className={cn(
                    "mt-2 text-xs font-medium transition-colors duration-200",
                    isViewing && "text-primary font-semibold",
                    !isViewing && state === "complete" && "text-foreground",
                    !isViewing && state === "current" && "text-primary/80",
                    state === "upcoming" && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                
                {/* Active page indicator dot */}
                {isViewing && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                    className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-primary"
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
