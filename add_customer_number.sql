-- SQL Script to add sequential customer numbers

-- 1. Create a sequence for customer numbers
CREATE SEQUENCE IF NOT EXISTS customer_number_seq START 1;

-- 2. Add the column to the customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS customer_number INT DEFAULT nextval('customer_number_seq');

-- 3. Update existing customers based on their creation date so the oldest gets #1
WITH ordered_customers AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_num
  FROM public.customers
)
UPDATE public.customers
SET customer_number = ordered_customers.row_num
FROM ordered_customers
WHERE public.customers.id = ordered_customers.id;

-- 4. Reset the sequence to start from the max current customer number + 1, 
-- or 1 if no customers exist.
SELECT setval('customer_number_seq', COALESCE((SELECT MAX(customer_number) FROM public.customers), 0) + 1, false);
