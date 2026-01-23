SELECT v.id, v.brand, v.model, v.plate, v.customer_id, c.name, v.points
FROM vehicles v
JOIN customers c ON v.customer_id = c.id
WHERE c.name ILIKE '%Marco%';
