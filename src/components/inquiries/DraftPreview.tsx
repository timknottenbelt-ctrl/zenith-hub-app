import { Ship } from 'lucide-react';

/**
 * Read-only, nicely-formatted rendering of a plain-text reply draft. Parses the
 * structure the composer writes (greeting, "Regarding your request:" bullets, a
 * "VESSEL:" particulars block, the estimated-disbursement line, sign-off) and
 * styles each part — so the agent sees a polished representation of the draft
 * without changing the stored plain text or the send flow.
 */
export function DraftPreview({ subject, body }: { subject: string; body: string }) {
  const blocks = (body || '').trim().split(/\n{2,}/).filter(Boolean);

  return (
    <div className="rounded-lg border border-border/60 bg-card p-5 text-[13.5px] leading-relaxed text-foreground/90">
      {subject && (
        <div className="mb-3 border-b border-border/50 pb-3">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Onderwerp</div>
          <div className="font-semibold text-foreground">{subject}</div>
        </div>
      )}
      {body.trim() ? (
        <div className="space-y-3">
          {blocks.map((blk, i) => <DraftBlock key={i} text={blk} />)}
        </div>
      ) : (
        <p className="text-muted-foreground">Nog geen concept.</p>
      )}
    </div>
  );
}

function DraftBlock({ text }: { text: string }) {
  const lines = text.split('\n').map((l) => l.trimEnd());
  const head = lines[0] ?? '';

  // VESSEL particulars block -> styled key/value card.
  if (/^VESSEL:/i.test(head)) {
    const name = head.replace(/^VESSEL:\s*/i, '');
    const rows = lines.slice(1)
      .map((l) => l.replace(/^[-•]\s*/, ''))
      .filter(Boolean)
      .map((l) => {
        const idx = l.indexOf(':');
        return idx > -1 ? { label: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() } : { label: '', value: l };
      });
    return (
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
        <div className="mb-2 flex items-center gap-1.5 font-semibold text-primary">
          <Ship className="h-3.5 w-3.5" /> {name}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between gap-2">
              {r.label && <span className="text-muted-foreground">{r.label}</span>}
              <span className="font-medium tabular-nums text-foreground">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // "Regarding your request/questions:" -> heading + bullet list.
  if (/^Regarding your (request|questions)/i.test(head)) {
    const bullets = lines.slice(1).filter((l) => l.trim());
    return (
      <div>
        <div className="mb-1 font-semibold text-foreground">{head}</div>
        <ul className="space-y-0.5">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-0.5 text-primary">•</span>
              <span>{b.replace(/^[-•]\s*/, '')}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // The estimated-disbursement line -> highlighted callout.
  if (/^Based on the above/i.test(head) || /estimated disbursement.*USD/i.test(text)) {
    return (
      <div className="rounded-md border border-emerald-200/60 bg-emerald-50 p-3 font-medium text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
        {text}
      </div>
    );
  }

  // Greeting, opening, close, sign-off -> plain paragraph (preserve line breaks).
  return <p className="whitespace-pre-wrap">{text}</p>;
}
