-- DIAGNOSTICO DE VINCULACIÓN
-- Reemplaza 'TU_EMAIL_AQUI' con el email que ves en el panel de diagnóstico

SELECT 
    u.id as auth_id,
    u.email as auth_email,
    e.id as employee_id,
    e.name as employee_name,
    e.email as employee_email,
    e.user_id as employee_user_id_fk
FROM auth.users u
LEFT JOIN employees e ON LOWER(e.email) = LOWER(u.email)
WHERE u.email = 'gluislopez@icloud.com'; -- CAMBIA ESTO POR EL EMAIL DEL EMPLEADO QUE FALLA
