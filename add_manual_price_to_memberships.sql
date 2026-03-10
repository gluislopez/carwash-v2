-- Add manual_price column to customer_memberships to allow special pricing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customer_memberships' AND column_name = 'manual_price') THEN
        ALTER TABLE customer_memberships ADD COLUMN manual_price DECIMAL(10, 2);
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
