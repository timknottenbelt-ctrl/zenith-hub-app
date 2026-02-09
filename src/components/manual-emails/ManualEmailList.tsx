import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, CheckCircle, XCircle, Loader2, RefreshCw, Search } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { isToday, isThisWeek, isThisMonth, isThisYear, parseISO } from "date-fns";
import type { ManualEmail } from "@/hooks/useManualEmails";

interface ManualEmailListProps {
  emails: ManualEmail[];
  selectedEmail: ManualEmail | null;
  loading: boolean;
  filterAgentType: string;
  setFilterAgentType: (v: string) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  onSelectEmail: (email: ManualEmail) => void;
  onRefresh: () => void;
}

export function ManualEmailList({
  emails,
  selectedEmail,
  loading,
  filterAgentType,
  setFilterAgentType,
  searchQuery,
  setSearchQuery,
  dateFilter,
  setDateFilter,
  onSelectEmail,
  onRefresh,
}: ManualEmailListProps) {
  const { t } = useLanguage();

  const filteredEmails = useMemo(() => {
    return emails.filter((email) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        !query ||
        (email.vessel_name?.toLowerCase() || "").includes(query) ||
        (email.subject?.toLowerCase() || "").includes(query) ||
        (email.port?.toLowerCase() || "").includes(query) ||
        (email.company_name?.toLowerCase() || "").includes(query) ||
        (email.contact_name?.toLowerCase() || "").includes(query);

      let matchesDate = true;
      if (dateFilter !== "all" && email.created_at) {
        const emailDate = parseISO(email.created_at);
        if (dateFilter === "today") matchesDate = isToday(emailDate);
        else if (dateFilter === "week") matchesDate = isThisWeek(emailDate, { weekStartsOn: 1 });
        else if (dateFilter === "month") matchesDate = isThisMonth(emailDate);
        else if (dateFilter === "year") matchesDate = isThisYear(emailDate);
      }

      return matchesSearch && matchesDate;
    });
  }, [emails, searchQuery, dateFilter]);

  const getStatusBadge = (status: string | null) => {
    const styles: Record<string, string> = {
      processing: "bg-primary/10 text-primary",
      completed: "bg-success/10 text-success",
      draft: "bg-muted text-muted-foreground",
      error: "bg-destructive/10 text-destructive",
    };
    return styles[status || "processing"] || "bg-muted text-muted-foreground";
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "processing": return <Loader2 className="w-3 h-3 animate-spin" />;
      case "completed": return <CheckCircle className="w-3 h-3" />;
      case "error": return <XCircle className="w-3 h-3" />;
      default: return <Mail className="w-3 h-3" />;
    }
  };

  return (
    <Card className="card-premium lg:col-span-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="w-4 h-4" />
            E-mails ({filteredEmails.length})
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="pt-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Select value={filterAgentType} onValueChange={setFilterAgentType}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Filter op type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle types</SelectItem>
              <SelectItem value="CARGO_AGENT">Cargo Agent</SelectItem>
              <SelectItem value="OWNERS_AGENT">Owners Agent</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Filter op datum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Altijd</SelectItem>
              <SelectItem value="today">Vandaag</SelectItem>
              <SelectItem value="week">Deze week</SelectItem>
              <SelectItem value="month">Deze maand</SelectItem>
              <SelectItem value="year">Dit jaar</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 min-h-0">
        <ScrollArea className="h-full">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              {searchQuery || dateFilter !== "all"
                ? "Geen resultaten gevonden"
                : "Nog geen e-mails"}
            </div>
          ) : (
            <div className="divide-y">
              {filteredEmails.map((email) => (
                <div
                  key={email.id}
                  onClick={() => onSelectEmail(email)}
                  className={`p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedEmail?.id === email.id ? "bg-primary/5 border-l-2 border-primary" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">
                        {email.vessel_name || "TBN"}
                        {email.vessel_2_name && ` / ${email.vessel_2_name}`}
                      </p>
                    </div>
                    {email.status === "processing" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                    ) : (
                      <Badge className={`${getStatusBadge(email.status)} text-xs shrink-0`} variant="secondary">
                        {getStatusIcon(email.status)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {email.agent_type === "OWNERS_AGENT" ? "Owners" : "Cargo"}
                    </Badge>
                    {email.port && <span className="text-xs text-muted-foreground">{email.port}</span>}
                  </div>
                  {email.company_name && (
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1 italic">{email.company_name}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {email.created_at ? new Date(email.created_at).toLocaleString("nl-NL") : "Onbekende datum"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
