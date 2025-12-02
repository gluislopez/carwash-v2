-- LIMPIEZA DE DUPLICADOS PARA burgosemanuelle@gmail.com

-- 1. Identificar si hay duplicados y borrarlos, dejando solo el más reciente
DELETE FROM employees
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC) as rnum
        FROM employees
        WHERE email = 'burgosemanuelle@gmail.com'
    ) t
    WHERE t.rnum > 1
);

-- 2. Asegurar que el único que queda (si existe) tenga el user_id correcto
UPDATE employees
SET user_id = (SELECT id FROM auth.users WHERE email = 'burgosemanuelle@gmail.com')
WHERE email = 'burgosemanuelle@gmail.com';

-- 3. Verificación final (Debe salir SOLO UNA FILA)
SELECT * FROM employees WHERE email = 'burgosemanuelle@gmail.com';
