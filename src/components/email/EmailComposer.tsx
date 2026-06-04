/**
 * Shared email composer: recipients (To/CC) + subject + body in one component.
 * Builds on EmailRecipientsEditor. Two variants match the existing surfaces:
 *   - "default": boxed cards (FDAEmailPreview look)
 *   - "compact": tight inline fields (FDACuracao "Email Compose" look)
 */
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmailRecipientsEditor } from "./EmailRecipientsEditor";

interface EmailComposerProps {
  toEmails: string[];
  onToChange: (emails: string[]) => void;
  ccEmails: string[];
  onCcChange: (emails: string[]) => void;
  subject: string;
  onSubjectChange: (s: string) => void;
  body: string;
  onBodyChange: (s: string) => void;
  variant?: "default" | "compact";
  addOnBlur?: boolean;
}

export function EmailComposer({
  toEmails,
  onToChange,
  ccEmails,
  onCcChange,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  variant = "default",
  addOnBlur = false,
}: EmailComposerProps) {
  const recipients = (
    <EmailRecipientsEditor
      card={variant === "default"}
      variant={variant}
      addOnBlur={addOnBlur}
      toEmails={toEmails}
      onToChange={onToChange}
      ccEmails={ccEmails}
      onCcChange={onCcChange}
    />
  );

  if (variant === "compact") {
    return (
      <div className="space-y-4">
        {recipients}
        <div className="space-y-2">
          <label className="text-sm font-medium">Subject</label>
          <Input value={subject} onChange={(e) => onSubjectChange(e.target.value)} placeholder="Email subject" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Message</label>
          <Textarea
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Email body..."
            className="min-h-[200px] whitespace-pre-wrap"
          />
        </div>
      </div>
    );
  }

  return (
    <>
      {recipients}
      <Card className="card-premium">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium">Subject</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="Enter email subject..."
            className="text-base"
          />
        </CardContent>
      </Card>
      <Card className="card-premium">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium">Email Body</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Enter email body..."
            className="min-h-[300px] font-sans text-sm leading-relaxed resize-y"
          />
        </CardContent>
      </Card>
    </>
  );
}
