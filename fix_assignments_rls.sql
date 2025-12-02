-- ARREGLO DE VISIBILIDAD DE ASIGNACIONES

-- Problema: Los empleados solo podían ver su propia "fila" de asignación.
-- Esto causaba dos problemas:
-- 1. No veían a sus compañeros en el historial.
-- 2. El cálculo de comisiones fallaba (porque el sistema pensaba que solo había 1 empleado).

-- Solución: Permitir que todos los empleados vean las asignaciones de todos.
-- (Es necesario para saber entre cuántos dividir la comisión).

ALTER TABLE transaction_assignments DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empleados ven sus asignaciones" ON transaction_assignments;

-- Nueva política: Todos los usuarios autenticados pueden ver todas las asignaciones
CREATE POLICY "Ver todas las asignaciones" ON transaction_assignments
FOR SELECT TO authenticated
USING (true);

ALTER TABLE transaction_assignments ENABLE ROW LEVEL SECURITY;

SELECT 'VISIBILIDAD CORREGIDA: Ahora se pueden ver equipos completos' as mensaje;
