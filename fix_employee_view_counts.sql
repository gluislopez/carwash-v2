-- Fix RLS to allow employees to see transactions they are assigned to (even if not primary)

-- 1. Drop existing restrictive policy
DROP POLICY IF EXISTS "Ver propias ventas" ON transactions;

-- 2. Create comprehensive policy
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
);

-- Notify to reload schema cache
NOTIFY pgrst, 'reload config';
