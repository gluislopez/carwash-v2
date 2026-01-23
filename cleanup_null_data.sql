-- CLEANUP "null" STRINGS FROM DATABASE
-- Sometimes the string "null" gets saved instead of an actual NULL value.
-- This script fixes that for vehicles and customers tables.

-- 1. Fix customers table
UPDATE customers 
SET 
  vehicle_brand = NULL 
WHERE vehicle_brand = 'null';

UPDATE customers 
SET 
  vehicle_model = NULL 
WHERE vehicle_model = 'null';

UPDATE customers 
SET 
  vehicle_plate = NULL 
WHERE vehicle_plate = 'null';

-- 2. Fix vehicles table
UPDATE vehicles 
SET 
  brand = NULL 
WHERE brand = 'null';

UPDATE vehicles 
SET 
  model = NULL 
WHERE model = 'null';

UPDATE vehicles 
SET 
  plate = NULL 
WHERE plate = 'null';

-- 3. Backfill missing vehicles (Migration fallback)
-- If a customer has legacy data but no entry in 'vehicles' table, create it.
INSERT INTO vehicles (customer_id, plate, brand, model, created_at)
SELECT 
    c.id,
    c.vehicle_plate,
    c.vehicle_brand,
    c.vehicle_model,
    NOW()
FROM customers c
WHERE 
    c.vehicle_plate IS NOT NULL 
    AND c.vehicle_plate != ''
    AND NOT EXISTS (
        SELECT 1 FROM vehicles v 
        WHERE v.customer_id = c.id 
        AND (v.plate = c.vehicle_plate OR (v.plate IS NULL AND c.vehicle_plate IS NULL))
    );
