-- ENABLE PUBLIC ACCESS FOR BUSINESS SETTINGS
-- This is required for the Customer Portal to fetch the 'is_open' status and 'business_name'
-- without requiring the user to be logged in.

ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view business settings" 
ON business_settings 
FOR SELECT 
TO anon 
USING (true);
