-- 1. Habilitar RLS en employees (por si acaso)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 2. Limpiar políticas viejas para evitar conflictos
DROP POLICY IF EXISTS "Enable read access for all users" ON employees;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON employees;
DROP POLICY IF EXISTS "Users can read own data" ON employees;

-- 3. Crear política: Todo usuario autenticado puede LEER la tabla de empleados
-- (Necesario para que la app sepa quién es quién al cargar)
CREATE POLICY "Allow read access for authenticated users"
ON employees FOR SELECT
TO authenticated
USING (true);

-- 4. Crear política: Solo los Admins pueden MODIFICAR empleados
CREATE POLICY "Allow update for admins"
ON employees FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 5. Crear política: Solo los Admins pueden INSERTAR empleados
CREATE POLICY "Allow insert for admins"
ON employees FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- 6. Crear política: Solo los Admins pueden BORRAR empleados
CREATE POLICY "Allow delete for admins"
ON employees FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM employees
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);
