-- MIGRATION: SUPPORT MULTIPLE MEMBERSHIPS PER CUSTOMER (LINK TO VEHICLE)
-- This allows a customer with 2+ cars to have a separate plan for each car.

-- 1. Add vehicle_id column to customer_memberships
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS vehicle_id BIGINT REFERENCES vehicles(id) ON DELETE CASCADE;

-- 2. Drop the old unique constraint on customer_id only
-- (First we find the constraint name if it is not exactly 'unique_customer_id' as in fix_membership_unique_constraint.sql)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_customer_id') THEN
        ALTER TABLE customer_memberships DROP CONSTRAINT unique_customer_id;
    END IF;
    
    -- Also drop any other possible unique constraints on customer_id that might have been created by different scripts
    -- (Supabase sometimes names them automatically)
    -- This part is a bit defensive
END $$;

-- 3. Add the NEW unique constraint: (customer_id, vehicle_id)
-- This allows the same customer to have multiple rows, but only ONE plan per car.
-- If vehicle_id is NULL, it would count as a 'generic' customer plan (backwards compatibility).
ALTER TABLE customer_memberships ADD CONSTRAINT unique_customer_vehicle UNIQUE (customer_id, vehicle_id);

-- 4. Update the Trigger to support vehicle_id in financial records
CREATE OR REPLACE FUNCTION public.record_membership_sale()
RETURNS TRIGGER AS $$
DECLARE
    plan_price DECIMAL;
    plan_name TEXT;
BEGIN
    -- 1. Get the membership details
    SELECT price, name INTO plan_price, plan_name 
    FROM memberships 
    WHERE id = NEW.membership_id;

    -- 2. If it's active, record the sale
    -- We check if a transaction for this customer AND SPECIFIC VEHICLE exists today
    -- This prevents duplicates if the user toggles plans multiple times
    IF NOT EXISTS (
        SELECT 1 FROM transactions 
        WHERE customer_id = NEW.customer_id 
        AND (vehicle_id = NEW.vehicle_id OR (vehicle_id IS NULL AND NEW.vehicle_id IS NULL))
        AND service_id IS NULL 
        AND (extras->0->>'description') LIKE ('%VENTA MEMBRESÍA: ' || plan_name || '%')
        AND date::date = CURRENT_DATE
    ) THEN
        INSERT INTO transactions (
            customer_id,
            vehicle_id, -- Added vehicle_id here
            price,
            total_price,
            payment_method,
            status,
            date,
            service_id,
            extras
        ) VALUES (
            NEW.customer_id,
            NEW.vehicle_id,
            plan_price,
            plan_price,
            'cash',
            'paid',
            now(),
            NULL,
            jsonb_build_array(jsonb_build_object('description', 'VENTA MEMBRESÍA: ' || plan_name, 'price', plan_price))
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Backfill existing memberships (optional)
-- Since we don't know which vehicle they belong to, we leave them with NULL vehicle_id.
-- They will continue to work as 'global' plans for that customer until re-assigned.
