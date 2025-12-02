-- SCRIPT DE REPARACIÓN DEFINITIVA DE CLAVES FORÁNEAS

-- 1. Desactivar seguridad para poder trabajar
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar la restricción problemática (sin importar cómo se llame)
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_employee_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_employee_id_fkey1;

-- 3. MIGRACIÓN DE DATOS (CRUCIAL)
-- Si el ID en transactions coincide con un user_id de employees, lo actualizamos al ID del empleado
UPDATE transactions t
SET employee_id = e.id
FROM employees e
WHERE t.employee_id = e.user_id;

-- 4. Verificar si quedan huérfanos y asignarlos al Admin por defecto
-- (Reemplaza 'gluislopez@gmail.com' con tu email si es diferente)
UPDATE transactions
SET employee_id = (SELECT id FROM employees WHERE email = 'gluislopez@gmail.com' LIMIT 1)
WHERE employee_id NOT IN (SELECT id FROM employees);

-- 5. Crear la NUEVA restricción apuntando a la tabla 'employees'
ALTER TABLE transactions
ADD CONSTRAINT transactions_employee_id_fkey
FOREIGN KEY (employee_id)
REFERENCES employees(id);

-- 6. Reactivar seguridad
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 7. Confirmación
SELECT 'REPARACIÓN COMPLETADA EXITOSAMENTE' as mensaje;
