-- Align terminal_assignments physical limits (max_loa / max_draft) with the
-- verified Curaçao Ports Authority figures, so the EDA terminal routing and the
-- Port Call berth-check (src/lib/terminals.ts) use the same source of truth.
--
-- Only terminals with a published CPA figure are touched. Motet/CRU,
-- St. Michiel's Bay and the anchorages are left as-is (unpublished or a
-- different berth type). Applied to the live DB via the management API on
-- 2026-06-08; this file records it for reproducibility.

update public.terminal_assignments set max_draft = 13.71 where terminal_name = 'ISLA Refinery';
update public.terminal_assignments set max_draft = 28.7  where terminal_name = 'Bullen Bay';
update public.terminal_assignments set max_loa = 320, max_draft = 13.7 where terminal_name = 'Caracas Bay';
update public.terminal_assignments set max_draft = 6.7   where terminal_name = 'Fuik Terminal';
