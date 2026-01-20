-- AGREGAR VEHÍCULO FALTANTE MANUALMENTE
-- Instrucciones:
-- 1. Reemplaza 'PONER-PLACA-AQUI' con la placa real del carro faltante (Ej: 'TYJ-923').
-- 2. Reemplaza 'PONER-MODELO-AQUI' con la marca y modelo (Ej: 'Toyota Yaris').
-- 3. Ejecuta el script.

WITH target_customer AS (
    SELECT id FROM customers WHERE name ILIKE '%Denitza%' LIMIT 1
)
INSERT INTO vehicles (customer_id, plate, brand, model, type)
SELECT 
    id, 
    'PONER-PLACA-AQUI',  -- <--- CAMBIA ESTO
    'PONER-MODELO-AQUI', -- <--- CAMBIA ESTO
    '',                  -- Modelo opcional
    'sedan'              -- Tipo por defecto
FROM target_customer
WHERE NOT EXISTS (
    SELECT 1 FROM vehicles 
    WHERE plate = 'PONER-PLACA-AQUI' -- Evita duplicados si ya intentaste correrlo
);

-- Verificación final
SELECT * FROM vehicles 
WHERE customer_id = (SELECT id FROM customers WHERE name ILIKE '%Denitza%' LIMIT 1);
