-- MIGRATION: PRIVATE FEEDBACK SYSTEM
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS customer_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

-- Public can insert (anon users)
DROP POLICY IF EXISTS "Public can insert feedback" ON customer_feedback;
CREATE POLICY "Public can insert feedback" ON customer_feedback FOR INSERT WITH CHECK (true);

-- Authenticated (Admin/Manager) can select
DROP POLICY IF EXISTS "Admins/Managers can see feedback" ON customer_feedback;
CREATE POLICY "Admins/Managers can see feedback" ON customer_feedback 
FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM employees 
        WHERE user_id = auth.uid() 
        AND (role = 'admin' OR role = 'manager')
    )
);
