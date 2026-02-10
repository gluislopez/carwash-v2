-- Create bucket 'branding' if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('branding', 'branding', true) 
ON CONFLICT (id) DO NOTHING;

-- Policies for 'branding' bucket (assuming storage.objects RLS is enabled)
-- Only allow authenticated users (admin/employees) to upload/update
create policy "Authenticated Branding Uploads"
on storage.objects for insert
with check ( bucket_id = 'branding' and auth.role() = 'authenticated' );

create policy "Authenticated Branding Updates"
on storage.objects for update
with check ( bucket_id = 'branding' and auth.role() = 'authenticated' );

create policy "Public Branding Read"
on storage.objects for select
using ( bucket_id = 'branding' );

-- Insert default settings into business_settings table
INSERT INTO business_settings (setting_key, setting_value) 
VALUES 
    ('business_name', 'Express CarWash'),
    ('business_logo_url', '/logo.jpg') -- pointing to public folder by default
ON CONFLICT (setting_key) DO NOTHING;
