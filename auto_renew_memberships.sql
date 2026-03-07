-- Función RPC para renovar membresías "Perezosamente" (Lazy Renewal)
-- Revisa si ha pasado 1 mes desde la última vez que se renovó el saldo de lavados
-- y en caso de ser así, reinicia el contador a 0 y actualiza la fecha.

CREATE OR REPLACE FUNCTION check_and_renew_membership(p_customer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta con privilegios elevados para garantizar actualización
AS $$
DECLARE
    v_membership_record RECORD;
    v_months_passed INTEGER;
    v_new_reset_date TIMESTAMPTZ;
BEGIN
    -- 1. Iterar sobre TODAS las membresías activas del cliente (para todos sus vehículos)
    FOR v_membership_record IN 
        SELECT id, last_reset_at 
        FROM customer_memberships 
        WHERE customer_id = p_customer_id 
          AND status = 'active'
    LOOP
        -- Si last_reset_at es nulo, usar la fecha de hoy
        IF v_membership_record.last_reset_at IS NULL THEN
            UPDATE customer_memberships 
            SET last_reset_at = timezone('utc'::text, now()),
                usage_count = 0 
            WHERE id = v_membership_record.id;
            CONTINUE;
        END IF;

        -- 2. Calcular meses pasados
        v_months_passed := (EXTRACT(year FROM age(now(), v_membership_record.last_reset_at)) * 12) +
                           EXTRACT(month FROM age(now(), v_membership_record.last_reset_at));

        -- 3. Si ha pasado al menos 1 mes, reiniciar
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

-- Otorgar permiso de ejecución a los roles autenticados (frontend)
GRANT EXECUTE ON FUNCTION check_and_renew_membership(UUID) TO authenticated;
