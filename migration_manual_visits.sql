-- Add manual_visit_count column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS manual_visit_count INTEGER DEFAULT 0;

-- Comment on column
COMMENT ON COLUMN customers.manual_visit_count IS 'Manual adjustment for visit count to correct historical data or add offline visits.';
