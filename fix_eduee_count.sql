
-- RESET DE CONTEO PARA EDUEE
-- Ejecuta esto en el SQL Editor de Supabase
DO $$
DECLARE
    v_customer_id UUID;
BEGIN
    -- 1. Buscar ID de Eduee
    SELECT id INTO v_customer_id 
    FROM customers 
    WHERE name ILIKE '%Eduee%' 
    LIMIT 1;

    IF v_customer_id IS NULL THEN
        RAISE NOTICE 'No se encontró al cliente Eduee';
        RETURN;
    END IF;

    -- 2. Reiniciar su membresía activa a 0 lavados usados
    UPDATE customer_memberships 
    SET usage_count = 0,
        last_reset_at = NOW(),
        last_used = NULL
    WHERE customer_id = v_customer_id AND status = 'active';

    RAISE NOTICE 'Conteo de Eduee reiniciado a 0/X. ¡Ya puede usar su membresía!';
END $$;
