-- DEBUG SCRIPT FOR DENITZA
-- Run this to see what is stored in the database for "Denitza".
-- Please send me a screenshot of the "Results" tab after running this.

-- 1. Check for Duplicate Customers and their Legacy Car info
SELECT 
    id, 
    name, 
    phone, 
    vehicle_plate as "Placa Vieja (Legacy)", 
    vehicle_model as "Modelo Viejo"
FROM customers 
WHERE name ILIKE '%Denitza%';

-- 2. Check for Vehicles linked to her
SELECT 
    v.id, 
    v.plate, 
    v.model, 
    c.name as "Dueño"
FROM vehicles v
JOIN customers c ON v.customer_id = c.id
WHERE c.name ILIKE '%Denitza%';
