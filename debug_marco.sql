-- Find customers named Marco
SELECT id, name, phone, vehicle_plate FROM customers WHERE name ILIKE '%Marco%';

-- Find vehicles for these customers
SELECT v.id, v.brand, v.model, v.plate, v.customer_id, c.name as customer_name, v.created_at
FROM vehicles v
JOIN customers c ON v.customer_id = c.id
WHERE c.name ILIKE '%Marco%';
