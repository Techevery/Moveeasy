-- Add link code for customer self-linking
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS link_code text UNIQUE;

-- Function to generate a short, friendly code (8 chars, no ambiguous chars)
CREATE OR REPLACE FUNCTION public.generate_customer_link_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
  tries int := 0;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..8 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.customers WHERE link_code = candidate);
    tries := tries + 1;
    IF tries > 10 THEN EXIT; END IF;
  END LOOP;
  RETURN candidate;
END;
$$;

-- Admin-only: (re)generate code for a customer (must be unlinked)
CREATE OR REPLACE FUNCTION public.regenerate_customer_link_code(_customer_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
  is_linked boolean;
BEGIN
  IF NOT public.is_staff_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only staff or admins can generate link codes';
  END IF;
  SELECT user_id IS NOT NULL INTO is_linked FROM public.customers WHERE id = _customer_id;
  IF is_linked THEN
    RAISE EXCEPTION 'Customer is already linked';
  END IF;
  new_code := public.generate_customer_link_code();
  UPDATE public.customers SET link_code = new_code WHERE id = _customer_id;
  RETURN new_code;
END;
$$;

-- Customer-side: claim a code to link their auth account
CREATE OR REPLACE FUNCTION public.claim_customer_link_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.customers WHERE user_id = uid) THEN
    RAISE EXCEPTION 'Your account is already linked to a customer';
  END IF;
  SELECT id INTO target_id FROM public.customers
    WHERE link_code = upper(_code) AND user_id IS NULL
    LIMIT 1;
  IF target_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or already-used code';
  END IF;
  UPDATE public.customers
    SET user_id = uid, link_code = NULL
    WHERE id = target_id;
  RETURN target_id;
END;
$$;