CREATE OR REPLACE FUNCTION public.tg_validate_rental_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.service_type = 'storage' AND NEW.unit_id IS NULL THEN
    RAISE EXCEPTION 'Storage rentals require a storage unit';
  END IF;
  IF NEW.service_type = 'moving' AND (NEW.pickup_address IS NULL OR NEW.destination_address IS NULL) THEN
    RAISE EXCEPTION 'Moving services require pickup and destination addresses';
  END IF;
  RETURN NEW;
END $$;
