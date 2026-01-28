-- Migration: Membership Enhancements and Stripe Integration

-- 1. Enhance customer_memberships for usage tracking and Stripe
ALTER TABLE customer_memberships
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

COMMENT ON COLUMN customer_memberships.last_used_at IS 'Timestamp of the last time a membership benefit was used used to enforce daily limits.';
COMMENT ON COLUMN customer_memberships.stripe_subscription_id IS 'The ID of the subscription in Stripe (sub_...)';

-- 2. Enhance memberships for configuration
ALTER TABLE memberships
ADD COLUMN IF NOT EXISTS included_services JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

COMMENT ON COLUMN memberships.included_services IS 'JSON array of service names or IDs included in the plan, e.g. ["Lavado Regular", "Aspirado"]';

-- 3. Update existing memberships (Seed) with some defaults for testing
-- Assuming 'Plan Smart' exists (from create_memberships.sql)
UPDATE memberships 
SET included_services = '["Lavado Regular", "Lavado Basic"]'::jsonb 
WHERE name = 'Plan Smart';

UPDATE memberships 
SET included_services = '["Lavado Regular", "Lavado Basic", "Lavado Premium"]'::jsonb 
WHERE name = 'Plan Detailing';

UPDATE memberships 
SET included_services = '["Lavado Regular"]'::jsonb 
WHERE name = 'Plan Brillo Infinito';
