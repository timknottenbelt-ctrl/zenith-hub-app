-- The FDA Curacao email composer's "Add Extra Attachment" button uploads to the
-- `fda-attachments` bucket, which was never provisioned — so the upload failed
-- with "Bucket not found". Create it with an open policy (anon key), matching the
-- other public buckets used by the app.
insert into storage.buckets (id, name, public)
values ('fda-attachments', 'fda-attachments', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'objects' and policyname = 'fda_attachments_all'
  ) then
    create policy fda_attachments_all on storage.objects
      for all
      using (bucket_id = 'fda-attachments')
      with check (bucket_id = 'fda-attachments');
  end if;
end $$;
