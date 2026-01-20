-- MIGRATE POINTS TO VEHICLES (SIMPLE & EFFECTIVE)
-- This script copies the points from the "Customer" profile to ALL their vehicles.
-- It ensures that if you had 5 points, your cars now show 5 points.

UPDATE vehicles v
SET 
    points = c.points,
    redeemed_coupons = c.redeemed_coupons
FROM customers c
WHERE v.customer_id = c.id
AND (c.points > 0 OR c.redeemed_coupons > 0) -- Only if there are points to move
AND v.points = 0; -- Only update vehicles that haven't started earning their own points yet

-- Notify success
DO $$
DECLARE
    row_count integer;
BEGIN
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Points synced for % vehicles.', row_count;
END $$;
