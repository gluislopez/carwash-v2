-- 🚀 SCRIPT: Integración de Pagos Automatizados con Stripe
-- Este script permite que el sistema procese automáticamente los pagos realizados en Stripe.

-- 1. Crear tabla de registro de eventos (Opcional, para auditoría)
CREATE TABLE IF NOT EXISTS stripe_payment_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    stripe_session_id TEXT,
    customer_id UUID,
    amount DECIMAL(10, 2),
    status TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Función de procesamiento atómico
CREATE OR REPLACE FUNCTION process_stripe_subscription_payment(
    p_customer_id UUID,
    p_amount NUMERIC,
    p_stripe_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_membership_record RECORD;
    v_new_billing_date DATE;
BEGIN
    -- 1. Buscar la membresía activa o pendiente
    SELECT * INTO v_membership_record
    FROM customer_memberships
    WHERE customer_id = p_customer_id
      AND status IN ('active', 'pending_payment')
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró una membresía activa para el cliente %', p_customer_id;
    END IF;

    -- 2. Calcular nueva fecha de facturación (1 mes después)
    -- Si la fecha actual de facturación ya pasó o es nula, empezamos desde hoy
    IF v_membership_record.next_billing_date IS NULL OR v_membership_record.next_billing_date < CURRENT_DATE THEN
        v_new_billing_date := (CURRENT_DATE + INTERVAL '1 month')::DATE;
    ELSE
        v_new_billing_date := (v_membership_record.next_billing_date + INTERVAL '1 month')::DATE;
    END IF;

    -- 3. Actualizar la membresía
    UPDATE customer_memberships
    SET next_billing_date = v_new_billing_date,
        last_reset_at = date_trunc('day', now()), -- El saldo se reinicia hoy
        usage_count = 0,                        -- Reset de lavados
        status = 'active',                       -- Asegurar que esté activa
        stripe_subscription_id = COALESCE(stripe_subscription_id, p_stripe_id)
    WHERE id = v_membership_record.id;

    -- 4. Registrar la transacción para contabilidad
    -- Nota: Se intenta convertir el customer_id a BIGINT si la tabla transactions lo requiere.
    -- Si customer_id en transactions es UUID, funcionará directo.
    INSERT INTO transactions (
        customer_id,
        price,
        status,
        payment_method,
        created_at,
        finished_at,
        extras
    )
    VALUES (
        -- Intento de mapeo seguro de ID
        (SELECT id FROM customers WHERE id::text = p_customer_id::text LIMIT 1),
        p_amount,
        'completed',
        'stripe',
        now(),
        now(),
        jsonb_build_array(jsonb_build_object('name', 'PAGO MEMBRESÍA ONLINE (STRIPE)', 'price', p_amount))
    );

    -- 5. Log del evento
    INSERT INTO stripe_payment_logs (stripe_session_id, customer_id, amount, status)
    VALUES (p_stripe_id, p_customer_id, p_amount, 'processed');

END;
$$;

-- Permisos para que la Edge Function pueda llamar a este RPC
GRANT EXECUTE ON FUNCTION process_stripe_subscription_payment(UUID, NUMERIC, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION process_stripe_subscription_payment(UUID, NUMERIC, TEXT) TO authenticated;
