-- Sync Roles with Positions
-- 1. Promote all 'Gerente' to 'manager' (unless they are already admin)
UPDATE employees 
SET role = 'manager' 
WHERE position = 'Gerente' AND role != 'admin';

-- 2. Demote everyone else to 'employee' (unless they are admin)
UPDATE employees 
SET role = 'employee' 
WHERE position != 'Gerente' AND role != 'admin';

-- 3. Verify the results
SELECT name, position, role FROM employees;
