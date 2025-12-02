-- SCRIPT DE REPARACIÓN DEFINITIVA V2
-- Este script arregla el error "violates foreign key constraint" asegurando que
-- la tabla transactions apunte a la tabla EMPLOYEES, no a auth.users.

-- 1. Desactivar seguridad temporalmente
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar CUALQUIER restricción previa (por nombre)
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_employee_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_employee_id_fkey1;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS fk_transactions_employees;

-- 3. MIGRACIÓN DE DATOS (CRUCIAL)
-- Convertir Auth IDs (viejos) a Employee IDs (nuevos)
UPDATE transactions t
SET employee_id = e.id
FROM employees e
WHERE t.employee_id = e.user_id;

-- 4. Asignar huérfanos al Admin (por si acaso)
UPDATE transactions
SET employee_id = (SELECT id FROM employees WHERE email = 'gluislopez@gmail.com' LIMIT 1)
WHERE employee_id NOT IN (SELECT id FROM employees);

-- 5. Crear la NUEVA restricción con un nombre NUEVO y ÚNICO
ALTER TABLE transactions
ADD CONSTRAINT fk_transactions_employees_profile
FOREIGN KEY (employee_id)
REFERENCES employees(id);

-- 6. Actualizar RLS para usar la nueva lógica
DROP POLICY IF EXISTS "Ver propias ventas" ON transactions;
DROP POLICY IF EXISTS "Admin ve todo" ON transactions;
DROP POLICY IF EXISTS "Registrar ventas" ON transactions;

-- Empleados ven sus ventas (comparando ID de perfil)
CREATE POLICY "Ver propias ventas" ON transactions FOR SELECT TO authenticated
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- Admin ve todo
CREATE POLICY "Admin ve todo" ON transactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'));

-- Registrar ventas
CREATE POLICY "Registrar ventas" ON transactions FOR INSERT TO authenticated
WITH CHECK (true); -- La validación la hace la App y la FK

-- 7. Reactivar seguridad
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

SELECT 'REPARACIÓN EXITOSA: Ahora transactions apunta a employees(id)' as mensaje;
