-- Add column to track how many 5-visit coupons have been redeemed
ALTER TABLE customers 
ADD COLUMN redeemed_coupons INTEGER DEFAULT 0;

-- Ensure public access to this column (policy update if needed, but usually strictly typed columns are fine if table checks pass)
-- Just in case, grant update to authenticated users if RLS is strict
-- (Assuming existing RLS policies cover 'update' for staff)
