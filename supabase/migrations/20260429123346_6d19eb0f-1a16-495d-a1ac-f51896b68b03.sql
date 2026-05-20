-- Document kind enum
CREATE TYPE public.document_kind AS ENUM ('contract', 'receipt', 'id', 'other');

-- Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  rental_id UUID REFERENCES public.rentals(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  kind public.document_kind NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_customer ON public.documents(customer_id);
CREATE INDEX idx_documents_rental ON public.documents(rental_id);
CREATE INDEX idx_documents_payment ON public.documents(payment_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff manages documents" ON public.documents
  FOR ALL TO authenticated
  USING (public.is_staff_or_admin(auth.uid()))
  WITH CHECK (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "customer reads own documents" ON public.documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = documents.customer_id AND c.user_id = auth.uid()
    )
  );

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Audit history
CREATE TABLE public.document_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('uploaded','downloaded','deleted','updated')),
  actor UUID,
  actor_role TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_document_audit_doc ON public.document_audit(document_id);

ALTER TABLE public.document_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff reads all audit" ON public.document_audit
  FOR SELECT TO authenticated
  USING (public.is_staff_or_admin(auth.uid()));

CREATE POLICY "customer reads own audit" ON public.document_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.id = document_audit.document_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "auth inserts audit" ON public.document_audit
  FOR INSERT TO authenticated
  WITH CHECK (actor = auth.uid());

-- Private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: staff full access; customers read only files linked to their documents
CREATE POLICY "staff manages document files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'documents' AND public.is_staff_or_admin(auth.uid()))
  WITH CHECK (bucket_id = 'documents' AND public.is_staff_or_admin(auth.uid()));

CREATE POLICY "customer reads own document files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents' AND EXISTS (
      SELECT 1 FROM public.documents d
      JOIN public.customers c ON c.id = d.customer_id
      WHERE d.storage_path = storage.objects.name
        AND c.user_id = auth.uid()
    )
  );