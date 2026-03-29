-- Renovar saldo de lavados cada mes (Lazy Renewal)
-- Fix: Usar date_trunc('day') para que se renueve el mismo día sin importar la hora exacta.

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
        SELECT id, last_reset_at, status 
        FROM customer_memberships 
        WHERE customer_id = p_customer_id 
          AND status = 'active'
    LOOP
        -- Inicialización si es nulo
        IF v_membership_record.last_reset_at IS NULL THEN
            UPDATE customer_memberships 
            SET last_reset_at = timezone('utc'::text, date_trunc('day', now())),
                usage_count = 0 
            WHERE id = v_membership_record.id;
            CONTINUE;
        END IF;

        -- Calcular meses pasados basados en el DÍA (truncando hora)
        v_months_passed := (EXTRACT(year FROM age(date_trunc('day', now()), date_trunc('day', v_membership_record.last_reset_at))) * 12) +
                           EXTRACT(month FROM age(date_trunc('day', now()), date_trunc('day', v_membership_record.last_reset_at)));

        -- Si ha pasado al menos 1 mes, reiniciar saldo
        IF v_months_passed >= 1 THEN
            -- Nueva fecha de reset proyectada (mantiene el mismo día del mes original)
            v_new_reset_date := v_membership_record.last_reset_at + (v_months_passed || ' months')::interval;

            UPDATE customer_memberships
            SET usage_count = 0,
                last_reset_at = v_new_reset_date
            WHERE id = v_membership_record.id;
            
            -- Opcional: Registrar log o evento si fuera necesario
        END IF;
    END LOOP;
END;
$$;
