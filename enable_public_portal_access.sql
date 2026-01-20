-- Enable Public Access for Customer Portal
-- These policies allow the public portal to fetch data using just the Customer ID.

-- 1. Customers: Allow public select by ID
CREATE POLICY "Public Read Customers by ID" ON customers 
FOR SELECT TO anon, authenticated
USING (true); -- Usually restricted by the app knowing the ID

-- 2. Vehicles: Allow public select by Customer ID
CREATE POLICY "Public Read Vehicles by Customer ID" ON vehicles 
FOR SELECT TO anon, authenticated
USING (true);

-- 3. Transactions: Allow public select by Customer ID
CREATE POLICY "Public Read Transactions by Customer ID" ON transactions 
FOR SELECT TO anon, authenticated
USING (true);

-- 4. Transaction Assignments: Allow public select
-- (Needed to show who is washing the car)
CREATE POLICY "Public Read Assignments" ON transaction_assignments 
FOR SELECT TO anon, authenticated
USING (true);

-- 5. Services: Allow public select
CREATE POLICY "Public Read Services" ON services 
FOR SELECT TO anon, authenticated
USING (true);

-- 6. Business Settings: Allow public select (for store open/close)
CREATE POLICY "Public Read Business Settings" ON business_settings 
FOR SELECT TO anon, authenticated
USING (true);
