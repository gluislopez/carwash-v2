CREATE OR REPLACE FUNCTION public.record_membership_sale()
RETURNS TRIGGER AS $$
DECLARE
    plan_price DECIMAL;
    plan_name TEXT;
    admin_emp_id UUID;
BEGIN
    -- 1. Get the membership details
    SELECT price, name INTO plan_price, plan_name 
    FROM memberships 
    WHERE id = NEW.membership_id;

    -- 2. Find an admin employee ID to satisfy NOT NULL constraints
    SELECT id INTO admin_emp_id FROM employees WHERE role = 'admin' LIMIT 1;

    -- 3. If price is found 
    IF NOT EXISTS (
        SELECT 1 FROM transactions 
        WHERE customer_id = NEW.customer_id 
        AND service_id IS NULL 
        AND (extras->0->>'description') LIKE ('%VENTA MEMBRESÍA: ' || plan_name || '%')
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
            'membership_sale', -- Use the correct method
            'paid',
            now(),
            NULL,
            0,
            0,
            jsonb_build_array(jsonb_build_object('description', 'VENTA MEMBRESÍA: ' || plan_name, 'price', plan_price))
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
