-- 🚀 SCRIPT: Reparación y Globalización de Renovación Automática
-- Objetivo: Que el saldo se renueve el MISMO DÍA DEL MES (ignorando la hora)
-- e incluyendo una función para procesar a todos los clientes a la vez.

-- 1. Función por Cliente (Mejorada para ignorar horas)
CREATE OR REPLACE FUNCTION check_and_renew_membership(p_customer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_membership_record RECORD;
    v_months_passed INTEGER;
    v_new_reset_date TIMESTAMPTZ;
BEGIN
    FOR v_membership_record IN 
        SELECT id, last_reset_at, start_date
        FROM customer_memberships 
        WHERE customer_id = p_customer_id 
          AND status = 'active'
    LOOP
        IF v_membership_record.last_reset_at IS NULL THEN
            UPDATE customer_memberships 
            SET last_reset_at = timezone('utc'::text, date_trunc('day', now())),
                usage_count = 0 
            WHERE id = v_membership_record.id;
            CONTINUE;
        END IF;

        -- Calcular meses pasados basándose solo en el día
        v_months_passed := (EXTRACT(year FROM age(date_trunc('day', now()), date_trunc('day', v_membership_record.last_reset_at))) * 12) +
                           EXTRACT(month FROM age(date_trunc('day', now()), date_trunc('day', v_membership_record.last_reset_at)));

        IF v_months_passed >= 1 THEN
            v_new_reset_date := v_membership_record.last_reset_at + (v_months_passed || ' months')::interval;

            UPDATE customer_memberships
            SET usage_count = 0,
                last_reset_at = v_new_reset_date
            WHERE id = v_membership_record.id;
        END IF;
    END LOOP;
END;
$$;

-- 2. Función Global (Para procesar a todos los clientes activos de un golpe)
CREATE OR REPLACE FUNCTION check_and_renew_all_active_memberships()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cust RECORD;
BEGIN
    FOR v_cust IN SELECT DISTINCT customer_id FROM customer_memberships WHERE status = 'active' LOOP
        PERFORM check_and_renew_membership(v_cust.customer_id);
    END LOOP;
END;
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION check_and_renew_membership(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_and_renew_all_active_memberships() TO anon, authenticated;
