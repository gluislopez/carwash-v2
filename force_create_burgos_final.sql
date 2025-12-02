-- SOLUCIÓN FINAL PARA burgosemanuelle@gmail.com
-- Este script borra cualquier rastro anterior y crea un empleado limpio y vinculado.

-- 1. Borrar cualquier intento anterior (para evitar duplicados o errores)
DELETE FROM employees WHERE email = 'burgosemanuelle@gmail.com';

-- 2. Insertar el empleado limpio con el ID exacto que vimos en la foto
INSERT INTO employees (name, email, phone, role, position, user_id)
VALUES (
    'Burgos Emanuelle', 
    'burgosemanuelle@gmail.com', 
    '000-000-0000', 
    'employee', 
    'Lavador', 
    'b00babb2-953e-4acf-96a8-1e9ab974aa8f' -- ID copiado de tu captura
);

-- 3. Confirmar que se creó
SELECT * FROM employees WHERE email = 'burgosemanuelle@gmail.com';
