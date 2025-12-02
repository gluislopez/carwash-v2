-- ARREGLO ESPECÍFICO PARA burgosemanuelle@gmail.com

-- 1. Intentar vincular si ya existe
UPDATE employees
SET user_id = (SELECT id FROM auth.users WHERE email = 'burgosemanuelle@gmail.com')
WHERE email = 'burgosemanuelle@gmail.com';

-- 2. Si no existe, crearlo (Insertar)
INSERT INTO employees (name, email, phone, role, position, user_id)
SELECT 
    'Burgos Emanuelle', -- Nombre temporal
    'burgosemanuelle@gmail.com',
    '000-000-0000',
    'employee',
    'Lavador',
    id -- ID del usuario de auth
FROM auth.users 
WHERE email = 'burgosemanuelle@gmail.com'
AND NOT EXISTS (SELECT 1 FROM employees WHERE email = 'burgosemanuelle@gmail.com');

SELECT * FROM employees WHERE email = 'burgosemanuelle@gmail.com';
