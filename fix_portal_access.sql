-- FIX: RESTORE PUBLIC ACCESS TO PORTAL (FULLY ROBUST)
-- This version explicitly DROPS all policies before creating them to avoid "already exists" errors.

-- 1. VEHICLES
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON vehicles;
DROP POLICY IF EXISTS "Public Read Vehicles" ON vehicles;
DROP POLICY IF EXISTS "Public Read Vehicles by Customer ID" ON vehicles; -- Potential old name
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
DROP POLICY IF EXISTS "Public Read Customers by ID" ON customers; -- Potential old name
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
DROP POLICY IF EXISTS "Public Read Transactions by Customer ID" ON transactions; -- Potential old name

CREATE POLICY "Public Read Transactions" ON transactions
    FOR SELECT TO anon, authenticated
    USING (true);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
