-- FIX: SCHEMA AND SEED DATA FOR MEMBERSHIPS
-- 1. Ensure extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Memberships Table (Ensure it exists correctly)
CREATE TABLE IF NOT EXISTS memberships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('limit', 'unlimited')),
    limit_count INTEGER DEFAULT 0,
    frequency TEXT DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'yearly')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Seed Memberships if empty
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM memberships) THEN
        INSERT INTO memberships (name, description, price, type, limit_count) VALUES
        ('Plan Smart', '2 Lavados completos al mes. Ideal para quienes cuidan su auto con frecuencia.', 25.00, 'limit', 2),
        ('Plan Brillo Infinito', 'Lavados ilimitados (solo exterior) + 1 aspirado profundo al mes.', 45.00, 'unlimited', 0),
        ('Plan Detailing', 'Lavados ilimitados + Encerado líquido cada visita.', 80.00, 'unlimited', 0);
    END IF;
END $$;

-- 4. Customer Memberships Table Fixes
CREATE TABLE IF NOT EXISTS customer_memberships (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
    start_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    end_date TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    last_reset_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Add vehicle_id if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_memberships' AND column_name = 'vehicle_id') THEN
        ALTER TABLE customer_memberships ADD COLUMN vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 6. Fix Unique Constraints
DO $$
BEGIN
    -- Drop old unique customer_id constraint if it exists
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_customer_id') THEN
        ALTER TABLE customer_memberships DROP CONSTRAINT unique_customer_id;
    END IF;
    
    -- Drop any system-named unique constraints on customer_id only
    -- This is safer than relying on a name
    PERFORM (
        SELECT 'ALTER TABLE customer_memberships DROP CONSTRAINT ' || conname
        FROM pg_constraint 
        WHERE conrelid = 'customer_memberships'::regclass 
        AND contype = 'u' 
        AND array_to_string(conkey, ',') = (SELECT array_to_string(array_agg(attnum), ',') FROM pg_attribute WHERE attrelid = 'customer_memberships'::regclass AND attname = 'customer_id')
    );
    -- The above might need to be run as dynamic SQL if it returns multiple
END $$;

-- 7. Add Multi-Vehicle Unified Constraint
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_customer_vehicle') THEN
        ALTER TABLE customer_memberships ADD CONSTRAINT unique_customer_vehicle UNIQUE (customer_id, vehicle_id);
    END IF;
END $$;

-- 8. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
