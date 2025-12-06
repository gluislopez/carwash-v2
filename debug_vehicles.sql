-- DIAGNOSTIC SCRIPT
-- 1. Disable RLS completely to rule out permission issues
ALTER TABLE vehicles DISABLE ROW LEVEL SECURITY;

-- 2. Count how many vehicles are in the database
SELECT count(*) as total_vehicles FROM vehicles;

-- 3. Show the first 5 vehicles to verify data
SELECT * FROM vehicles LIMIT 5;
