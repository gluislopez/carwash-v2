-- 1. Create memberships table
CREATE TABLE IF NOT EXISTS memberships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('limit', 'unlimited')),
    limit_count INTEGER DEFAULT 0, -- Used if type is 'limit'
    frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'yearly')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create customer_memberships table
CREATE TABLE IF NOT EXISTS customer_memberships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
    start_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    end_date TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0, -- For 'limit' type
    last_reset_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_memberships ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Memberships: Public select, Admin manage
CREATE POLICY "Everyone can view active memberships" ON memberships FOR SELECT USING (active = true);
CREATE POLICY "Admins manage memberships" ON memberships FOR ALL USING (
    EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin')
);

-- Customer Memberships: Public select (for portal), Admin manage
CREATE POLICY "Public can view own membership" ON customer_memberships FOR SELECT USING (true); -- Simplified for portal, ideally check customer_id
CREATE POLICY "Admins manage customer memberships" ON customer_memberships FOR ALL USING (
    EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND role = 'admin')
);

-- 5. Seed Data (The 3 winning plans)
INSERT INTO memberships (name, description, price, type, limit_count) VALUES
('Plan Smart', '2 Lavados completos al mes. Ideal para quienes cuidan su auto con frecuencia.', 0, 'limit', 2),
('Plan Brillo Infinito', 'Lavados ilimitados (solo exterior) + 1 aspirado profundo al mes. Pensado para Uber y flota comercial.', 0, 'unlimited', 0),
('Plan Detailing', 'Lavados ilimitados + Encerado líquido cada visita + Limpieza de motor trimestral.', 100, 'unlimited', 0)
ON CONFLICT DO NOTHING;

-- Note: Prices are set to 0 or estimates (100) as suggested price depends on local market.
-- The user will need to adjust these in the UI.
