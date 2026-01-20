-- VERIFICAR PUNTOS Y COLUMNAS
-- Este script verifica que la tabla de vehículos tenga la columna de puntos
-- y muestra los puntos actuales de los carros de Denitza.

-- 1. Verificar columnas de la tabla vehicles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'vehicles' 
AND column_name = 'points';

-- 2. Ver puntos de Denitza
SELECT 
    c.name as "Cliente",
    v.plate as "Placa",
    v.model as "Modelo",
    v.points as "Puntos Vehículo (Nuevo)",
    c.points as "Puntos Cliente (Total Viejo)"
FROM vehicles v
JOIN customers c ON v.customer_id = c.id
WHERE c.name ILIKE '%Denitza%';
