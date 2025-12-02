-- Add 'tip' column to transactions table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'tip') THEN
        ALTER TABLE transactions ADD COLUMN tip DECIMAL(10, 2) DEFAULT 0;
    END IF;
END $$;
