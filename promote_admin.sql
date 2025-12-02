-- Script para promover a Admin y vincular usuario
-- Reemplaza el email si es necesario, pero ya está configurado para giosanny1104@gmail.com

DO $$
DECLARE
    target_email TEXT := 'giosanny1104@gmail.com';
    target_user_id UUID;
BEGIN
    -- 1. Buscar el ID de usuario en auth.users
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = target_email;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'No se encontró el usuario con email % en auth.users. Asegúrate de que se haya registrado/logueado al menos una vez.', target_email;
    END IF;

    -- 2. Actualizar o Insertar en employees
    -- Intentamos actualizar primero si existe por email
    UPDATE employees
    SET 
        role = 'admin',
        user_id = target_user_id -- Forzamos la vinculación
    WHERE email = target_email;

    -- Si no se actualizó nada (no existía el empleado), lo insertamos
    IF NOT FOUND THEN
        INSERT INTO employees (name, email, role, user_id, hourly_rate, commission_rate)
        VALUES (
            'Admin Giosanny', -- Nombre por defecto
            target_email,
            'admin',
            target_user_id,
            0, -- Hourly rate default
            0  -- Commission rate default
        );
    END IF;

    RAISE NOTICE 'Usuario % promovido a ADMIN exitosamente.', target_email;
END $$;
