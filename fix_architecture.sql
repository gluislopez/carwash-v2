-- 1. Deshabilitar seguridad temporalmente
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar la restricción vieja (que apuntaba a auth.users)
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_employee_id_fkey;

-- 3. MIGRACIÓN DE DATOS: Convertir Auth IDs a Employee IDs
-- (Esto es crucial para no perder el historial)
UPDATE transactions t
SET employee_id = e.id
FROM employees e
WHERE t.employee_id = e.user_id;

-- 4. Asignar huérfanos al Admin (si quedó alguno suelto)
UPDATE transactions
SET employee_id = (SELECT id FROM employees WHERE email = 'gluislopez@gmail.com' LIMIT 1)
WHERE employee_id NOT IN (SELECT id FROM employees);

-- 5. Crear la NUEVA restricción (apuntando a employees.id)
ALTER TABLE transactions
ADD CONSTRAINT transactions_employee_id_fkey
FOREIGN KEY (employee_id)
REFERENCES employees(id);

-- 6. Actualizar RLS (Ahora usando IDs de empleados)
DROP POLICY IF EXISTS "Ver propias ventas" ON transactions;
DROP POLICY IF EXISTS "Admin ve todo" ON transactions;
DROP POLICY IF EXISTS "Registrar ventas" ON transactions;
DROP POLICY IF EXISTS "Admin edita y borra" ON transactions;
DROP POLICY IF EXISTS "Admin borra" ON transactions;

-- Empleados ven sus ventas (comparando employee_id de la tabla con SU employee_id)
CREATE POLICY "Ver propias ventas" ON transactions FOR SELECT TO authenticated
USING (
  employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
);

-- Admin ve todo
CREATE POLICY "Admin ve todo" ON transactions FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin')
);

-- Registrar ventas (el employee_id debe ser el suyo O cualquiera si es admin)
CREATE POLICY "Registrar ventas" ON transactions FOR INSERT TO authenticated
WITH CHECK (
  -- Si es admin, puede insertar cualquier employee_id
  (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'))
  OR
  -- Si no es admin, solo su propio employee_id
  (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()))
);

-- Admin edita/borra
CREATE POLICY "Admin edita y borra" ON transactions FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin borra" ON transactions FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'));

-- 7. Reactivar seguridad
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
