-- CLEANUP DUPLICATE MEMBERSHIP SALES AND ROBUSTIFY TRIGGER
-- Run this in the Supabase SQL Editor

-- 1. DELETE DUPLICATE TRANSACTIONS
-- Keeps the oldest entry for a membership sale on a given day for the same customer
DELETE FROM transactions t1
USING transactions t2
WHERE t1.id > t2.id
  AND t1.customer_id = t2.customer_id
  AND (
    t1.payment_method = 'membership_sale' 
    OR (t1.extras->0->>'description') LIKE 'VENTA MEMBRESÍA%'
  )
  AND (
    t2.payment_method = 'membership_sale' 
    OR (t2.extras->0->>'description') LIKE 'VENTA MEMBRESÍA%'
  )
  AND t1.created_at::date = t2.created_at::date;

-- 2. ADD UNIQUE CONSTRAINT TO CUSTOMER_MEMBERSHIPS
-- This prevents a customer from having multiple membership records
-- (Note: If you already have duplicates in customer_memberships, this command will fail until you clean them up)
-- To clean them first: 
-- DELETE FROM customer_memberships c1 USING customer_memberships c2 WHERE c1.id > c2.id AND c1.customer_id = c2.customer_id;

ALTER TABLE customer_memberships DROP CONSTRAINT IF EXISTS customer_memberships_customer_id_key;
ALTER TABLE customer_memberships ADD CONSTRAINT customer_memberships_customer_id_key UNIQUE (customer_id);

-- 3. UPDATED ROBUST TRIGGER
-- This version checks for existing transactions before inserting, 
-- and uses 'membership_sale' for consistency.

CREATE OR REPLACE FUNCTION public.record_membership_sale()
RETURNS TRIGGER AS $$
DECLARE
    plan_price DECIMAL;
    plan_name TEXT;
    admin_emp_id UUID;
BEGIN
    -- Only act on activation (New active or change to active)
    IF (TG_OP = 'INSERT' AND NEW.status = 'active') OR (TG_OP = 'UPDATE' AND OLD.status != 'active' AND NEW.status = 'active') THEN
        
        -- Get membership details
        SELECT price, name INTO plan_price, plan_name 
        FROM memberships 
        WHERE id = NEW.membership_id;

        -- Find an admin to satisfy foreign key (if nullable, use NULL, but better to have an owner)
        SELECT id INTO admin_emp_id FROM employees WHERE role = 'admin' LIMIT 1;

        -- Check if a transaction already exists for this customer on this day to avoid duplicates
        IF NOT EXISTS (
            SELECT 1 FROM transactions 
            WHERE customer_id = NEW.customer_id 
            AND (payment_method = 'membership_sale' OR (extras->0->>'description') LIKE ('%VENTA MEMBRESÍA: ' || plan_name || '%'))
            AND created_at::date = CURRENT_DATE
        ) THEN
            INSERT INTO transactions (
                customer_id,
                employee_id,
                price,
                total_price,
                payment_method,
                status,
                created_at,
                service_id,
                commission_amount,
                tip,
                extras
            ) VALUES (
                NEW.customer_id,
                admin_emp_id,
                plan_price,
                plan_price,
                'membership_sale',
                'paid',
                now(),
                NULL,
                0,
                0,
                jsonb_build_array(jsonb_build_object('description', 'VENTA MEMBRESÍA: ' || plan_name, 'price', plan_price))
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-establish the trigger
DROP TRIGGER IF EXISTS tr_record_membership_sale ON customer_memberships;
CREATE TRIGGER tr_record_membership_sale
AFTER INSERT OR UPDATE ON customer_memberships
FOR EACH ROW EXECUTE FUNCTION record_membership_sale();
