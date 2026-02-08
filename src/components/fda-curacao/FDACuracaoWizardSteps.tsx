import { cn } from "@/lib/utils";
import { Check, FileText, Settings, Mail, Send } from "lucide-react";
import { motion } from "framer-motion";

export type WizardStep = "setup" | "invoices" | "processing" | "email";

interface WizardStepsProps {
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
 * Determines which step the project is CURRENTLY at based on status.
 * Returns the step index (0-3).
 */
function getProjectCurrentStep(
  projectStatus?: string | null,
  hasInvoices?: boolean,
  hasDraft?: boolean
): number {
  // Project has been sent - email step is complete, show email as current
  if (projectStatus === "sent") return 3;
  
  // Draft exists or ready to send - at email step
  if (hasDraft || projectStatus === "ready_to_send") return 3;
  
  // Currently processing
  if (projectStatus === "processing") return 2;
  
  // Has invoices uploaded - at invoices step
  if (hasInvoices) return 1;
  
  // Just setup
  return 0;
}

function getStepState(
  stepIndex: number,
  projectCurrentStep: number,
  projectStatus?: string | null
): "complete" | "current" | "upcoming" {
  // If project is sent, all steps are complete
  if (projectStatus === "sent") {
    return "complete";
  }
  
  // Step is before the current project step - it's complete
  if (stepIndex < projectCurrentStep) {
    return "complete";
  }
  
  // Step is at the current project step - it's active
  if (stepIndex === projectCurrentStep) {
    return "current";
  }
  
  // Step is after the current project step - upcoming
  return "upcoming";
}

function isStepClickable(
  stepIndex: number,
  projectCurrentStep: number
): boolean {
  // Can click on completed steps and current step
  return stepIndex <= projectCurrentStep;
}

export function FDACuracaoWizardSteps({ 
  projectStatus, 
  hasInvoices, 
  hasDraft,
  onNavigate 
}: WizardStepsProps) {
  const projectCurrentStep = getProjectCurrentStep(projectStatus, hasInvoices, hasDraft);
  
  return (
    <nav aria-label="Progress" className="mb-6">
      <ol className="flex items-center justify-between relative">
        {/* Background connector line */}
        <div className="absolute top-5 left-0 right-0 h-[2px] bg-border mx-[12.5%]" aria-hidden="true" />
        
        {STEPS.map((step, index) => {
          const state = getStepState(index, projectCurrentStep, projectStatus);
          const Icon = step.icon;
          const clickable = isStepClickable(index, projectCurrentStep) && onNavigate;
          
          // Show progress line if this step is complete or current
          const showProgressLine = index > 0 && index <= projectCurrentStep;
          
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
                    scale: state === "current" ? 1.05 : 1,
                  }}
                  transition={{ duration: 0.2, type: "spring", stiffness: 400, damping: 25 }}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                    // Completed steps - solid primary with checkmark
                    state === "complete" && "bg-primary text-primary-foreground shadow-md shadow-primary/20",
                    // Current step - prominent ring style (this is where the project IS)
                    state === "current" && "bg-primary/15 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background shadow-lg shadow-primary/10",
                    // Upcoming steps - muted
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
                    state === "current" && "text-primary font-semibold",
                    state === "complete" && "text-foreground",
                    state === "upcoming" && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
                
                {/* Current step indicator dot */}
                {state === "current" && (
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
