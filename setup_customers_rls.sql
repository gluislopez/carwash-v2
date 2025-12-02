-- Habilitar RLS en la tabla de clientes
alter table customers enable row level security;

-- Limpiar políticas anteriores si existen
drop policy if exists "Todos pueden ver clientes" on customers;
drop policy if exists "Solo Admins pueden gestionar clientes" on customers;

-- 1. REGLA DE LECTURA: Todos los usuarios autenticados pueden VER la lista de clientes
-- (Necesario para que el Dashboard cargue la lista en el selector)
create policy "Todos pueden ver clientes"
on customers for select
using ( auth.role() = 'authenticated' );

-- 2. REGLA DE ESCRITURA: Solo Admins pueden Crear, Editar o Borrar
create policy "Solo Admins pueden gestionar clientes"
on customers for all
using (
  (select role from employees where user_id = auth.uid()) = 'admin'
)
with check (
  (select role from employees where user_id = auth.uid()) = 'admin'
);
