-- MERGE CUSTOMERS BY PHONE NUMBER
-- This script identifies customers with the same cleaned phone number,
-- moves all their vehicles, transactions, and memberships to the oldest account,
-- and then deletes the duplicate customer entries.

DO $$
DECLARE
    r RECORD;
    keep_id TEXT;
    duplicate_ids TEXT[];
    type_checker TEXT;
BEGIN
    -- 1. Determine ID type (BIGINT vs UUID) to avoid cast errors
    SELECT data_type INTO type_checker 
    FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'id'
    LIMIT 1;

    RAISE NOTICE 'Detection: Customer ID type is %', type_checker;

    -- 2. Find groups of customers with the same cleaned phone number
    -- We normalize by removing all non-digits: (787) 123-4567 -> 7871234567
    FOR r IN (
        SELECT 
            regexp_replace(phone, '\D', '', 'g') as clean_phone,
            array_agg(id::text ORDER BY created_at ASC) as ids
        FROM customers
        WHERE phone IS NOT NULL 
          AND phone != '' 
          AND phone != 'null' 
          AND regexp_replace(phone, '\D', '', 'g') != ''
        GROUP BY regexp_replace(phone, '\D', '', 'g')
        HAVING COUNT(*) > 1
    ) LOOP
        keep_id := r.ids[1];
        duplicate_ids := r.ids[2:array_length(r.ids, 1)];

        RAISE NOTICE 'Merging phone %: Holding %, merging %', r.clean_phone, keep_id, duplicate_ids;

        -- 3. Update Child Tables
        IF type_checker = 'bigint' THEN
            -- UPDATE VEHICLES
            UPDATE vehicles SET customer_id = keep_id::bigint WHERE customer_id = ANY(duplicate_ids::bigint[]);
            -- UPDATE TRANSACTIONS
            UPDATE transactions SET customer_id = keep_id::bigint WHERE customer_id = ANY(duplicate_ids::bigint[]);
            
            -- SAFE UPDATES FOR OPTIONAL TABLES
            BEGIN
                EXECUTE 'UPDATE customer_memberships SET customer_id = $1::bigint WHERE customer_id = ANY($2::bigint[])' USING keep_id, duplicate_ids;
            EXCEPTION WHEN undefined_table THEN NULL; END;
            
            BEGIN
                EXECUTE 'UPDATE subscription_payments SET customer_id = $1::bigint WHERE customer_id = ANY($2::bigint[])' USING keep_id, duplicate_ids;
            EXCEPTION WHEN undefined_table THEN NULL; END;

            -- DELETE DUPLICATES
            DELETE FROM customers WHERE id = ANY(duplicate_ids::bigint[]);
        ELSE
            -- UPDATE VEHICLES
            UPDATE vehicles SET customer_id = keep_id::uuid WHERE customer_id = ANY(duplicate_ids::uuid[]);
            -- UPDATE TRANSACTIONS
            UPDATE transactions SET customer_id = keep_id::uuid WHERE customer_id = ANY(duplicate_ids::uuid[]);
            
            -- SAFE UPDATES FOR OPTIONAL TABLES
            BEGIN
                EXECUTE 'UPDATE customer_memberships SET customer_id = $1::uuid WHERE customer_id = ANY($2::uuid[])' USING keep_id, duplicate_ids;
            EXCEPTION WHEN undefined_table THEN NULL; END;
            
            BEGIN
                EXECUTE 'UPDATE subscription_payments SET customer_id = $1::uuid WHERE customer_id = ANY($2::uuid[])' USING keep_id, duplicate_ids;
            EXCEPTION WHEN undefined_table THEN NULL; END;

            -- DELETE DUPLICATES
            DELETE FROM customers WHERE id = ANY(duplicate_ids::uuid[]);
        END IF;

    END LOOP;
END $$;

SELECT 'MERGE COMPLETE: All customers with duplicate phones have been unified.' as result;
