import { cn } from "@/lib/utils";
import { Check, FileText, Settings, Mail, Send } from "lucide-react";
import { motion } from "framer-motion";

export type WizardStep = "setup" | "invoices" | "processing" | "email";

interface WizardStepsProps {
  projectStatus?: string | null;
  hasInvoices?: boolean;
  hasDraft?: boolean;
  onNavigate?: (step: WizardStep) => void;
}

const STEPS = [
  { id: "setup" as const, label: "Setup", icon: Settings },
  { id: "invoices" as const, label: "Facturen", icon: FileText },
  { id: "processing" as const, label: "Verwerken", icon: Send },
  { id: "email" as const, label: "E-mail", icon: Mail },
];

function getProjectCurrentStep(
  projectStatus?: string | null,
  hasInvoices?: boolean,
  hasDraft?: boolean
): number {
  if (projectStatus === "sent") return 3;
  if (hasDraft || projectStatus === "ready_to_send" || projectStatus === "completed") return 3;
  if (projectStatus === "processing") return 2;
  if (hasInvoices) return 1;
  return 0;
}

function getStepState(
  stepIndex: number,
  projectCurrentStep: number,
  projectStatus?: string | null
): "complete" | "current" | "upcoming" {
  if (projectStatus === "sent" || projectStatus === "completed") return "complete";
  if (stepIndex < projectCurrentStep) return "complete";
  if (stepIndex === projectCurrentStep) return "current";
  return "upcoming";
}

function isStepClickable(stepIndex: number, projectCurrentStep: number): boolean {
  return stepIndex <= projectCurrentStep;
}

export function FDACuracaoWizardSteps({
  projectStatus,
  hasInvoices,
  hasDraft,
  onNavigate,
}: WizardStepsProps) {
  const projectCurrentStep = getProjectCurrentStep(projectStatus, hasInvoices, hasDraft);
  const progressWidth = (projectCurrentStep / (STEPS.length - 1)) * 75;

  return (
    <nav aria-label="Progress" className="mb-6 bg-card rounded-xl border shadow-sm p-6">
      <ol className="flex items-center justify-between relative">
        {/* Background line */}
        <div
          className="absolute top-6 left-[12.5%] right-[12.5%] h-0.5 bg-border"
          aria-hidden="true"
        />

        {/* Animated progress line */}
        <motion.div
          className="absolute top-6 left-[12.5%] h-0.5 bg-primary origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          style={{ width: `${progressWidth}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          aria-hidden="true"
        />

        {STEPS.map((step, index) => {
          const state = getStepState(index, projectCurrentStep, projectStatus);
          const Icon = step.icon;
          const clickable = isStepClickable(index, projectCurrentStep) && !!onNavigate;

          return (
            <li key={step.id} className="flex-1 relative z-10">
              <button
                type="button"
                onClick={() => clickable && onNavigate!(step.id)}
                disabled={!clickable}
                className={cn(
                  "flex flex-col items-center relative w-full group",
                  clickable && "cursor-pointer",
                  !clickable && "cursor-default opacity-40"
                )}
              >
                {/* Step circle */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{
                    scale: state === "current" ? 1.15 : 1,
                    opacity: 1,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                    delay: index * 0.08,
                  }}
                  whileHover={clickable ? { scale: state === "current" ? 1.2 : 1.08 } : undefined}
                  whileTap={clickable ? { scale: 0.95 } : undefined}
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center border-2 relative",
                    state === "complete" &&
                      "bg-primary border-primary text-primary-foreground shadow-md",
                    state === "current" &&
                      "bg-primary/15 border-primary text-primary ring-4 ring-primary/20 shadow-lg",
                    state === "upcoming" &&
                      "bg-muted border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {state === "complete" ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <Check className="w-5 h-5" strokeWidth={2.5} />
                    </motion.div>
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}

                  {/* Pulse ring on current step */}
                  {state === "current" && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary/40"
                      animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                </motion.div>

                {/* Label */}
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 + 0.15 }}
                  className={cn(
                    "mt-2 text-xs font-medium",
                    state === "current" && "text-primary font-semibold",
                    state === "complete" && "text-foreground",
                    state === "upcoming" && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </motion.span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
