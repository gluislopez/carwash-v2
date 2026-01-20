-- FIX PORTAL ACCESS V2 (FINAL)
-- Execute this to fix the "Platform not working" error.
-- This script completely resets the permissions to ensure no conflicts.

-- 1. VEHICLES
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON vehicles;
DROP POLICY IF EXISTS "Public Read Vehicles" ON vehicles; 
DROP POLICY IF EXISTS "Public Read Vehicles by Customer ID" ON vehicles;
DROP POLICY IF EXISTS "Auth Write Vehicles" ON vehicles;

CREATE POLICY "Public Read Vehicles" ON vehicles
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Auth Write Vehicles" ON vehicles
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);


-- 2. CUSTOMERS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON customers;
DROP POLICY IF EXISTS "Public Read Customers" ON customers;
DROP POLICY IF EXISTS "Public Read Customers by ID" ON customers;
DROP POLICY IF EXISTS "Auth Write Customers" ON customers;

CREATE POLICY "Public Read Customers" ON customers
    FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Auth Write Customers" ON customers
    FOR ALL TO authenticated
    USING (true) WITH CHECK (true);


-- 3. TRANSACTIONS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Transactions" ON transactions;
DROP POLICY IF EXISTS "Public Read Transactions by Customer ID" ON transactions;

CREATE POLICY "Public Read Transactions" ON transactions
    FOR SELECT TO anon, authenticated
    USING (true);

NOTIFY pgrst, 'reload schema';
