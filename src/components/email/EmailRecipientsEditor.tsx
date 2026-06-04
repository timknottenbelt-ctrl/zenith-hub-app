/**
 * Shared To/CC recipient chip editor.
 *
 * Replaces the ~220 lines of duplicated addToEmail / removeToEmail /
 * addCcEmail / removeCcEmail / handleKeyDown logic + markup that lived
 * separately in FDAEmailPreview and FDACuracaoEmail.
 *
 * Two visual variants preserve each surface's original look:
 *   - "default": boxed fields with a Plus button (FDAEmailPreview)
 *   - "compact": tighter inline fields, add-on-blur, no button (FDACuracaoEmail)
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

type Variant = "default" | "compact";

interface EmailRecipientsEditorProps {
  toEmails: string[];
  onToChange: (emails: string[]) => void;
  ccEmails: string[];
  onCcChange: (emails: string[]) => void;
  /** Wrap in a titled Card (default true). Set false to embed bare. */
  card?: boolean;
  title?: string;
  /** Visual style. "compact" matches the old FDACuracao compose look. */
  variant?: Variant;
  /** Also commit the typed email when the input loses focus. */
  addOnBlur?: boolean;
}

function ChipField({
  label,
  placeholder,
  emails,
  onChange,
  badgeVariant,
  variant,
  addOnBlur,
}: {
  label: string;
  placeholder: string;
  emails: string[];
  onChange: (emails: string[]) => void;
  badgeVariant: "secondary" | "outline";
  variant: Variant;
  addOnBlur: boolean;
}) {
  const [draft, setDraft] = useState("");
  const compact = variant === "compact";

  function add() {
    const email = draft.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (emails.includes(email)) {
      toast({ title: "Duplicate", description: "This email is already added", variant: "destructive" });
      return;
    }
    onChange([...emails, email]);
    setDraft("");
  }

  function remove(index: number) {
    onChange(emails.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div
        className={
          compact
            ? "flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]"
            : "flex flex-wrap gap-2 p-3 border rounded-lg min-h-[48px] bg-background"
        }
      >
        {emails.map((email, index) => (
          <Badge
            key={index}
            variant={compact ? "secondary" : badgeVariant}
            className={compact ? "gap-1" : "flex items-center gap-1 py-1 px-2"}
          >
            {email}
            <button type="button" onClick={() => remove(index)} className="ml-1 hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}

        {compact ? (
          <Input
            type="email"
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            onBlur={addOnBlur ? add : undefined}
            className="flex-1 min-w-[150px] border-0 shadow-none focus-visible:ring-0 h-7 p-0"
          />
        ) : (
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Input
              type="email"
              placeholder={placeholder}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              onBlur={addOnBlur ? add : undefined}
              className="border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
            />
            <Button type="button" variant="ghost" size="sm" onClick={add} disabled={!draft.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function EmailRecipientsEditor({
  toEmails,
  onToChange,
  ccEmails,
  onCcChange,
  card = true,
  title = "Recipients",
  variant = "default",
  addOnBlur = false,
}: EmailRecipientsEditorProps) {
  const compact = variant === "compact";
  const body = (
    <div className="space-y-4">
      <ChipField
        label="To"
        placeholder={compact ? "Add email..." : "Add recipient..."}
        emails={toEmails}
        onChange={onToChange}
        badgeVariant="secondary"
        variant={variant}
        addOnBlur={addOnBlur}
      />
      <ChipField
        label="CC"
        placeholder={compact ? "Add CC..." : "Add CC recipient..."}
        emails={ccEmails}
        onChange={onCcChange}
        badgeVariant="outline"
        variant={variant}
        addOnBlur={addOnBlur}
      />
    </div>
  );

  if (!card) return body;

  return (
    <Card className="card-premium">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{body}</CardContent>
    </Card>
  );
}
