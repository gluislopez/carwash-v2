-- SCRIPT DE DIAGNÓSTICO DE IDs
-- Corre esto y mándame una captura de los resultados (Results)

SELECT 
  auth.uid() as "Mi Auth ID (Usuario)",
  (SELECT count(*) FROM employees WHERE user_id = auth.uid()) as "Coincidencias en Empleados",
  e.id as "Employee ID (Perfil)",
  e.name as "Nombre",
  e.user_id as "Linked Auth ID",
  e.role as "Rol"
FROM employees e;
