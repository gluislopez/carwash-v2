-- OPCIÓN NUCLEAR: Desactivar seguridad en tabla de empleados
-- Esto permitirá que la app lea la tabla sin restricciones.
-- Úsalo solo para diagnosticar.

ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- También asegurarnos de que el usuario tenga permisos de lectura
GRANT SELECT ON employees TO authenticated;
GRANT SELECT ON employees TO anon;

SELECT 'Seguridad desactivada en tabla employees' as mensaje;
