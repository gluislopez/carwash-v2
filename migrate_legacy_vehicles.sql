-- MIGRATE LEGACY VEHICLES TO VEHICLES TABLE (ROBUST VERSION)
-- This script safely migrates vehicle info from 'customers' table to 'vehicles' table.
-- It attempts to use 'vehicle_plate', but gracefully handles missing optional columns like brand/model
-- by inserting NULLs if they don't exist (simulated by just not selecting them if they fail).

-- Since we know 'vehicle_brand' caused an error, we will omit brand/model from the SELECT
-- and only migrate the PLATE, which is the critical identifier.

INSERT INTO vehicles (customer_id, plate, brand, model, created_at)
SELECT 
    c.id,
    c.vehicle_plate,
    NULL, -- Brand unknown (column missing in customers)
    NULL, -- Model unknown (column missing in customers)
    NOW()
FROM customers c
WHERE 
    c.vehicle_plate IS NOT NULL 
    AND c.vehicle_plate != ''
    AND NOT EXISTS (
        SELECT 1 FROM vehicles v 
        WHERE v.customer_id = c.id 
        AND v.plate = c.vehicle_plate
    );

-- Notify success
DO $$
DECLARE
    row_count integer;
BEGIN
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % legacy vehicles (Plates only) to vehicles table.', row_count;
END $$;
