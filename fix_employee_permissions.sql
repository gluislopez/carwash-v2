-- 1. Limpiar duplicados para el usuario de iCloud (por si acaso)
DELETE FROM employees
WHERE email = 'gluislopez@icloud.com'
AND id NOT IN (
    SELECT id
    FROM employees
    WHERE email = 'gluislopez@icloud.com'
    LIMIT 1
);

-- 2. FORZAR que este usuario sea EMPLEADO (no Admin)
UPDATE employees
SET role = 'employee', position = 'Lavador'
WHERE email = 'gluislopez@icloud.com';

-- 3. Asegurar que está vinculado a su ID de usuario (si ya inició sesión)
UPDATE employees
SET user_id = (SELECT id FROM auth.users WHERE email = 'gluislopez@icloud.com')
WHERE email = 'gluislopez@icloud.com';

-- 4. RE-APLICAR RLS (Solo por seguridad extrema)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver propias ventas" ON transactions;
DROP POLICY IF EXISTS "Admin ve todo" ON transactions;
DROP POLICY IF EXISTS "Registrar ventas" ON transactions;
DROP POLICY IF EXISTS "Admin edita y borra" ON transactions;
DROP POLICY IF EXISTS "Admin borra" ON transactions;

-- Empleados ven SOLO lo suyo
CREATE POLICY "Ver propias ventas" ON transactions FOR SELECT TO authenticated
USING (employee_id = auth.uid());

-- Admin ve TODO
CREATE POLICY "Admin ve todo" ON transactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'));

-- Todos pueden cobrar
CREATE POLICY "Registrar ventas" ON transactions FOR INSERT TO authenticated
WITH CHECK (employee_id = auth.uid());

-- Admin poder absoluto
CREATE POLICY "Admin edita y borra" ON transactions FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin borra" ON transactions FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'));
