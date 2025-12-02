-- 1. Habilitar RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar políticas viejas
DROP POLICY IF EXISTS "Ver propias ventas" ON transactions;
DROP POLICY IF EXISTS "Admin ve todo" ON transactions;
DROP POLICY IF EXISTS "Registrar ventas" ON transactions;
DROP POLICY IF EXISTS "Admin edita y borra" ON transactions;
DROP POLICY IF EXISTS "Admin borra" ON transactions;

-- 3. Regla: Empleados ven SOLO lo suyo (UUID vs UUID)
CREATE POLICY "Ver propias ventas" ON transactions FOR SELECT TO authenticated
USING (employee_id = auth.uid());

-- 4. Regla: Admin ve TODO
CREATE POLICY "Admin ve todo" ON transactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'));

-- 5. Regla: Todos pueden cobrar
CREATE POLICY "Registrar ventas" ON transactions FOR INSERT TO authenticated
WITH CHECK (employee_id = auth.uid());

-- 6. Regla: Solo Admin puede editar/borrar
CREATE POLICY "Admin edita y borra" ON transactions FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin borra" ON transactions FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'));
