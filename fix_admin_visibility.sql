-- Enable RLS on transactions table
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins see all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Employees see own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete transactions" ON public.transactions;

-- 1. Policy for ADMINS (See EVERYTHING)
CREATE POLICY "Admins see all transactions"
ON public.transactions
FOR ALL
USING (
  auth.uid() IN (
    SELECT user_id FROM public.employees WHERE role = 'admin'
  )
);

-- 2. Policy for EMPLOYEES (See transactions they are involved in)
-- They can see if they are the primary employee OR assigned to it.
CREATE POLICY "Employees see own transactions"
ON public.transactions
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.employees WHERE role = 'admin' -- Fallback for admins
  )
  OR
  employee_id IN (
    SELECT id FROM public.employees WHERE user_id = auth.uid()
  )
  OR
  id IN (
    SELECT transaction_id FROM public.transaction_assignments 
    WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  )
);

-- 3. Policy for INSERT (Authenticated users can create)
CREATE POLICY "Users can insert transactions"
ON public.transactions
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- 4. Policy for UPDATE (Admins or Involved Employees)
CREATE POLICY "Users can update transactions"
ON public.transactions
FOR UPDATE
USING (
  auth.uid() IN (SELECT user_id FROM public.employees WHERE role = 'admin')
  OR
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- 5. Policy for DELETE (Admins Only)
CREATE POLICY "Admins can delete transactions"
ON public.transactions
FOR DELETE
USING (
  auth.uid() IN (SELECT user_id FROM public.employees WHERE role = 'admin')
);
