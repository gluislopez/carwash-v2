-- SCRIPT DE VINCULACIÓN AUTOMÁTICA
-- Ejecuta esto para conectar los usuarios registrados con sus perfiles de empleado usando el email.

UPDATE employees
SET user_id = users.id
FROM auth.users
WHERE employees.email = users.email
AND employees.user_id IS NULL;

SELECT 'Cuentas vinculadas exitosamente' as mensaje;
