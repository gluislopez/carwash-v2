-- Fix RLS policies for vehicles table
-- The app is receiving 0 vehicles, likely due to missing read permissions.

-- 1. Enable RLS (good practice, though likely already on)
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts (optional but safer for a "fix" script)
DROP POLICY IF EXISTS "Enable read access for all users" ON vehicles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON vehicles;
DROP POLICY IF EXISTS "Enable all for authenticated users" ON vehicles;

-- 3. Create a permissive policy for authenticated users
CREATE POLICY "Enable all for authenticated users" ON vehicles
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
