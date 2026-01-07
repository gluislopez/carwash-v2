-- Create table for global business settings
CREATE TABLE IF NOT EXISTS business_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT
);

-- Insert default status as 'true' (Open)
INSERT INTO business_settings (setting_key, setting_value) 
VALUES ('is_open', 'true') 
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so customers can see if it's open)
CREATE POLICY "Public read settings" ON business_settings FOR SELECT USING (true);

-- Allow authenticated users (staff/admin) to update settings
CREATE POLICY "Admin update settings" ON business_settings FOR ALL USING (auth.role() = 'authenticated');

-- Grant access to anon role just in case
GRANT SELECT ON business_settings TO anon;
GRANT ALL ON business_settings TO authenticated;
