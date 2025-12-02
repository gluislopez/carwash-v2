-- 1. Agregar columna de ROL a la tabla de empleados
alter table employees add column if not exists role text default 'employee';

-- 2. (IMPORTANTE) Convertir a TU usuario en ADMIN
-- Reemplaza 'TU_EMAIL' con tu correo real para que este comando funcione,
-- o hazlo manualmente en el dashboard de Supabase si prefieres.
update employees 
set role = 'admin' 
where email = 'TU_EMAIL_AQUI'; 
-- Si no tienes el email en la tabla employees, tendrás que buscar tu ID y hacerlo manual.

-- 3. Actualizar Políticas de Seguridad (RLS) en Transacciones

-- Primero, borramos las políticas viejas para no confundirnos
drop policy if exists "Empleados ven sus propias ventas" on transactions;
drop policy if exists "Empleados pueden registrar ventas" on transactions;

-- NUEVA POLÍTICA DE LECTURA (Ver datos)
-- Admins ven TODO. Empleados ven SOLO LO SUYO.
create policy "Politica de Lectura"
on transactions for select
using (
  -- Es Admin?
  (select role from employees where user_id = auth.uid()) = 'admin'
  OR
  -- O es su propia venta?
  employee_id = auth.uid()
);

-- NUEVA POLÍTICA DE ESCRITURA (Insertar/Borrar/Editar)
-- SOLO Admins pueden registrar ventas (ya que elegiste Opción B)
create policy "Solo Admins pueden registrar"
on transactions for insert
with check (
  (select role from employees where user_id = auth.uid()) = 'admin'
);

create policy "Solo Admins pueden borrar"
on transactions for delete
using (
  (select role from employees where user_id = auth.uid()) = 'admin'
);

create policy "Solo Admins pueden editar"
on transactions for update
using (
  (select role from employees where user_id = auth.uid()) = 'admin'
);
