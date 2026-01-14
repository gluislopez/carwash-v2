-- Enhance memberships with billing cycle info
ALTER TABLE customer_memberships 
ADD COLUMN IF NOT EXISTS next_billing_date DATE DEFAULT (CURRENT_DATE + INTERVAL '1 month'),
ADD COLUMN IF NOT EXISTS last_payment_date DATE DEFAULT CURRENT_DATE;

-- Table to log membership payments
CREATE TABLE IF NOT EXISTS subscription_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'success',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage subscription_payments" ON subscription_payments FOR ALL TO authenticated USING (true);

-- Function to handle monthly reset of usage_count (logic layer)
-- For now, we will rely on UI logic or a future cron if needed.
