-- Fix membership assignment constraint error
-- Add a unique constraint to customer_memberships(customer_id) to allow UPSERT
-- First, if there are duplicates, we should clean them up (keep only the newest)

DELETE FROM customer_memberships
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER(PARTITION BY customer_id ORDER BY created_at DESC) as rn
        FROM customer_memberships
    ) t
    WHERE t.rn > 1
);

-- Now add the unique constraint
ALTER TABLE customer_memberships ADD CONSTRAINT unique_customer_id UNIQUE (customer_id);

-- Add last_used auditing column
ALTER TABLE customer_memberships ADD COLUMN IF NOT EXISTS last_used TIMESTAMPTZ;
