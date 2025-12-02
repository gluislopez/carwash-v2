DO $$
BEGIN
    -- 1. Desvincular tu usuario de CUALQUIER empleado actual (para soltar a Emanuelle)
    UPDATE employees
    SET user_id = NULL
    WHERE user_id = '1eb98a5a-c67e-478d-9261-31524845e46e';

    -- 2. Asegurar que existe Gerardo (Admin) sin usar ON CONFLICT
    IF EXISTS (SELECT 1 FROM employees WHERE email = 'gluislopez@gmail.com') THEN
        UPDATE employees
        SET role = 'admin', position = 'Gerente'
        WHERE email = 'gluislopez@gmail.com';
    ELSE
        INSERT INTO employees (name, email, position, role, phone)
        VALUES ('Gerardo Lopez', 'gluislopez@gmail.com', 'Gerente', 'admin', '787-857-8983');
    END IF;

    -- 3. Vincular tu usuario a Gerardo
    UPDATE employees
    SET user_id = '1eb98a5a-c67e-478d-9261-31524845e46e'
    WHERE email = 'gluislopez@gmail.com';
END $$;
