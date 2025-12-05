-- Add is_active column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Update existing records to be active (just in case)
UPDATE employees SET is_active = TRUE WHERE is_active IS NULL;
