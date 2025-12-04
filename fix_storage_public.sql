-- DEBUG: Allow PUBLIC uploads to 'receipts' bucket
-- Use this ONLY to verify if the issue is related to Authentication/RLS.

-- 1. Ensure bucket exists (Manual step usually required, but we try)
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- 2. Drop ALL existing policies for receipts
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Authenticated Uploads" on storage.objects;
drop policy if exists "Authenticated Updates" on storage.objects;
drop policy if exists "Public Select Receipts" on storage.objects;
drop policy if exists "Auth Insert Receipts" on storage.objects;
drop policy if exists "Auth Update Receipts" on storage.objects;
drop policy if exists "Public Upload Receipts" on storage.objects;

-- 3. Create PERMISSIVE policies (Public Read/Write)
create policy "Public Select Receipts"
on storage.objects for select
using ( bucket_id = 'receipts' );

create policy "Public Upload Receipts"
on storage.objects for insert
with check ( bucket_id = 'receipts' );

-- Note: We do not allow public UPDATE/DELETE, only INSERT.
