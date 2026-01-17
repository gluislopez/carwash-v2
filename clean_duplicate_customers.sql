-- SCRIPT PARA LIMPIAR CLIENTES DUPLICADOS (Versión para IDs UUID)
-- Este script identifica clientes con el mismo nombre y teléfono,
-- mueve sus vehículos y transacciones al registro más antiguo y borra los duplicados.

DO $$
DECLARE
    r RECORD;
    keep_id UUID;
    duplicate_ids UUID[];
BEGIN
    -- Buscamos grupos de clientes con mismo nombre y teléfono (o nombre si el teléfono está vacío)
    FOR r IN (
        SELECT name, COALESCE(phone, '') as clean_phone, array_agg(id ORDER BY created_at ASC) as ids
        FROM customers
        GROUP BY name, COALESCE(phone, '')
        HAVING COUNT(*) > 1
    ) LOOP
        -- Tomamos el primer ID como el que mantendremos
        keep_id := r.ids[1];
        -- El resto son duplicados a fusionar
        duplicate_ids := r.ids[2:array_length(r.ids, 1)];
        
        RAISE NOTICE 'Fusionando clientes para % (%) - Manteniendo ID %, fusionando IDs %', r.name, r.clean_phone, keep_id, duplicate_ids;

        -- 1. Mover Vehículos
        UPDATE vehicles 
        SET customer_id = keep_id 
        WHERE customer_id = ANY(duplicate_ids);

        -- 2. Mover Transacciones
        UPDATE transactions 
        SET customer_id = keep_id 
        WHERE customer_id = ANY(duplicate_ids);

        -- 3. Mover Membresías (si existen)
        BEGIN
            EXECUTE 'UPDATE customer_memberships SET customer_id = $1 WHERE customer_id = ANY($2)'
            USING keep_id, duplicate_ids;
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;

        -- 4. Mover Feedback (si existe)
        BEGIN
            EXECUTE 'UPDATE customer_feedback SET customer_id = $1 WHERE customer_id = ANY($2)'
            USING keep_id, duplicate_ids;
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;

        -- 5. Borrar los duplicados
        DELETE FROM customers 
        WHERE id = ANY(duplicate_ids);
        
    END LOOP;
END $$;

SELECT 'LIMPIEZA COMPLETADA: Los clientes duplicados han sido fusionados correctamente.' as resultado;
