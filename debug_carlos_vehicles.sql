SELECT * FROM vehicles WHERE customer_id IN (SELECT id FROM customers WHERE name ILIKE '%Carlos Rodriguez%');
