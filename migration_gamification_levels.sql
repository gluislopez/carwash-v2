-- Create gamification_levels table
CREATE TABLE IF NOT EXISTS gamification_levels (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    min_xp INTEGER NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#94a3b8',
    icon TEXT NOT NULL DEFAULT 'Trophy',
    reward TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default levels
INSERT INTO gamification_levels (name, min_xp, color, icon, reward) VALUES
('Novato', 0, '#94a3b8', 'Trophy', NULL),
('Lavador', 50, '#22c55e', 'Medal', NULL),
('Experto', 150, '#3b82f6', 'Star', 'Bono $20'),
('Maestro', 500, '#a855f7', 'Zap', 'Bono $50'),
('Leyenda', 1000, '#fbbf24', 'Crown', 'Bono $100')
ON CONFLICT (min_xp) DO NOTHING;

-- Enable RLS
ALTER TABLE gamification_levels ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read levels
CREATE POLICY "Enable read access for all users" ON gamification_levels
    FOR SELECT USING (true);

-- Policy: Only admins can insert/update/delete
CREATE POLICY "Enable all access for admins" ON gamification_levels
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM employees WHERE role = 'admin'
        )
    ) WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM employees WHERE role = 'admin'
        )
    );
