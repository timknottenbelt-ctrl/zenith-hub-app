# Migratieplan — n8n → Supabase

**Doel:** de automatisering uit n8n overzetten naar Supabase Edge Functions, zodat het systeem zelfstandig draait zonder n8n-afhankelijkheid.

**Status credentials:** OpenAI ✅ (aanlevering toegezegd) · Microsoft Azure/Graph ❌ (nog niet) · Resend ❓ (al in gebruik in n8n)

> **Eerlijke deadline-check:** "alles tegen woensdag" is niet haalbaar. Dit is een gefaseerd project van meerdere weken. Wat **wél** voor woensdag kan: de fundering + de 2 Microsoft-vrije workflows (zie Fase 1). De rest volgt gefaseerd, elk getest naast de live n8n-versie vóór cutover.

---

## 0. Kritieke blocker eerst oplossen — TWEE Supabase-projecten

Élke actieve workflow schrijft naar **`vxzscnupwpvhgbojffze.supabase.co`** terwijl de frontend-app op **`oxkshjaombffbdemqrqb`** (LBH Cura) draait. Een paar workflows raken bovendien béíde.

**Voordat er één workflow gemigreerd wordt, moeten we weten:**
- Welk project is de "echte" bron van waarheid voor `email`, `manual_emails`, `fda_*`, `loading_rates`, `tug_rules`, `terminal_assignments`?
- Wordt er gesynchroniseerd tussen de twee, of is dit een half afgemaakte migratie?
- Kan alles geconsolideerd worden naar één project (`oxkshjaombffbdemqrqb`)?

➡️ **Actie:** geef toegang tot/uitleg over `vxzscnupwpvhgbojffze`. Zolang dit onhelder is, riskeert elke migratie dat data in het verkeerde project belandt.

---

## 1. Fundering (één keer bouwen, hergebruikt door alle workflows)

| Component | Wat | Status |
|---|---|---|
| **Webhook-proxy + auth** | `n8n-webhook` edge function, auth-gated | ✅ **Al gebouwd** |
| **Secrets-beheer** | Supabase edge secrets i.p.v. hardcoded | ✅ Patroon staat |
| **`_shared/openai.ts`** | OpenAI-client + chat/embeddings helpers (AI SDK of fetch) | ⬜ Te bouwen |
| **`_shared/rag.ts`** | pgvector-query helper (vervangt n8n `vectorStoreSupabase`) | ⬜ Te bouwen |
| **`_shared/mailer.ts`** | Resend-mailer (Microsoft-vrij alternatief voor Outlook-send) | ⬜ Te bouwen |
| **`_shared/graph.ts`** | Microsoft Graph (Outlook/OneDrive) — **geblokkeerd op Azure-app** | ⛔ Wacht op creds |
| **`_shared/pdf.ts`** | PDF-extract/merge (nu een externe Cloudflare Worker) | ⬜ Te bouwen |

---

## 2. Afhankelijkheden-matrix per actieve workflow

| Workflow | Trigger | OpenAI/RAG | Microsoft | Andere externe | Migratie nu mogelijk? |
|---|---|---|---|---|---|
| **TADOS Error Handler** (5) | webhook `welcome-email-lbh` | – | – | Resend | 🟢 **Ja** (warmup) |
| **Dashboard PDA creator** (89) | webhook `MANUAL-EMAIL-CREATION` | ✅ 12 agents + RAG | – | – | 🟢 **Ja, met OpenAI** |
| **FDA - MERGER AND CREATOR** (25) | webhook (2×) | – | Outlook-send | Cloudflare PDF-merger | 🟡 Deels (send ⛔) |
| **Webhook email page** (30) | webhook (3×) | – | Outlook-send | – | 🟠 Outlook ⛔ |
| **FDA Curacao Creator** (63) | webhook (2×) | 1× OpenAI | OneDrive + Outlook | – | 🟠 Graph ⛔ |
| **EMAIL - PDA v3** (116) | **Outlook-trigger** | ✅ 14 agents + RAG | Outlook in+out | – | 🔴 Graph-trigger ⛔ |

**Conclusie:** met alleen OpenAI zijn **TADOS** en **Dashboard PDA creator** volledig migreerbaar. De rest heeft (deels) een Azure Graph-app nodig.

---

## 3. Gefaseerd plan

### Fase 1 — Fundering + Microsoft-vrije workflows  *(haalbaar deze week)*
1. Los blocker #0 op (twee Supabase-projecten) — **eerst**.
2. Bouw `_shared/openai.ts`, `_shared/rag.ts`, `_shared/mailer.ts`.
3. Migreer **TADOS Error Handler** → edge function `welcome-email` (warmup, bewijst pipeline).
4. Migreer **Dashboard PDA creator** → edge function `manual-email-create` (de grote Microsoft-vrije; RAG + agents in Deno/AI SDK). Draai parallel aan n8n, vergelijk output, dan cutover via de proxy.

### Fase 2 — PDF + Resend-gebaseerde delen
5. Bouw `_shared/pdf.ts` (vervang de Cloudflare-worker of behoud 'm bewust).
6. Migreer **FDA - MERGER AND CREATOR**, met Resend i.p.v. Outlook voor de mail (indien afzender-domein bij Resend mag).

### Fase 3 — Microsoft Graph  *(geblokkeerd tot Azure-app er is)*
7. Zet Azure-app op (`Mail.Read`, `Mail.Send`, `Files.ReadWrite`, admin-consent) → `_shared/graph.ts`.
8. Migreer **Webhook email page** en **FDA Curacao Creator**.

### Fase 4 — De Outlook-trigger (zwaarste)
9. Microsoft Graph change-notification-subscription → edge function + vernieuwings-cron (Supabase pg_cron) → migreer **EMAIL - PDA v3** (RAG + agents).

---

## 4. Cutover-strategie (per workflow, veilig)
1. Bouw de edge function naast de bestaande n8n-flow.
2. Stuur testverkeer naar beide, vergelijk de output 1-op-1.
3. Wijzig in `n8n-webhook` (of direct in de frontend) de doel-URL van de n8n-webhook naar de nieuwe edge function.
4. Zet de n8n-workflow op inactief (niet verwijderen — fallback).
5. Na een stabiele periode: opruimen.

## 5. Wat ik van jou nodig heb
- [ ] **Opheldering project `vxzscnupwpvhgbojffze`** (blocker #0).
- [ ] **OpenAI API-key** → ik zet 'm als edge secret.
- [ ] Bevestiging **Resend** (API-key + geverifieerd afzender-domein) — vervangt Outlook-send Microsoft-vrij.
- [ ] Later: **Azure Graph-app** voor Fase 3–4.

## 6. Realistische inschatting
- **Fase 1:** ~deze week haalbaar (mits blocker #0 + OpenAI/Resend snel rond zijn).
- **Fase 2:** +enkele dagen.
- **Fase 3–4:** pas ná Azure-app; reken op meerdere weken voor de twee 89/116-node AI-workflows met grondige tests.
