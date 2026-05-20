-- Helper: is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin');
$$;

-- Treat super_admin as admin/staff for existing checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR (_role = 'admin' AND role = 'super_admin'))
  );
$$;

-- Replace user_roles policies: only super_admin manages privileged roles
DROP POLICY IF EXISTS "admin manages roles" ON public.user_roles;
DROP POLICY IF EXISTS "admin reads all roles" ON public.user_roles;

CREATE POLICY "super admin reads all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "super admin inserts roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "super admin updates roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "super admin deletes roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  AND NOT (role = 'super_admin' AND user_id = auth.uid())
);