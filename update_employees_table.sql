-- Agregar columna para vincular con el usuario de Supabase
alter table employees add column if not exists user_id uuid;

-- (Opcional) Hacer que sea único para que no haya dos empleados con el mismo usuario
alter table employees add constraint employees_user_id_key unique (user_id);
