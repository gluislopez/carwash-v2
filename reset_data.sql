-- Script para reiniciar los datos (Borrón y Cuenta Nueva)
-- Mantiene: Empleados, Clientes, Servicios
-- Borra: Transacciones, Asignaciones, Gastos

BEGIN;

-- 1. Borrar asignaciones (depende de transactions)
DELETE FROM transaction_assignments;

-- 2. Borrar transacciones
DELETE FROM transactions;

-- 3. Borrar gastos
DELETE FROM expenses;

COMMIT;

-- Verificación (Opcional)
SELECT count(*) as transactions_remaining FROM transactions;
