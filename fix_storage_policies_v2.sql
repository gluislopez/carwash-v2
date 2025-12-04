-- 1. Create the 'receipts' bucket MANUALLY in Supabase Dashboard > Storage
-- Then run this script to set up permissions.

-- Drop existing policies to avoid conflicts
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Authenticated Uploads" on storage.objects;
drop policy if exists "Authenticated Updates" on storage.objects;
drop policy if exists "Public Select Receipts" on storage.objects;
drop policy if exists "Auth Insert Receipts" on storage.objects;
drop policy if exists "Auth Update Receipts" on storage.objects;

-- Create robust policies

-- 1. Allow Public Read Access (so WhatsApp links work)
create policy "Public Select Receipts"
on storage.objects for select
using ( bucket_id = 'receipts' );

-- 2. Allow Authenticated Uploads
create policy "Auth Insert Receipts"
on storage.objects for insert
with check ( bucket_id = 'receipts' and auth.role() = 'authenticated' );

-- 3. Allow Authenticated Updates
create policy "Auth Update Receipts"
on storage.objects for update
with check ( bucket_id = 'receipts' and auth.role() = 'authenticated' );

-- 4. Allow Authenticated Deletes (Optional, but good for cleanup)
create policy "Auth Delete Receipts"
on storage.objects for delete
using ( bucket_id = 'receipts' and auth.role() = 'authenticated' );
