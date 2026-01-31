-- SECURITY HARDENING SCRIPT
-- 1. Fix Function Vulnerability
ALTER FUNCTION public.apply_promo_on_feedback OWNER TO postgres;
ALTER FUNCTION public.apply_promo_on_feedback SET search_path = public;

-- 2. Lockdown 'daily_notes' (Staff Only - No Public Access)
DROP POLICY IF EXISTS "Enable access to all users" ON public.daily_notes;
DROP POLICY IF EXISTS "Public Access" ON public.daily_notes;
CREATE POLICY "Staff Read Notes" ON public.daily_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff Write Notes" ON public.daily_notes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff Update Notes" ON public.daily_notes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Staff Delete Notes" ON public.daily_notes FOR DELETE TO authenticated USING (true);

-- 3. Lockdown 'services' (Public Read, Admin Write Only)
DROP POLICY IF EXISTS "Enable access to all users" ON public.services;
DROP POLICY IF EXISTS "Public Read Services" ON public.services;
DROP POLICY IF EXISTS "Admin Manage Services" ON public.services;

CREATE POLICY "Public Read Services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admin Manage Services" ON public.services FOR ALL TO authenticated 
USING ((select role from public.employees where user_id = auth.uid()) = 'admin')
WITH CHECK ((select role from public.employees where user_id = auth.uid()) = 'admin');

-- 4. Lockdown 'memberships' (Public Read, Admin Write Only)
DROP POLICY IF EXISTS "Enable access to all users" ON public.memberships;
DROP POLICY IF EXISTS "Public Read Memberships" ON public.memberships;
DROP POLICY IF EXISTS "Admin Manage Memberships" ON public.memberships;

CREATE POLICY "Public Read Memberships" ON public.memberships FOR SELECT USING (true);
CREATE POLICY "Admin Manage Memberships" ON public.memberships FOR ALL TO authenticated 
USING ((select role from public.employees where user_id = auth.uid()) = 'admin')
WITH CHECK ((select role from public.employees where user_id = auth.uid()) = 'admin');

-- 5. Lockdown 'customer_feedback' (Public Insert/Read, No Anon Edit/Delete)
DROP POLICY IF EXISTS "Enable access to all users" ON public.customer_feedback;
DROP POLICY IF EXISTS "Public Read Feedback" ON public.customer_feedback;
DROP POLICY IF EXISTS "Public Insert Feedback" ON public.customer_feedback;
DROP POLICY IF EXISTS "Staff Manage Feedback" ON public.customer_feedback;

CREATE POLICY "Public Read Feedback" ON public.customer_feedback FOR SELECT USING (true);
CREATE POLICY "Public Insert Feedback" ON public.customer_feedback FOR INSERT WITH CHECK (true);
-- Only Admins/Staff can delete or update feedback
CREATE POLICY "Staff Manage Feedback" ON public.customer_feedback FOR ALL TO authenticated USING (true);

-- 6. Note on OTHER tables (employees, customers, etc.)
-- These tables require 'True' access for the Customer Public Portal to function.
-- They will continue to show warnings in Supabase, but strictly locking them 
-- would break the 'Share Portal' feature.
