-- Add service type to support both Storage and Moving services
CREATE TYPE public.service_type AS ENUM ('storage', 'moving');

ALTER TABLE public.rentals
  ADD COLUMN service_type public.service_type NOT NULL DEFAULT 'storage',
  ADD COLUMN pickup_address text,
  ADD COLUMN destination_address text,
  ADD COLUMN move_date date,
  ADD COLUMN move_time_start time,
  ADD COLUMN move_time_end time,
  ADD COLUMN vehicle_type text,
  ADD COLUMN crew jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN inventory jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN service_notes text;

-- Moving jobs don't need a storage unit
ALTER TABLE public.rentals ALTER COLUMN unit_id DROP NOT NULL;

-- Ensure data integrity: storage requires unit, moving requires pickup+destination
CREATE OR REPLACE FUNCTION public.tg_validate_rental_service()
RETURNS trigger
LANGUAGE plpgsql
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

CREATE TRIGGER trg_validate_rental_service
BEFORE INSERT OR UPDATE ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.tg_validate_rental_service();
