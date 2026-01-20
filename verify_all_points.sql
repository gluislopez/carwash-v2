-- VERIFICAR TODOS LOS CLIENTES
-- Este script busca clientes que tengan puntos (> 0) pero cuyos vehículos tengan 0 puntos.
-- Si el resultado está VACÍO, significa que todos se migraron correctamente.

SELECT 
    c.id, 
    c.name as "Cliente", 
    v.plate as "Vehículo", 
    c.points as "Puntos Cliente (Legacy)", 
    v.points as "Puntos Vehículo (Nuevo)"
FROM customers c
JOIN vehicles v ON v.customer_id = c.id
WHERE c.points > 0 
AND v.points = 0;

-- Nota: Si sale alguna fila, ejecuta de nuevo el script 'migrate_points_to_vehicles.sql'
