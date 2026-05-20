-- Add invoice kind
ALTER TYPE public.document_kind ADD VALUE IF NOT EXISTS 'invoice';

-- Add doc_number column for invoice/receipt numbering
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS doc_number text;
CREATE INDEX IF NOT EXISTS documents_doc_number_idx ON public.documents(doc_number);

-- Storage policies for the 'receipts' bucket
DO $$ BEGIN
  CREATE POLICY "staff manage receipts" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'receipts' AND public.is_staff_or_admin(auth.uid()))
    WITH CHECK (bucket_id = 'receipts' AND public.is_staff_or_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "customer reads own receipts" ON storage.objects
    FOR SELECT TO authenticated
    USING (
      bucket_id = 'receipts'
      AND EXISTS (
        SELECT 1 FROM public.documents d
        JOIN public.customers c ON c.id = d.customer_id
        WHERE d.storage_path = storage.objects.name
          AND c.user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;