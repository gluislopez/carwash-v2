-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('product', 'lunch')),
    employee_id UUID REFERENCES employees(id), -- Nullable, only for lunch
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('America/Puerto_Rico'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admin can do everything
CREATE POLICY "Admins can do everything on expenses" ON expenses
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM employees 
            WHERE employees.user_id = auth.uid() 
            AND employees.role = 'admin'
        )
    );

-- Employees can view their own lunches (optional, but good for transparency)
CREATE POLICY "Employees can view their own lunches" ON expenses
    FOR SELECT
    TO authenticated
    USING (
        employee_id IN (
            SELECT id FROM employees WHERE user_id = auth.uid()
        )
    );
