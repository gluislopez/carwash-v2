-- Allow public to see which employee is working on their car
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public employees are viewable" ON employees FOR SELECT USING (true);

ALTER TABLE transaction_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public assignments are viewable" ON transaction_assignments FOR SELECT USING (true);

-- Also ensure public can read the junction table if RLS is on
GRANT SELECT ON employees TO anon;
GRANT SELECT ON transaction_assignments TO anon;
