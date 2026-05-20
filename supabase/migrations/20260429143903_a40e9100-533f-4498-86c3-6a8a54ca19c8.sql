-- Add unique item code to stored_items
ALTER TABLE public.stored_items ADD COLUMN IF NOT EXISTS item_code text;

-- Generate codes for any existing rows
UPDATE public.stored_items
SET item_code = 'ITM-' || upper(substring(replace(id::text, '-', ''), 1, 8))
WHERE item_code IS NULL;

ALTER TABLE public.stored_items ALTER COLUMN item_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS stored_items_item_code_key ON public.stored_items(item_code);

-- Auto-generate item_code on insert if not provided
CREATE OR REPLACE FUNCTION public.tg_stored_items_set_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
  tries int := 0;
BEGIN
  IF NEW.item_code IS NULL OR NEW.item_code = '' THEN
    LOOP
      candidate := 'ITM-' || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.stored_items WHERE item_code = candidate);
      tries := tries + 1;
      IF tries > 5 THEN EXIT; END IF;
    END LOOP;
    NEW.item_code := candidate;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS stored_items_set_code ON public.stored_items;
CREATE TRIGGER stored_items_set_code
  BEFORE INSERT ON public.stored_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_stored_items_set_code();

-- Index to speed up unit -> items lookup via rentals
CREATE INDEX IF NOT EXISTS stored_items_rental_idx ON public.stored_items(rental_id);
CREATE INDEX IF NOT EXISTS rentals_unit_idx ON public.rentals(unit_id);