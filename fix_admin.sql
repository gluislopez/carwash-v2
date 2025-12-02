DO $$
BEGIN
    -- 1. Si el empleado ya existe, lo actualizamos a Admin
    IF EXISTS (SELECT 1 FROM employees WHERE email = 'gluislopez@gmail.com') THEN
        UPDATE employees
        SET role = 'admin', position = 'Gerente'
        WHERE email = 'gluislopez@gmail.com';
    ELSE
    -- 2. Si no existe, lo creamos nuevo
        INSERT INTO employees (name, email, position, role, phone)
        VALUES ('Gerardo Lopez', 'gluislopez@gmail.com', 'Gerente', 'admin', '787-000-0000');
    END IF;

    -- 3. Lo vinculamos con tu usuario de Supabase (Login)
    UPDATE employees
    SET user_id = (SELECT id FROM auth.users WHERE email = 'gluislopez@gmail.com')
    WHERE email = 'gluislopez@gmail.com';
END $$;
