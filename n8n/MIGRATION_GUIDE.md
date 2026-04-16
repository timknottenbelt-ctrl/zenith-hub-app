# Email PDA Workflow — v2.0 → v3.0 Migration Guide

## What changed

The v3.0 workflow is a **drop-in replacement** for v2.0. All downstream logic
(PDA sub-workflows, knowledge base queries, email drafting) is preserved
verbatim. The changes are concentrated in the inbound + classification pipeline.

### Fixes
1. **Excel/Word/CSV attachments no longer crash the workflow.** The old
   `Extract from File` node was hardwired to PDF mode, so any `.xlsx` went
   through the PDF extractor and threw. v3 routes by file type via a new
   `Route by File Type` switch with dedicated extractors per format.
2. **Attachments are now stored properly.** Every doc attachment is uploaded
   to the `pdfs` bucket in Supabase Storage, and a row is inserted in the
   `email_attachments` table linking it to the email. The dashboard already
   reads from this table — your `AIInquiries` page will now show attachments
   automatically.
3. **CC / BCC are preserved.** The `Attachment Handling` code node now
   emits `ccRecipients` and `bccRecipients`, and the `Insert Email Row` node
   writes them to the `cc_recipients` / `bcc_recipients` columns.

### Dead nodes removed
- `Schedule Trigger` (orphan, never connected)
- `Create Internal Note` (orphan, never connected)
- `Get a message1` (redundant — the Outlook trigger already returns raw
  message + attachments)
- `Classify Request Type` / `GPT-4o Mini Classifier` / `Classification Parser`
  / `Route by Request Type` (duplicate classification — the main classifier
  already decides OWNERS_AGENT vs LOADING_DISCHARGE, the second pass was
  pure token cost)

### Classification is now two-stage
1. **Deterministic pre-filter** (new JS node) catches obvious out-of-scope
   cases before the LLM sees them:
   - Non-Curaçao location detection (Bonaire, Aruba, Uruguay, etc.)
   - Thread analysis (LBH already replied → existing case)
   - SOF / completed-operation report detection (past-tense timestamps)
2. **LLM classifier** (existing `AI Agent1`) now uses a slimmer prompt and
   returns structured JSON (response_format = json_object). Low-confidence
   classifications (< 0.70) are routed to `needs_review` state instead of
   being silently dropped.

### New email lifecycle states
The `email_status` enum has been extended. Apply the migration in
`supabase/migrations/20260416120000_extend_email_status_and_add_classification.sql`
**before** importing v3 — otherwise the Supabase inserts with
`status='inbound'` will fail.

| Status         | When set                                                |
|----------------|---------------------------------------------------------|
| `inbound`      | Immediately after the email is received                 |
| `processing`   | After successful classification (confidence ≥ 0.70)     |
| `out_of_scope` | Pre-filter or LLM decided this is not a new request     |
| `needs_review` | LLM returned confidence < 0.70                          |
| `draft`        | Reply email drafted by downstream PDA writer            |
| `sent`         | Reply sent to customer                                  |
| `rejected`     | Manually rejected                                       |
| `approved`     | Manually approved                                       |

Two new columns also added:
- `classification_confidence numeric(3,2)` — 0.00 to 1.00, NULL for
  deterministic pre-filter outcomes.
- `classification_reasoning text` — short human-readable reason.
- `received_at timestamptz` — when Outlook received it (distinct from
  `created_at` which is DB insert time).

---

## Import steps

### 1. Apply the Supabase migration

```bash
# From the zenith-hub-app repo root:
npx supabase db push
```

Or manually via the Supabase dashboard SQL editor — paste the contents of
`supabase/migrations/20260416120000_extend_email_status_and_add_classification.sql`.

### 2. Create the HTTP Header Auth credential in n8n

The `Upload to Storage` node uses an HTTP Header Auth credential to
authenticate with Supabase Storage's REST API.

1. n8n → Credentials → New → **Header Auth**
2. Name: `Supabase Storage (anon)`
3. Header Name: `Authorization`
4. Header Value: `Bearer <YOUR_SUPABASE_ANON_KEY>`

> You can find the anon key in your Supabase dashboard → Project Settings
> → API → `Project API keys` → `anon` `public`. It is the same key that
> is hardcoded in `src/integrations/supabase/client.ts`.

5. Save.

### 3. Fix credential placeholders in the workflow JSON

Before importing, open `n8n/workflows/email-pda-v3.json` and find/replace:

| Placeholder                              | Replace with                              |
|------------------------------------------|-------------------------------------------|
| `REPLACE_WITH_YOUR_SUPABASE_CRED_ID`     | Your existing Supabase credential ID      |
| `REPLACE_WITH_HEADER_AUTH_CRED_ID`       | The credential ID from step 2             |

> **How to find credential IDs:** in n8n, open any node that uses the
> credential → the credential dropdown → click the cred → the URL becomes
> `/home/credentials/<ID>`.

Alternatively, just import the workflow, let n8n flag the missing
credentials, and pick them from the dropdown in each affected node
(`Insert Email Row`, `Insert email_attachments row`, `Mark Out of Scope`,
`Save Classification`, `Upload to Storage`).

### 4. Import into n8n

1. n8n → Workflows → Import from File
2. Select `n8n/workflows/email-pda-v3.json`
3. Open the imported workflow — do NOT activate yet
4. Open each node flagged with a credential warning and re-pick the
   credential from the dropdown
5. Save
6. Disable the old `Email - PDA - v2.0` workflow
7. Activate `Email - PDA - v3.0`

### 5. Verify with a test email

Send a test email with:
- One PDF attachment
- One Excel attachment
- A CC recipient

Check:
- [ ] Row appears in `email` table with `status='inbound'` initially,
      then updated to `processing` / `out_of_scope` / `needs_review`
- [ ] `cc_recipients` and `bcc_recipients` arrays populated
- [ ] Both attachments appear in `email_attachments` table
- [ ] Files visible in Supabase Storage under `pdfs/email-attachments/<email_id>/`
- [ ] Dashboard page `AIInquiries` shows the email with attachments and CC
- [ ] `classification_confidence` and `classification_reasoning` populated

---

## Rollback

If v3 misbehaves, re-activate the old `Email - PDA - v2.0` workflow and
disable v3. Emails already inserted with new status values (`inbound`,
`processing`, `out_of_scope`, `needs_review`) will still render in the
dashboard — the UI is permissive — but downstream v2.0 logic expects
only the old status values, so leave those rows alone or bulk-update them
to `draft` before re-running v2.0.

The enum extension is additive and safe to keep regardless.
