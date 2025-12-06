-- MIGRATE VEHICLES FROM CUSTOMERS TABLE
-- The 'vehicles' table is empty, but 'customers' has the data.
-- This script moves that data so the new system works.

INSERT INTO vehicles (customer_id, plate, model, brand)
SELECT 
    id, 
    vehicle_plate, 
    COALESCE(vehicle_model, 'Modelo Desconocido'), 
    'Generico' -- Default brand since we don't have it in customers
FROM customers
WHERE vehicle_plate IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM vehicles v WHERE v.plate = customers.vehicle_plate
);

-- Verify the count after migration
SELECT count(*) as new_vehicle_count FROM vehicles;
