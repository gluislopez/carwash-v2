-- MASTER FIX FOR RLS (Run this to fix all visibility issues)

-- 1. EMPLOYEES TABLE (Directory needs to be visible to all authenticated users)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver empleados" ON employees;
CREATE POLICY "Ver empleados" ON employees FOR SELECT TO authenticated USING (true);

-- 2. TRANSACTION ASSIGNMENTS (Needed for commission calculations and visibility)
ALTER TABLE transaction_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver asignaciones" ON transaction_assignments;
CREATE POLICY "Ver asignaciones" ON transaction_assignments FOR SELECT TO authenticated USING (true);

-- 3. TRANSACTIONS (The core issue)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver propias ventas" ON transactions;
DROP POLICY IF EXISTS "Admin ve todo" ON transactions;
DROP POLICY IF EXISTS "Registrar ventas" ON transactions;

-- Policy: Employees see transactions where they are Primary OR Assigned
CREATE POLICY "Ver propias ventas" ON transactions FOR SELECT TO authenticated
USING (
    -- Case A: Primary Employee (Legacy/Main)
    employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid())
    OR
    -- Case B: Assigned via Transaction Assignments (Multi-employee)
    id IN (
        SELECT transaction_id
        FROM transaction_assignments ta
        JOIN employees e ON ta.employee_id = e.id
        WHERE e.user_id = auth.uid()
    )
    OR
    -- Case C: Admin sees everything
    EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin')
);

-- Policy: Allow Insert (Validation handled by App/FK)
CREATE POLICY "Registrar ventas" ON transactions FOR INSERT TO authenticated
WITH CHECK (true);

-- Policy: Admin can Update/Delete
CREATE POLICY "Admin gestiona" ON transactions FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin'));

-- Notify to reload schema cache
NOTIFY pgrst, 'reload config';
