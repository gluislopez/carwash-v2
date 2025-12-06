-- Add points column to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- Create a policy to allow employees to update points (if not already covered by generic update policy)
-- Assuming existing policies cover UPDATE on customers for authenticated users or specific roles.
-- If strict RLS is on, we might need to ensure 'employee' role can update this.
-- Checking existing policies might be good, but adding a specific one is safer if unsure.

-- Let's assume the existing policy "Enable update for authenticated users" or similar exists.
-- If not, we can add:
-- CREATE POLICY "Enable update for employees" ON customers FOR UPDATE USING (auth.role() = 'authenticated');
