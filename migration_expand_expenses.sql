-- Migration to expand expense categories
-- Purpose: Allow Rent, Utilities, Payroll, etc. instead of just 'product' and 'lunch'.

-- 1. Drop existing check constraint if it exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_category_check') THEN 
        ALTER TABLE expenses DROP CONSTRAINT expenses_category_check; 
    END IF; 
END $$;

-- 2. (Optional) We could add a new validaton, but for now we will rely on the application layer 
-- to allow flexibility (e.g. 'custom' categories in the future).
-- valid categories will be managed in frontend: 
-- 'product', 'lunch', 'salary', 'rent', 'utilities', 'maintenance', 'marketing', 'other'
