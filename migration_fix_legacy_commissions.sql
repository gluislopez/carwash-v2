DO $$
DECLARE
    r RECORD;
    base_comm NUMERIC;
    extra_comm NUMERIC;
    new_total NUMERIC;
    updated_count INT := 0;
BEGIN
    -- Loop through all transactions (Active/Completed)
    FOR r IN SELECT t.id, t.service_id, t.extras, t.commission_amount FROM transactions t LOOP
        
        -- Get base commission from linked service
        -- (If service deleted/null, we skip or treat base as 0? Safe to skip if unsure)
        SELECT commission INTO base_comm FROM services WHERE id = r.service_id;
        
        IF base_comm IS NOT NULL THEN
            -- Get extras sum
            extra_comm := 0;
            -- Check if extras is a valid array
            IF r.extras IS NOT NULL AND jsonb_typeof(r.extras) = 'array' THEN
                SELECT COALESCE(SUM(COALESCE((x->>'commission')::numeric, 0)), 0) 
                INTO extra_comm
                FROM jsonb_array_elements(r.extras) x;
            END IF;

            new_total := base_comm + extra_comm;

            -- Update if different (tolerance 0.01)
            IF ABS(COALESCE(r.commission_amount, 0) - new_total) > 0.01 THEN
                -- RAISE NOTICE 'Updating Tx %: Old % -> New %', r.id, r.commission_amount, new_total;
                UPDATE transactions SET commission_amount = new_total WHERE id = r.id;
                updated_count := updated_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Successfully updated % transactions.', updated_count;
END $$;
