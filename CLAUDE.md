# Claude operational notes — zenith-hub-app

Short guide for any Claude Code session that needs to ship a change here.
Read this file before doing anything else.

## What this repo is

Dashboard for **LBH Curaçao**, a maritime shipping agency. React SPA
(Vite + TypeScript + Tailwind + shadcn-ui) with Supabase as backend.
Deployed on Vercel. Pairs with an n8n workflow that triages inbound
emails and writes them to the `email` table.

- **Live**: auto-deployed on every push to `main`
- **Vercel project**: linked to GitHub `timknottenbelt-ctrl/zenith-hub-app`
- **Supabase project**: `oxkshjaombffbdemqrqb`

## Deploy flow — how to push and go live

Vercel auto-deploys from `main`. The happy path:

1. Work on a feature branch (see "Worktree rule" below)
2. Commit with the correct git author (see "Git author rule")
3. `git push -u origin <branch>`
4. `gh pr create --base main --head <branch> --title "..." --body "..."`
5. `gh pr merge <PR#> --merge --repo timknottenbelt-ctrl/zenith-hub-app`
6. Vercel deploys in ~90 seconds

Never force-push to main. Never commit directly to main.

## Git author rule — CRITICAL

Vercel auto-deploy is tied to commits from the `timknottenbelt-ctrl`
GitHub account. Every commit from Claude must use:

```bash
git -c user.name="timknottenbelt-ctrl" \
    -c user.email="timknottenbelt@gmail.com" \
    commit -m "..."
```

Do NOT run `git config --global user.*` — just pass `-c` per commit.
If the author is wrong, Vercel ignores the push.

## Worktree rule

The primary working directory `/home/ctimetie/zenith-hub-app` often has
the user's in-progress uncommitted changes on `main`. Do NOT stack your
work on top of those. Always create a worktree from a clean `origin/main`:

```bash
cd /home/ctimetie/zenith-hub-app
git fetch origin
git worktree add -b <branch-name> /home/ctimetie/<short-worktree-name> origin/main
cd /home/ctimetie/<short-worktree-name>
# ... work here ...
```

After merging the PR, clean up:

```bash
cd /home/ctimetie/zenith-hub-app
git worktree remove /home/ctimetie/<short-worktree-name> --force
git branch -D <branch-name>
```

If you need `node_modules` for `tsc --noEmit` in the worktree:

```bash
ln -s /home/ctimetie/zenith-hub-app/node_modules node_modules
# do your checks
rm node_modules
```

## Supabase — how to run migrations

The Supabase MCP available to Claude.ai is connected to a **different
organisation** (`mbmrrckghyozoabbdhcf` / P&P Tool). It does NOT have
access to project `oxkshjaombffbdemqrqb`. Do not try `apply_migration`
via MCP — it will return "permission denied".

Migration workflow:

1. Write the SQL file in `supabase/migrations/<timestamp>_<name>.sql`
   (timestamps must be strictly greater than the latest existing file —
   check `ls supabase/migrations/ | tail`)
2. Commit it as part of the PR
3. Ask the user to paste the SQL into the Supabase dashboard
   SQL Editor themselves, or use `npx supabase db push` locally

Generated types live in `src/integrations/supabase/types.ts` — they are
regenerated server-side when migrations run, so don't edit them manually.

**Storage buckets**: `pdfs`, `knowledge-pdfs`, `fda-invoices` — all have
public INSERT/SELECT/DELETE policies for the anon key.

## n8n workflow

The workflow that triages inbound emails → `email` table + `email_attachments`
is maintained as JSON in this repo:

- **Source**: `n8n/workflows/email-pda-v2.0-source.json` (frozen original)
- **Generated**: `n8n/workflows/email-pda-v3.json` (what the user imports)
- **Builder**: `n8n/build-workflow-v3.py`

The builder reads v2.0 source, applies transformations (remove dead
nodes, add attachment upload chain, rewire classifier), writes v3.

To change the workflow:

1. Edit `build-workflow-v3.py`
2. Run `python3 n8n/build-workflow-v3.py` from repo root
3. Commit both the `.py` and the regenerated `.json`
4. User has to re-import the JSON in n8n for it to take effect (Claude
   does not push to n8n — user owns n8n operations)

**Credential IDs baked into the generated JSON** (these are n8n credential
IDs in the user's instance, not secrets):

| Purpose | ID | Name in n8n |
|---|---|---|
| Supabase (DB) | `VA7km8hKLFMCwCFf` | `Tim supabse` |
| Supabase Storage (HTTP) | `bRvSu0VlQdvQ5ZVg` | `lbh supabas` |
| Microsoft Outlook | `zW0EQHDJoefJdOsr` | `Microsoft Outlook account 3` |
| OpenAI | `PjHLnVM4SPsUHOVa` | `LBH n8n` |
| Gmail (errors) | `rDWsg8Xy3wt7b3FL` | — |

## n8n gotchas we've already solved

If you are debugging a failing node, check these first — they've all
bitten us once and are encoded in `build-workflow-v3.py`:

1. **Supabase Insert strips binary data from its output.** Code nodes
   downstream of a Supabase Insert cannot access the binary via
   `$input.first()`. Reach back to `$('Attachment Handling').first()`
   for binary, and to earlier nodes for json fields.

2. **`.item` breaks after IF / merge / multi-hop chains.** n8n's
   paired-item tracking loses the link. Use `.first()` whenever there
   is exactly one email per run (which is always in this workflow).

3. **HTTP Request node's output is the response body.** After
   `Upload to Storage`, `$json` is `{Key, Id}` — NOT upstream fields.
   Reach back to the previous relevant node for original data.

4. **`b.fileSize` in n8n binary metadata is a human-readable string**
   like `"280 kB"`, not bytes. `email_attachments.file_size` is bigint.
   The `parseSize()` helper in Attachment Handling converts.

5. **`email_status` enum values** — valid values are: `inbound`,
   `processing`, `out_of_scope`, `needs_review`, `draft`, `sent`,
   `rejected`, `approved`. Anything else will be rejected.

6. **Column `Email Type` has a space** — use bracket notation in
   expressions: `{{ $json["Email Type"] }}`.

7. **Attachment Handling is the single source of truth for email body
   text.** After the Supabase inserts there's no `text` field anywhere
   else. Always read body from `$('Attachment Handling').first().json.text`.

## Dashboard conventions

- **Design tokens** live in `src/index.css` (HSL tokens for Tailwind).
  Use `bg-background`, `text-foreground`, `text-muted-foreground`,
  `border-border`, `bg-primary` etc. Do not hardcode hex colors.
- **Font**: Inter (loaded from Google Fonts in index.css)
- **i18n**: all user-facing strings go through `t('<key>')` from
  `useLanguage()`. Three languages: EN, NL, ES. Add keys in
  `src/lib/i18n.ts` to all three objects.
- **Dark mode**: supported but not auto-applied. Don't assume it.
- **shadcn-ui** components in `src/components/ui/` — extend them, don't
  rewrite.

## What to skip

- Do NOT regenerate `src/integrations/supabase/types.ts` unless the
  user explicitly asks — it is generated from the live DB.
- Do NOT commit `bun.lockb` or `package-lock.json` changes unless you
  actually ran install. They're often modified by editors.
- Do NOT add new Vercel config — `vercel.json` already has the SPA
  rewrite.
- Do NOT push to n8n directly. Claude's job ends at generating the JSON
  file; the user does the import.
- The Supabase MCP is connected to the wrong organisation. Do not
  waste time trying to `list_tables` or `apply_migration` — it will
  return "permission denied". Work from `supabase/migrations/` files
  and ask the user to apply them.
