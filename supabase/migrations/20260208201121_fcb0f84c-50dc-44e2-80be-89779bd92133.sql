-- Delete duplicate invoices for project eaabc784-bd4e-42ad-88aa-ee03bc074189
-- Keep only the most recent entry per invoice_number
DELETE FROM fda_curacao_processed_invoices 
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY project_id, invoice_number ORDER BY created_at DESC) as rn
    FROM fda_curacao_processed_invoices
    WHERE project_id = 'eaabc784-bd4e-42ad-88aa-ee03bc074189'
  ) ranked
  WHERE rn > 1
);