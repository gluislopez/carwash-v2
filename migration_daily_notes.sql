-- Create daily_notes table
CREATE TABLE IF NOT EXISTS daily_notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE, -- The business date of the note
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE daily_notes ENABLE ROW LEVEL SECURITY;

-- Policies
-- Authenticated users can read all notes (or maybe just admin? User said "yo pueda añadir", implies admin).
-- Let's allow all authenticated to read, but only admin/manager to write? 
-- Or maybe employees can add notes too (e.g. "Something broke").
-- Let's allow all authenticated to INSERT and SELECT.

CREATE POLICY "Enable read access for authenticated users" ON daily_notes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert access for authenticated users" ON daily_notes
    FOR INSERT TO authenticated WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for admins" ON daily_notes
    FOR DELETE TO authenticated USING (
        EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin')
    );
