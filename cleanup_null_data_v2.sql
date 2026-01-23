-- CLEANUP "null" STRINGS FROM DATABASE (SAFE VERSION)
-- This script fixes literal "null" strings that may have been saved as text.

-- 1. Fix vehicles table (These columns definitely exist)
UPDATE vehicles SET brand = NULL WHERE brand = 'null';
UPDATE vehicles SET model = NULL WHERE model = 'null';
UPDATE vehicles SET plate = NULL WHERE plate = 'null';

-- 2. Fix customers table (Safely checking if columns exist)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='vehicle_brand') THEN
        UPDATE customers SET vehicle_brand = NULL WHERE vehicle_brand = 'null';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='vehicle_model') THEN
        UPDATE customers SET vehicle_model = NULL WHERE vehicle_model = 'null';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='vehicle_plate') THEN
        UPDATE customers SET vehicle_plate = NULL WHERE vehicle_plate = 'null';
    END IF;
END $$;

-- 3. Backfill missing vehicles (Migration fallback)
-- Only runs if the legacy columns exist in the customers table.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='vehicle_plate') THEN
        INSERT INTO vehicles (customer_id, plate, brand, model, created_at)
        SELECT 
            c.id,
            c.vehicle_plate,
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='vehicle_brand') THEN c.vehicle_brand ELSE NULL END,
            CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='vehicle_model') THEN c.vehicle_model ELSE NULL END,
            NOW()
        FROM customers c
        WHERE 
            c.vehicle_plate IS NOT NULL 
            AND c.vehicle_plate != ''
            AND c.vehicle_plate != 'null'
            AND NOT EXISTS (
                SELECT 1 FROM vehicles v 
                WHERE v.customer_id = c.id 
                AND (v.plate = c.vehicle_plate)
            );
    END IF;
END $$;
