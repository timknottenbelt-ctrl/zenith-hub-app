import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ship, Clock, CheckCircle, Mail, ChevronRight, Sparkles } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { nl } from "date-fns/locale";

interface Project {
  id: string;
  project_id: string;
  lbh_number: string;
  ship_name: string;
  status: string | null;
  created_at: string | null;
  client_name?: string | null;
}

interface FDACuracaoProjectCardProps {
  project: Project;
  onClick: () => void;
  isNew?: boolean;
}

function getStatusConfig(status: string | null) {
  switch (status) {
    case "sent":
    case "email_sent":
      return {
        label: "Verzonden",
        icon: CheckCircle,
        className: "bg-success/10 text-success border-success/20",
      };
    case "processing":
    case "ready_to_send":
      return {
        label: "Verwerken",
        icon: Sparkles,
        className: "bg-warning/10 text-warning border-warning/20 animate-pulse",
      };
    default:
      return {
        label: "Concept",
        icon: Clock,
        className: "bg-muted text-muted-foreground",
      };
  }
}

export function FDACuracaoProjectCard({ project, onClick, isNew }: FDACuracaoProjectCardProps) {
  const statusConfig = getStatusConfig(project.status);
  const StatusIcon = statusConfig.icon;
  
  const createdDate = project.created_at && isValid(parseISO(project.created_at))
    ? format(parseISO(project.created_at), "d MMM yyyy", { locale: nl })
    : null;

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 active:scale-[0.98]"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Ship className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{project.ship_name}</h3>
                {isNew && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">
                    Nieuw
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="truncate">{project.lbh_number}</span>
                {project.client_name && (
                  <>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="truncate">{project.client_name}</span>
                  </>
                )}
              </div>
              {createdDate && (
                <p className="text-xs text-muted-foreground/60 mt-0.5">{createdDate}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <Badge variant="outline" className={statusConfig.className}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
