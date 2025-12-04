-- Enable Storage Extension (if not enabled)
-- create extension if not exists "storage" schema "extensions";

-- Create a public bucket named 'receipts'
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- Policy: Allow Public Read Access
create policy "Public Access"
on storage.objects for select
using ( bucket_id = 'receipts' );

-- Policy: Allow Authenticated Uploads
create policy "Authenticated Uploads"
on storage.objects for insert
with check ( bucket_id = 'receipts' and auth.role() = 'authenticated' );

-- Policy: Allow Authenticated Updates
create policy "Authenticated Updates"
on storage.objects for update
with check ( bucket_id = 'receipts' and auth.role() = 'authenticated' );
