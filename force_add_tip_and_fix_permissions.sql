-- Force add 'tip' column and fix permissions
BEGIN;

-- 1. Add 'tip' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'tip') THEN
        ALTER TABLE transactions ADD COLUMN tip DECIMAL(10, 2) DEFAULT 0;
    END IF;
END $$;

-- 2. Ensure permissions are correct for the new column
GRANT ALL ON transactions TO authenticated;
GRANT ALL ON transactions TO service_role;

-- 3. Force schema cache reload (optional but good practice)
NOTIFY pgrst, 'reload schema';

COMMIT;
