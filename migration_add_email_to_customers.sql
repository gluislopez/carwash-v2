-- Add email column to customers table if it doesn't exist
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email TEXT;

-- Notify PostgREST to reload schema cache (usually happens automatically on DDL, but good to know)
NOTIFY pgrst, 'reload config';
