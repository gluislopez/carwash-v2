-- FIX: Add vehicle_id column to transactions table and reload schema cache

-- 1. Add vehicle_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'vehicle_id') THEN
        ALTER TABLE transactions ADD COLUMN vehicle_id BIGINT REFERENCES vehicles(id);
    END IF;
END $$;

-- 2. Reload PostgREST schema cache (Crucial for Supabase API to see the new column)
NOTIFY pgrst, 'reload schema';
