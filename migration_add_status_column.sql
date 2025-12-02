-- Add 'status' column to transactions table
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'status') THEN
        ALTER TABLE transactions ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
    END IF;
END $$;

-- Update existing transactions to 'paid' (since they were created before this feature)
UPDATE transactions SET status = 'paid' WHERE status IS NULL OR status = 'pending';

-- Ensure permissions
GRANT ALL ON transactions TO authenticated;
GRANT ALL ON transactions TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
