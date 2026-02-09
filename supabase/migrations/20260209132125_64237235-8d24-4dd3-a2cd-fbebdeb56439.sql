
-- Delete all related data for the 3 projects
DELETE FROM fda_curacao_processed_invoices WHERE project_id IN ('eaabc784-bd4e-42ad-88aa-ee03bc074189','6eba4ae3-7721-4530-b6d6-99316d19e179','6134cc6c-c1b3-4844-af16-9287429cfce2');
DELETE FROM fda_curacao_agency_costs WHERE project_id IN ('eaabc784-bd4e-42ad-88aa-ee03bc074189','6eba4ae3-7721-4530-b6d6-99316d19e179','6134cc6c-c1b3-4844-af16-9287429cfce2');
DELETE FROM fda_email_drafts WHERE project_id IN ('eaabc784-bd4e-42ad-88aa-ee03bc074189','6eba4ae3-7721-4530-b6d6-99316d19e179','6134cc6c-c1b3-4844-af16-9287429cfce2');
DELETE FROM fda_curacao_projects WHERE project_id IN ('eaabc784-bd4e-42ad-88aa-ee03bc074189','6eba4ae3-7721-4530-b6d6-99316d19e179','6134cc6c-c1b3-4844-af16-9287429cfce2');
