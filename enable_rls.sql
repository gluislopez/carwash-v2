-- 1. Habilitar RLS en la tabla de transacciones
alter table transactions enable row level security;

-- 2. Crear política: Los empleados solo ven sus propias ventas
create policy "Empleados ven sus propias ventas"
on transactions
for select
using (
  auth.uid()::text = employee_id -- Asumiendo que employee_id guarda el ID del usuario de Supabase
);

-- 3. Crear política: Permitir insertar ventas propias
create policy "Empleados pueden registrar ventas"
on transactions
for insert
with check (
  auth.uid()::text = employee_id
);

-- NOTA: Si tienes un rol de 'admin', necesitarás una política extra para que ellos vean todo.
-- Por ejemplo, si tienes una tabla 'profiles' con columna 'role':
-- create policy "Admins ven todo"
-- on transactions
-- for all
-- using (
--   exists (
--     select 1 from profiles
--     where id = auth.uid() and role = 'admin'
--   )
-- );
