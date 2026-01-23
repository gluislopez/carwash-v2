BEGIN;

-- 1. Transfer Points
-- Move 2 points from Vehicle 72 to Vehicle 251 (which currently has 0)
UPDATE vehicles
SET points = points + (SELECT points FROM vehicles WHERE id = 72)
WHERE id = 251;

-- 2. Move Active Services (Service Queue)
-- This ensures the "In Process" status is not lost but transferred to the correct vehicle
UPDATE service_queue
SET vehicle_id = 251
WHERE vehicle_id = 72;

-- 3. Move Transaction History
-- If there are any completed sales for the old vehicle, move them too.
UPDATE transactions
SET vehicle_id = 251
WHERE vehicle_id = 72;

-- 4. Delete the Duplicate
-- Once everything is moved, we can safely remove the empty/duplicate vehicle
DELETE FROM vehicles WHERE id = 72;

COMMIT;
