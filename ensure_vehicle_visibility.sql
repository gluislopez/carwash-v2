
-- Force enable RLS but add permissive policies for reading
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting policies
DROP POLICY IF EXISTS "Enable read access for all users" ON vehicles;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON vehicles;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON vehicles;

-- Create a blanket read policy for authenticated users
CREATE POLICY "Enable all for authenticated users" ON vehicles
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Also ensure customers table is readable (just in case)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON customers;
CREATE POLICY "Enable all for authenticated users" ON customers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
