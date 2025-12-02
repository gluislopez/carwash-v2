-- 1. Asegurar que RLS está activo
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 2. BORRADO AGRESIVO de cualquier política anterior (por si tienen nombres distintos)
DROP POLICY IF EXISTS "Enable read access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON transactions;
DROP POLICY IF EXISTS "Enable update for users based on email" ON transactions;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON transactions;
DROP POLICY IF EXISTS "Ver propias ventas" ON transactions;
DROP POLICY IF EXISTS "Admin ve todo" ON transactions;
DROP POLICY IF EXISTS "Registrar ventas" ON transactions;
DROP POLICY IF EXISTS "Admin edita y borra" ON transactions;
DROP POLICY IF EXISTS "Admin borra" ON transactions;
DROP POLICY IF EXISTS "Public read access" ON transactions;
DROP POLICY IF EXISTS "Authenticated read access" ON transactions;

-- 3. REGLA DE ORO: Empleados solo ven SU trabajo
CREATE POLICY "Ver propias ventas"
ON transactions
FOR SELECT
TO authenticated
USING (
  employee_id = auth.uid()
);

-- 4. REGLA DE ORO: Admin ve TODO
CREATE POLICY "Admin ve todo"
ON transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 5. Permitir registrar ventas (solo a su nombre)
CREATE POLICY "Registrar ventas"
ON transactions
FOR INSERT
TO authenticated
WITH CHECK (
  employee_id = auth.uid()
);

-- 6. Admin poder absoluto
CREATE POLICY "Admin edita y borra"
ON transactions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin borra"
ON transactions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
