-- DIAGNOSTICO V2: Ver estado exacto de Burgos

SELECT 
    id, 
    name, 
    email, 
    user_id, 
    created_at 
FROM employees 
WHERE email = 'burgosemanuelle@gmail.com';

-- También ver el ID del usuario Auth para comparar
SELECT id as auth_id, email as auth_email 
FROM auth.users 
WHERE email = 'burgosemanuelle@gmail.com';
