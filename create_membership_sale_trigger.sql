-- TRIGGER TO AUTOMATICALLY RECORD MEMBERSHIP SALE IN TRANSACTIONS
-- This ensures that whenever a membership is assigned, a financial record is created
-- even if the frontend fails or is bypassed.

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

    -- 2. If price is found and it's a NEW membership or a status change to active
    -- Or simply every time a record is UPSERTED (handling changes)
    -- But to avoid duplicates, we check if a transaction for this customer/membership/today exists
    IF NOT EXISTS (
        SELECT 1 FROM transactions 
        WHERE customer_id = NEW.customer_id 
        AND service_id IS NULL 
        AND (extras->0->>'description') LIKE ('%VENTA MEMBRESÍA: ' || plan_name || '%')
        AND date::date = CURRENT_DATE
    ) THEN
        INSERT INTO transactions (
            customer_id,
            price,
            total_price,
            payment_method,
            status,
            date,
            service_id,
            extras
        ) VALUES (
            NEW.customer_id,
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

DROP TRIGGER IF EXISTS tr_record_membership_sale ON customer_memberships;
CREATE TRIGGER tr_record_membership_sale
AFTER INSERT OR UPDATE ON customer_memberships
FOR EACH ROW
WHEN (NEW.status = 'active')
EXECUTE FUNCTION public.record_membership_sale();
