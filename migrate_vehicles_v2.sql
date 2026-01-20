-- MIGRATE VEHICLES V2 (FINAL)
-- Execute this to make the "Legacy" car appear in the portal.

INSERT INTO vehicles (customer_id, plate, brand, model, created_at)
SELECT 
    c.id,
    c.vehicle_plate,
    NULL, 
    NULL,
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

DO $$
DECLARE
    row_count integer;
BEGIN
    GET DIAGNOSTICS row_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % legacy vehicles.', row_count;
END $$;
