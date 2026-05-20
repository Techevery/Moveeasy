ALTER TABLE public.agreement_acknowledgements
ADD COLUMN IF NOT EXISTS renter_data jsonb NOT NULL DEFAULT '{}'::jsonb;