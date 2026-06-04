# Herontwerp — optimaal systeem (PDA + e-mail)

## Verdict op de huidige bouw
- **E-mail: 4 losse implementaties** van "compose & send" (AIInquiries, ManualEmails, FDAEmailPreview, FDACuracaoEmail). ~220 regels gedupliceerde ontvangers-editor, PDF-URL-helper 4× herschreven, 3 verschillende status-systemen, ManualEmails heeft geen verstuur-knop, polling overal.
- **PDA: logica onzichtbaar.** Config-admin staat los van de berekening; `pda_outputs` ongebruikt; alle rekenlogica zit in 89 n8n-nodes (niet testbaar/versioneerbaar).

## Doelarchitectuur (één keer goed)

### 1. Eén e-mail-kern (vervangt de 4 silo's)
- **DB:** één tabel `outbound_emails` met één status-machine: `draft → ready → sending → sent → failed`. Bron via `kind` (`inquiry|manual|fda|fda_curacao`) + `ref_id`. Bijlagen in één `email_attachments`-model.
- **Edge functions:** `compose-email` (AI-concept via OpenAI + RAG) en `send-email` (via Resend, met bijlagen). Vervangt de n8n send-webhooks.
- **Frontend:** één `<EmailComposer>` (ontvangers + onderwerp + body + bijlagen + verzenden), één `lib/pdf-utils.ts`, **realtime** i.p.v. polling.

### 2. PDA-rekenengine naar Supabase
- **`calculate-pda` edge function** (of SQL-functie): neemt schip + lading + terminal, gebruikt de bestaande config-tabellen (`tug_rules`, `loading_rates`, `terminal_assignments`) → schrijft `pda_outputs`. Logica wordt **zichtbaar, testbaar, versioneerbaar**.
- **`extract-inquiry` edge function:** parse inkomende e-mail → gestructureerde scheepsdata via OpenAI (de `_shared/openai.ts` + `rag.ts` die er al zijn).

### 3. Wat in n8n blíjft (bewust)
- De **Microsoft Outlook-trigger** (inkomende mail) tot er een Azure-app is.
- Eventueel OneDrive-opslag.
- **Al het andere** (AI-extractie, PDA-berekening, compose, send via Resend, DB-writes) → Supabase. = "deels n8n, meeste Supabase".

## Migratiepad (incrementeel, nooit big-bang)
1. **Blocker #0 oplossen:** één canoniek Supabase-project kiezen (`oxkshjaombffbdemqrqb`?) en `vxzscnupwpvhgbojffze` consolideren.
2. **Vertical slice als nieuw sjabloon:** de manual-email/PDA-flow volledig in de nieuwe architectuur (extract → calculate-pda → compose → send via Resend → realtime UI). Microsoft-vrij, bewijst alles.
3. **Refactor frontend** naar `<EmailComposer>` + `pdf-utils.ts`; migreer surfaces één voor één, parallel met n8n, output vergelijken, dan omschakelen.
4. **FDA/Curaçao** volgen hetzelfde patroon; Outlook-delen als laatste na Azure-app.

## Blockers vóór bouwen
- [ ] **OpenAI API-key** (extract + compose).
- [ ] **Blocker #0**: welk Supabase-project is canoniek?
- [ ] Bevestig **Resend** afzender-domein.
- [ ] Later: **Azure Graph-app** (Outlook in/uit, OneDrive).
