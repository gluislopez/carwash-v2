-- 1. Add 'position' column if it doesn't exist
ALTER TABLE employees ADD COLUMN IF NOT EXISTS position TEXT DEFAULT 'Lavador';

-- 2. Update the check constraint for 'role' to include 'manager'
-- First drop the existing constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;

-- Then add the new constraint
ALTER TABLE employees ADD CONSTRAINT employees_role_check 
CHECK (role IN ('admin', 'manager', 'employee'));

-- 3. Update RLS policies to treat 'manager' similar to 'admin' for certain things (optional, but good practice)
-- For now, we handle the critical logic in the frontend, but let's ensure managers can SEE everything if needed.
-- Actually, the requirement is just about CHARGING. Visibility is separate.
-- Let's keep RLS simple for now and rely on the frontend check for the specific action, 
-- but we might want managers to see all transactions too? 
-- The user said "gerente que asigne ese dia pueda cobrar". 
-- Implies managers need to see the transaction to charge it.
-- Let's update the "Admins see all transactions" policy to include managers.

DROP POLICY IF EXISTS "Admins see all transactions" ON transactions;
CREATE POLICY "Admins and Managers see all transactions" ON transactions 
FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM employees WHERE role IN ('admin', 'manager'))
);

-- Also update the update policy
DROP POLICY IF EXISTS "Users can update transactions" ON transactions;
CREATE POLICY "Users can update transactions" ON transactions FOR UPDATE USING (
  auth.uid() IN (SELECT user_id FROM employees WHERE role IN ('admin', 'manager')) OR
  status = 'waiting' OR
  employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()) OR
  id IN (SELECT transaction_id FROM transaction_assignments WHERE employee_id IN (SELECT id FROM employees WHERE user_id = auth.uid()))
);
