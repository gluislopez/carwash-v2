-- Migration: Add started_at column to transactions table
-- This allows tracking "Wait Time" (created_at -> started_at) vs "Wash Time" (started_at -> finished_at)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'started_at') THEN
        ALTER TABLE transactions ADD COLUMN started_at TIMESTAMPTZ;
    END IF;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
