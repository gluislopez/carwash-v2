-- Migration: Add loyalty tracking to vehicles table
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS redeemed_coupons INTEGER DEFAULT 0;

-- Comment: This allows tracking loyalty for each vehicle independently, 
-- addressing the requirement for customers with multiple cars.
