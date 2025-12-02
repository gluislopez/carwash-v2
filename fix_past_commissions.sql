-- Fix past commissions for $35 shared services
-- Updates transactions with price 35 and > 1 employee to have commission 12

UPDATE transactions t
SET commission_amount = 12
WHERE t.price = 35 
  AND (SELECT COUNT(*) FROM transaction_assignments ta WHERE ta.transaction_id = t.id) > 1;

-- Verify the changes
SELECT id, price, commission_amount, (SELECT COUNT(*) FROM transaction_assignments ta WHERE ta.transaction_id = transactions.id) as employee_count
FROM transactions
WHERE price = 35 AND (SELECT COUNT(*) FROM transaction_assignments ta WHERE ta.transaction_id = transactions.id) > 1;
