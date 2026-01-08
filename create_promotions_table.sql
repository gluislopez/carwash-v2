-- Create table for marketing promotions
CREATE TABLE IF NOT EXISTS promotions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admins) to manage promotions
CREATE POLICY "Admin manage promotions" ON promotions FOR ALL USING (auth.role() = 'authenticated');
GRANT ALL ON promotions TO authenticated;
