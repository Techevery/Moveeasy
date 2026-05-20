-- Add approval columns to payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Helper: can this user approve payments?
CREATE OR REPLACE FUNCTION public.can_approve_payments(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'payment_approver')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_approve_payments(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_approve_payments(UUID) TO authenticated;

-- Trigger: force pending_approval on insert unless current user can approve
CREATE OR REPLACE FUNCTION public.tg_payment_default_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_approve_payments(auth.uid()) THEN
    NEW.status := 'pending_approval';
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payments_default_pending ON public.payments;
CREATE TRIGGER payments_default_pending
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_payment_default_pending();

-- Trigger: only approvers can change status, approved_by, or approved_at after creation
CREATE OR REPLACE FUNCTION public.tg_payment_guard_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status IS DISTINCT FROM OLD.status)
     OR (NEW.approved_by IS DISTINCT FROM OLD.approved_by)
     OR (NEW.approved_at IS DISTINCT FROM OLD.approved_at) THEN
    IF NOT public.can_approve_payments(auth.uid()) THEN
      RAISE EXCEPTION 'Only payment approvers can change payment approval status';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS payments_guard_approval ON public.payments;
CREATE TRIGGER payments_guard_approval
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.tg_payment_guard_approval();

-- Receipts storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "staff manages receipts" ON storage.objects;
CREATE POLICY "staff manages receipts"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'receipts' AND public.is_staff_or_admin(auth.uid()))
WITH CHECK (bucket_id = 'receipts' AND public.is_staff_or_admin(auth.uid()));

DROP POLICY IF EXISTS "customer reads own receipts" ON storage.objects;
CREATE POLICY "customer reads own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);