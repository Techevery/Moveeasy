CREATE OR REPLACE FUNCTION public.tg_rental_block_double_close()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'cancelled' THEN
    IF NEW.status = 'cancelled'
       OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
       OR NEW.closed_by IS DISTINCT FROM OLD.closed_by
       OR NEW.closed_reason IS DISTINCT FROM OLD.closed_reason
       OR NEW.closed_notes IS DISTINCT FROM OLD.closed_notes THEN
      RAISE EXCEPTION 'Rental is already closed' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS rentals_block_double_close ON public.rentals;
CREATE TRIGGER rentals_block_double_close
BEFORE UPDATE ON public.rentals
FOR EACH ROW
EXECUTE FUNCTION public.tg_rental_block_double_close();