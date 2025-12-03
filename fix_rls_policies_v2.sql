-- Enable RLS on transactions table
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins see all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Employees see own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can delete transactions" ON public.transactions;

-- 1. Policy for ADMINS (See EVERYTHING)
CREATE POLICY "Admins see all transactions"
ON public.transactions
FOR ALL
USING (
  auth.uid() IN (
    SELECT user_id FROM public.employees WHERE role = 'admin'
  )
);

-- 2. Policy for EMPLOYEES (See own + WAITING list)
CREATE POLICY "Employees see own transactions"
ON public.transactions
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.employees WHERE role = 'admin' -- Fallback
  )
  OR
  status = 'waiting' -- EVERYONE can see the Waiting List
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

-- 4. Policy for UPDATE (Admins or Involved Employees or Waiting List)
-- Employees need to be able to update 'waiting' transactions to 'in_progress' (assign themselves)
CREATE POLICY "Users can update transactions"
ON public.transactions
FOR UPDATE
USING (
  auth.uid() IN (SELECT user_id FROM public.employees WHERE role = 'admin')
  OR
  status = 'waiting' -- Allow picking up waiting cars
  OR
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  OR
  id IN (
    SELECT transaction_id FROM public.transaction_assignments 
    WHERE employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
  )
);

-- 5. Policy for DELETE (Admins Only)
CREATE POLICY "Admins can delete transactions"
ON public.transactions
FOR DELETE
USING (
  auth.uid() IN (SELECT user_id FROM public.employees WHERE role = 'admin')
);
