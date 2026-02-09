import { cn } from "@/lib/utils";
import { Check, Settings, FileText, FileUp, Send, Mail } from "lucide-react";
import { motion } from "framer-motion";

export type FDAWizardStep = "setup" | "invoices" | "frontpage" | "processing" | "email";

interface FDAWizardStepsProps {
  currentStep: number;
  onNavigate?: (step: FDAWizardStep) => void;
}

const STEPS: { id: FDAWizardStep; label: string; icon: React.ElementType }[] = [
  { id: "setup", label: "Setup", icon: Settings },
  { id: "invoices", label: "Facturen", icon: FileText },
  { id: "frontpage", label: "Front Page", icon: FileUp },
  { id: "processing", label: "Verwerken", icon: Send },
  { id: "email", label: "E-mail", icon: Mail },
];

function getStepState(
  stepIndex: number,
  currentStep: number
): "complete" | "current" | "upcoming" {
  if (stepIndex < currentStep) return "complete";
  if (stepIndex === currentStep) return "current";
  return "upcoming";
}

export function FDAWizardSteps({ currentStep, onNavigate }: FDAWizardStepsProps) {
  return (
    <nav aria-label="Progress" className="mb-6 bg-card rounded-xl border shadow-sm px-8 py-6">
      <ol className="flex items-center justify-between relative">
        {/* Background line */}
        <div
          className="absolute top-5 left-[10%] right-[10%] h-[3px] bg-border rounded-full"
          aria-hidden="true"
        />

        {/* Animated progress line */}
        <motion.div
          className="absolute top-5 left-[10%] h-[3px] bg-primary rounded-full origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          style={{ width: `${(currentStep / (STEPS.length - 1)) * 80}%` }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          aria-hidden="true"
        />

        {STEPS.map((step, index) => {
          const state = getStepState(index, currentStep);
          const clickable = index <= currentStep && !!onNavigate;

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
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{
                    scale: state === "current" ? 1.1 : 1,
                    opacity: 1,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 25,
                    delay: index * 0.06,
                  }}
                  whileHover={clickable ? { scale: state === "current" ? 1.15 : 1.08 } : undefined}
                  whileTap={clickable ? { scale: 0.95 } : undefined}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-shadow",
                    state === "complete" &&
                      "bg-primary text-primary-foreground shadow-md shadow-primary/25",
                    state === "current" &&
                      "bg-primary/15 border-2 border-primary text-primary shadow-lg shadow-primary/20",
                    state === "upcoming" &&
                      "bg-muted border-2 border-muted-foreground/20 text-muted-foreground"
                  )}
                >
                  {state === "complete" ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
                      <Check className="w-4 h-4" strokeWidth={3} />
                    </motion.div>
                  ) : (
                    <step.icon className="w-4 h-4" />
                  )}
                </motion.div>

                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 + 0.1 }}
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
