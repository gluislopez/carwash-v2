-- ============================================================
-- FASE 1: MIGRACIÓN MULTI-TENANT - Express CarWash SaaS
-- ============================================================
-- INSTRUCCIONES:
--   1. Abre tu proyecto en supabase.com
--   2. Ve al menú izquierdo → "SQL Editor"
--   3. Pega TODO este script y presiona "Run"
--   4. Repite para cada bloque si prefieres hacerlo en pasos
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PASO 1: CREAR LA TABLA DE ORGANIZACIONES (Negocios)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    owner_email TEXT NOT NULL UNIQUE,
    plan        TEXT NOT NULL DEFAULT 'trial',    -- 'trial' | 'starter' | 'pro' | 'enterprise'
    status      TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'suspended' | 'cancelled'
    phone       TEXT,
    address     TEXT,
    logo_url    TEXT,
    primary_color TEXT DEFAULT '#4F46E5',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- PASO 2: CREAR TU ORGANIZACIÓN (Express CarWash de Gerardo)
--   ⚠️ Reemplaza 'tu@email.com' con tu correo real de Supabase Auth
-- ────────────────────────────────────────────────────────────
-- Tu user ID de Auth (gluislopez@gmail.com):
-- 1eb98a5a-c67e-478d-9261-31524845e46e

INSERT INTO public.organizations (id, name, owner_email, plan, status, trial_ends_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',  -- ID fijo permanente de Express CarWash
    'Express CarWash',
    'gluislopez@gmail.com',
    'enterprise',
    'active',
    '2099-12-31'      -- Tu cuenta nunca expira
)
ON CONFLICT (owner_email) DO NOTHING;

-- Guarda este valor: tu organization_id = '00000000-0000-0000-0000-000000000001'


-- ────────────────────────────────────────────────────────────
-- PASO 3: AGREGAR organization_id A TODAS LAS TABLAS
-- ────────────────────────────────────────────────────────────

-- customers
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- vehicles
ALTER TABLE public.vehicles
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- transactions
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- services
ALTER TABLE public.services
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- employees
ALTER TABLE public.employees
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- expenses
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- daily_notes (si existe)
ALTER TABLE public.daily_notes
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- transaction_assignments (si existe)
ALTER TABLE public.transaction_assignments
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- memberships (si existe)
ALTER TABLE public.memberships
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- feedbacks (si existe)
ALTER TABLE public.feedbacks
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;


-- ────────────────────────────────────────────────────────────
-- PASO 4: MIGRAR TODOS TUS DATOS EXISTENTES AL ORG ID TUYO
--   ⚠️ Esto asigna TODOS los registros actuales a tu negocio
-- ────────────────────────────────────────────────────────────

UPDATE public.customers           SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.vehicles            SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.transactions        SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.services            SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.employees           SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.expenses            SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- Solo corre estas si las tablas existen en tu DB:
-- UPDATE public.daily_notes          SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
-- UPDATE public.transaction_assignments SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
-- UPDATE public.memberships          SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
-- UPDATE public.feedbacks            SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;


-- ────────────────────────────────────────────────────────────
-- PASO 5: HACER organization_id OBLIGATORIO (NOT NULL)
--   Solo después de haber migrado los datos ↑
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.customers           ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.vehicles            ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.transactions        ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.services            ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.employees           ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.expenses            ALTER COLUMN organization_id SET NOT NULL;


-- ────────────────────────────────────────────────────────────
-- PASO 6: AGREGAR TABLA user_profiles para mapear Auth Users
--         a sus Organizations
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL DEFAULT 'employee',   -- 'superadmin' | 'owner' | 'employee'
    full_name       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- PASO 7: CREAR ÍNDICES PARA VELOCIDAD
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_org       ON public.customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_org        ON public.vehicles(organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org    ON public.transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_services_org        ON public.services(organization_id);
CREATE INDEX IF NOT EXISTS idx_employees_org       ON public.employees(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org        ON public.expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org   ON public.user_profiles(organization_id);


-- ────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL
-- Corre esto para confirmar que todo quedó bien:
-- ────────────────────────────────────────────────────────────
/*
SELECT 'customers'    AS tabla, COUNT(*) AS total, COUNT(organization_id) AS con_org FROM customers
UNION ALL
SELECT 'vehicles',           COUNT(*), COUNT(organization_id) FROM vehicles
UNION ALL
SELECT 'transactions',       COUNT(*), COUNT(organization_id) FROM transactions
UNION ALL
SELECT 'services',           COUNT(*), COUNT(organization_id) FROM services
UNION ALL
SELECT 'employees',          COUNT(*), COUNT(organization_id) FROM employees
UNION ALL
SELECT 'expenses',           COUNT(*), COUNT(organization_id) FROM expenses;

-- Si "total" === "con_org" en todas las filas, ¡la migración fue exitosa!
*/
