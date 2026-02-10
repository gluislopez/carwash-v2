-- SCRIPT: ACTUALIZAR CREDENCIALES (PASSWORD Y EMAIL)
-- ==========================================================
-- INSTRUCCIONES:
-- 1. Llena los datos en la sección "DATOS A CAMBIAR".
-- 2. Dale al botón "RUN".
-- ==========================================================

DO $$
DECLARE
    -- === DATOS A CAMBIAR (ESCRIBE AQUÍ) ===
    nombre_empleado  TEXT := 'Eduardo';              -- El nombre como está en la app
    nuevo_email      TEXT := 'eduardo.nuevo@gmail.com'; -- El NUEVO email
    nueva_contrasena TEXT := '123456';               -- La NUEVA contraseña
    -- =======================================
    
    target_user_id UUID;
BEGIN
    -- 1. Buscar el ID del empleado por su nombre
    SELECT user_id INTO target_user_id
    FROM public.employees
    WHERE name ILIKE '%' || nombre_empleado || '%'
    LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION '❌ ERROR: No encontré a nadie llamado "%"', nombre_empleado;
    END IF;

    -- 2. Actualizar CONTRASEÑA y EMAIL en el sistema de Auth (Login)
    UPDATE auth.users
    SET encrypted_password = crypt(nueva_contrasena, gen_salt('bf')),
        email = nuevo_email,
        email_confirmed_at = now(),
        updated_at = now()
    WHERE id = target_user_id;

    -- 3. Actualizar EMAIL en la tabla de Empleados (Visual)
    UPDATE public.employees
    SET email = nuevo_email
    WHERE user_id = target_user_id;

    RAISE NOTICE '✅ ¡LISTO! Credenciales actualizadas para %', nombre_empleado;
    RAISE NOTICE '   - Nuevo Email: %', nuevo_email;
    RAISE NOTICE '   - Nueva Clave: %', nueva_contrasena;
END $$;
