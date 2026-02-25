-- Migration to add stripe_subscription_id to customer_memberships
ALTER TABLE customer_memberships 
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
