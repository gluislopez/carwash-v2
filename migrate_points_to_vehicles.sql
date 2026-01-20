-- Migrate existing points from customers to their most recently used vehicle
-- This ensures customers don't lose their points after the "per-vehicle" update.

-- 1. Update points for the most recent vehicle of each customer
WITH latest_vehicles AS (
    SELECT DISTINCT ON (customer_id) 
        vehicle_id, 
        customer_id
    FROM transactions
    WHERE customer_id IS NOT NULL 
      AND vehicle_id IS NOT NULL
    ORDER BY customer_id, created_at DESC
)
UPDATE vehicles v
SET 
    points = c.points,
    redeemed_coupons = c.redeemed_coupons
FROM customers c
JOIN latest_vehicles lv ON lv.customer_id = c.id
WHERE v.id = lv.vehicle_id;

-- 2. Optional: If a vehicle has no transactions but is the only one for a customer
UPDATE vehicles v
SET 
    points = c.points,
    redeemed_coupons = c.redeemed_coupons
FROM customers c
WHERE v.customer_id = c.id 
  AND v.points = 0 
  AND (SELECT count(*) FROM vehicles WHERE customer_id = c.id) = 1;

-- This script moves the "customer-wide" points to the primary vehicle.
