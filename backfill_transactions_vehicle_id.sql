-- BACKFILL TRANSACTIONS
-- Now that we have vehicles, let's update the past transactions that are missing the vehicle_id.

UPDATE transactions
SET vehicle_id = vehicles.id
FROM vehicles
WHERE transactions.customer_id = vehicles.customer_id
AND transactions.vehicle_id IS NULL;

-- Verify how many were updated
-- (This is just a check, no output needed unless running in a client that shows affected rows)
