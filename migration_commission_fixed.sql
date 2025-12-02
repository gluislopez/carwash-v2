-- Add 'commission' column to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS commission DECIMAL(10, 2) DEFAULT 0;

-- Migrate existing data: Calculate fixed commission from rate
UPDATE services 
SET commission = price * commission_rate 
WHERE commission IS NULL OR commission = 0;

-- Optional: You might want to drop commission_rate later, but for now we keep it or ignore it.
