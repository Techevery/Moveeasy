
CREATE TABLE public.agreement_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_id uuid,
  agreement_version text NOT NULL DEFAULT 'v1',
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, agreement_version)
);

ALTER TABLE public.agreement_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own acknowledgement"
ON public.agreement_acknowledgements FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "user inserts own acknowledgement"
ON public.agreement_acknowledgements FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "staff reads acknowledgements"
ON public.agreement_acknowledgements FOR SELECT
TO authenticated
USING (is_staff_or_admin(auth.uid()));
