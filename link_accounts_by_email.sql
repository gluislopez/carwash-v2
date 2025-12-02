-- SCRIPT DE VINCULACIÓN AUTOMÁTICA (MEJORADO)
-- Usa LOWER() para ignorar mayúsculas/minúsculas en los emails.

UPDATE employees
SET user_id = users.id
FROM auth.users
WHERE LOWER(employees.email) = LOWER(users.email)
AND employees.user_id IS NULL;

SELECT 'Cuentas vinculadas (ignorando mayúsculas) exitosamente' as mensaje;
