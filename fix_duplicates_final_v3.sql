-- SOLUCIÓN DEFINITIVA DE DUPLICADOS (V3)
-- El error PGRST116 confirma que tienes MÁS DE UN empleado conectado a tu usuario.
-- Vamos a borrar los "gemelos malvados" y dejar solo el original que tiene las ventas.

-- 1. Borrar todos los empleados que tengan tu email O tu usuario...
--    PERO QUE NO SEAN el empleado original (ID 177e4970...)
DELETE FROM employees
WHERE (email = 'burgosemanuelle@gmail.com' OR user_id = 'b00babb2-953e-4acf-96a8-1e9ab974aa8f')
AND id != '177e4970-1423-4586-a8af-2f883787803e';

-- 2. Asegurarnos que el original tenga los datos correctos
UPDATE employees
SET 
    user_id = 'b00babb2-953e-4acf-96a8-1e9ab974aa8f',
    email = 'burgosemanuelle@gmail.com',
    name = 'Burgos Emanuelle'
WHERE id = '177e4970-1423-4586-a8af-2f883787803e';

-- 3. Verificación: DEBE SALIR SOLO UNA FILA
SELECT * FROM employees WHERE user_id = 'b00babb2-953e-4acf-96a8-1e9ab974aa8f';
