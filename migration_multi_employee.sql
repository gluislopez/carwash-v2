-- MIGRACIÓN PARA SOPORTE MULTI-EMPLEADO (CORREGIDA)

-- 1. Crear tabla de asignaciones (Many-to-Many)
CREATE TABLE IF NOT EXISTS transaction_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Migrar datos existentes
INSERT INTO transaction_assignments (transaction_id, employee_id, created_at)
SELECT id, employee_id, created_at
FROM transactions
WHERE employee_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM transaction_assignments 
    WHERE transaction_id = transactions.id AND employee_id = transactions.employee_id
);

-- 3. Habilitar RLS en la nueva tabla
ALTER TABLE transaction_assignments ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Seguridad para transaction_assignments

-- Admin ve todo
DROP POLICY IF EXISTS "Admin ve todas las asignaciones" ON transaction_assignments;
CREATE POLICY "Admin ve todas las asignaciones" ON transaction_assignments
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'));

-- Empleados ven sus propias asignaciones
DROP POLICY IF EXISTS "Empleados ven sus asignaciones" ON transaction_assignments;
CREATE POLICY "Empleados ven sus asignaciones" ON transaction_assignments
FOR SELECT TO authenticated
USING (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()));

-- Permitir insertar asignaciones al crear ventas (Admin o Empleado asignado)
DROP POLICY IF EXISTS "Crear asignaciones" ON transaction_assignments;
CREATE POLICY "Crear asignaciones" ON transaction_assignments
FOR INSERT TO authenticated
WITH CHECK (true); -- La validación principal ocurre en la App y en transactions

-- 5. Actualizar políticas de transactions para usar la nueva tabla
-- (Esto permite que un empleado vea la transacción si está en la tabla de asignaciones)

DROP POLICY IF EXISTS "Ver propias ventas" ON transactions;
DROP POLICY IF EXISTS "Ver ventas asignadas" ON transactions;

CREATE POLICY "Ver ventas asignadas" ON transactions
FOR SELECT TO authenticated
USING (
    -- Si es admin
    (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'))
    OR
    -- O si está asignado a esta transacción en la tabla nueva
    (id IN (SELECT transaction_id FROM transaction_assignments WHERE employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())))
    OR
    -- (Fallback) O si es el employee_id principal (por compatibilidad)
    (employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()))
);

SELECT 'MIGRACIÓN MULTI-EMPLEADO COMPLETADA' as mensaje;
