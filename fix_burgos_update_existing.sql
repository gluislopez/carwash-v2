-- SOLUCIÓN FINAL V2 (Sin borrar, solo actualizar)
-- No podemos borrar porque ya tienes ventas registradas con este empleado.
-- Así que vamos a ACTUALIZAR el registro existente.

UPDATE employees
SET 
    user_id = 'b00babb2-953e-4acf-96a8-1e9ab974aa8f', -- Tu ID de usuario (Auth)
    email = 'burgosemanuelle@gmail.com',
    name = 'Burgos Emanuelle'
WHERE id = '177e4970-1423-4586-a8af-2f883787803e'; -- El ID que salió en el error

-- Verificación
SELECT * FROM employees WHERE email = 'burgosemanuelle@gmail.com';
