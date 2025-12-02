-- Identificar y borrar duplicados para tu usuario
-- Mantenemos solo 1 registro (el primero que encuentre) y borramos el resto.

DELETE FROM employees
WHERE user_id = '1eb98a5a-c67e-478d-9261-31524845e46e'
AND id NOT IN (
    SELECT id
    FROM employees
    WHERE user_id = '1eb98a5a-c67e-478d-9261-31524845e46e'
    LIMIT 1
);

-- Verificar que solo queda uno
SELECT * FROM employees WHERE user_id = '1eb98a5a-c67e-478d-9261-31524845e46e';
