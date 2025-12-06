-- Create inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    quantity NUMERIC DEFAULT 0,
    unit TEXT DEFAULT 'Unidades',
    min_threshold INTEGER DEFAULT 5,
    cost_per_unit NUMERIC DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create inventory_logs table
CREATE TABLE IF NOT EXISTS inventory_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    change_amount NUMERIC NOT NULL,
    reason TEXT,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

-- Policies for inventory_items
CREATE POLICY "Enable read access for all authenticated users" ON inventory_items
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable write access for managers and admins" ON inventory_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

-- Policies for inventory_logs
CREATE POLICY "Enable read access for managers and admins" ON inventory_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

CREATE POLICY "Enable insert access for managers and admins" ON inventory_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );
