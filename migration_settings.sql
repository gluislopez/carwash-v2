-- Create settings table for app configuration
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default daily target
INSERT INTO settings (key, value)
VALUES ('daily_target', '10')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read settings
CREATE POLICY "Enable read access for all users" ON settings
    FOR SELECT USING (true);

-- Policy: Only admins can update settings
-- Note: We use a subquery to check if the user is an admin in the employees table
CREATE POLICY "Enable update for admins only" ON settings
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT user_id FROM employees WHERE role = 'admin'
        )
    ) WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM employees WHERE role = 'admin'
        )
    );

-- Policy: Only admins can insert (if needed)
CREATE POLICY "Enable insert for admins only" ON settings
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM employees WHERE role = 'admin'
        )
    );
