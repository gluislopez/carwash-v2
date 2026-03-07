-- SOLUCIÓN DEFINITIVA PARA VISIBILIDAD DE SERVICIOS
-- Este script hace 3 cosas: 
-- 1. Añade la columna 'active' si no existe.
-- 2. Asegura que todos los servicios sean visibles inicialmente.
-- 3. Abre los permisos (RLS) para que los administradores puedan actualizar.

-- 1. Columna
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- 2. Datos
UPDATE public.services SET active = true WHERE active IS NULL;

-- 3. Permisos (RLS)
-- Primero borramos políticas viejas que puedan estar estorbando
DROP POLICY IF EXISTS "Public Read Services" ON public.services;
DROP POLICY IF EXISTS "Staff Full Access Services" ON public.services;
DROP POLICY IF EXISTS "Admins can update services" ON public.services;

-- Permitir que CUALQUIERA (incluyendo el portal del cliente sin login) pueda VER los servicios
CREATE POLICY "Public Read Services" ON public.services FOR SELECT USING (true);

-- Permitir que usuarios AUTENTICADOS (el admin) puedan hacer TODO
CREATE POLICY "Staff Full Access Services" ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);
