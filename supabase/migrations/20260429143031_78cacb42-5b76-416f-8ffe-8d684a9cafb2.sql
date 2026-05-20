-- Stored items per storage rental
CREATE TABLE public.stored_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  name text NOT NULL,
  qty integer NOT NULL DEFAULT 1 CHECK (qty >= 0),
  qty_released integer NOT NULL DEFAULT 0 CHECK (qty_released >= 0),
  condition text,
  notes text,
  intake_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'in_storage', -- in_storage | partially_released | released
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stored_items_rental ON public.stored_items(rental_id);
CREATE INDEX idx_stored_items_customer ON public.stored_items(customer_id);

ALTER TABLE public.stored_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manages stored_items"
ON public.stored_items FOR ALL TO authenticated
USING (public.is_staff_or_admin(auth.uid()))
WITH CHECK (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "customer reads own stored_items"
ON public.stored_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = stored_items.customer_id AND c.user_id = auth.uid()));

CREATE TRIGGER tg_stored_items_updated_at BEFORE UPDATE ON public.stored_items
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Release records (one per release event, may include multiple items)
CREATE TABLE public.item_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  waybill_number text NOT NULL UNIQUE,
  recipient_name text NOT NULL,
  recipient_phone text,
  recipient_id_type text,
  recipient_id_number text,
  notes text,
  condition_on_release text,
  released_by uuid NOT NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  waybill_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_releases_rental ON public.item_releases(rental_id);
CREATE INDEX idx_releases_customer ON public.item_releases(customer_id);

ALTER TABLE public.item_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approvers manage releases"
ON public.item_releases FOR ALL TO authenticated
USING (public.can_approve_payments(auth.uid()))
WITH CHECK (public.can_approve_payments(auth.uid()));

CREATE POLICY "staff reads releases"
ON public.item_releases FOR SELECT TO authenticated
USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "customer reads own releases"
ON public.item_releases FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = item_releases.customer_id AND c.user_id = auth.uid()));

-- Movement log: every intake/release/adjustment is recorded
CREATE TABLE public.item_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stored_item_id uuid NOT NULL,
  rental_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  release_id uuid,
  movement_type text NOT NULL, -- 'intake' | 'release' | 'adjustment'
  qty_change integer NOT NULL,  -- positive intake/adjust, negative release
  qty_after integer NOT NULL,
  notes text,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_movements_item ON public.item_movements(stored_item_id);
CREATE INDEX idx_movements_rental ON public.item_movements(rental_id);

ALTER TABLE public.item_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff reads movements"
ON public.item_movements FOR SELECT TO authenticated
USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "customer reads own movements"
ON public.item_movements FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.customers c WHERE c.id = item_movements.customer_id AND c.user_id = auth.uid()));

CREATE POLICY "auth inserts movements"
ON public.item_movements FOR INSERT TO authenticated
WITH CHECK (actor = auth.uid() AND public.is_staff_or_admin(auth.uid()));

-- Trigger: log intake on insert
CREATE OR REPLACE FUNCTION public.tg_log_item_intake()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.item_movements (stored_item_id, rental_id, customer_id, movement_type, qty_change, qty_after, notes, actor)
  VALUES (NEW.id, NEW.rental_id, NEW.customer_id, 'intake', NEW.qty, NEW.qty, 'Initial intake', NEW.created_by);
  RETURN NEW;
END $$;

CREATE TRIGGER tg_stored_items_intake AFTER INSERT ON public.stored_items
FOR EACH ROW EXECUTE FUNCTION public.tg_log_item_intake();

-- Waybill storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('waybills', 'waybills', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "staff reads waybills"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'waybills' AND public.is_staff_or_admin(auth.uid()));

CREATE POLICY "approvers upload waybills"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'waybills' AND public.can_approve_payments(auth.uid()));

CREATE POLICY "approvers update waybills"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'waybills' AND public.can_approve_payments(auth.uid()));