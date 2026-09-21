ALTER TABLE public.clients
  ADD COLUMN codigo TEXT,
  ADD COLUMN tipo_pessoa TEXT NOT NULL DEFAULT 'PF',
  ADD COLUMN rg TEXT,
  ADD COLUMN orgao_expedidor TEXT,
  ADD COLUMN apelido TEXT,
  ADD COLUMN endereco TEXT,
  ADD COLUMN complemento TEXT,
  ADD COLUMN bairro TEXT,
  ADD COLUMN cidade TEXT,
  ADD COLUMN uf TEXT,
  ADD COLUMN pais TEXT NOT NULL DEFAULT 'Brasil',
  ADD COLUMN cep TEXT,
  ADD COLUMN photo_path TEXT;

UPDATE public.clients SET codigo = 'CLI-' || upper(substr(replace(id::text, '-', ''), 1, 8)) WHERE codigo IS NULL;
ALTER TABLE public.clients ALTER COLUMN codigo SET NOT NULL;
ALTER TABLE public.clients ADD CONSTRAINT clients_codigo_unique UNIQUE (codigo);
ALTER TABLE public.clients ADD CONSTRAINT clients_tipo_pessoa_valid CHECK (tipo_pessoa IN ('PF', 'PJ'));
CREATE INDEX clients_document_idx ON public.clients (cpf);
CREATE INDEX clients_codigo_search_idx ON public.clients (lower(codigo));

ALTER TABLE public.signatures
  ADD COLUMN title TEXT NOT NULL DEFAULT 'Confirmação de assinatura',
  ADD COLUMN description TEXT,
  ADD COLUMN require_photo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN signature_path TEXT,
  ADD COLUMN signer_document TEXT;

CREATE TABLE public.signature_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id UUID NOT NULL REFERENCES public.signatures(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT signature_documents_size_valid CHECK (file_size > 0 AND file_size <= 10485760),
  CONSTRAINT signature_documents_type_valid CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_documents TO authenticated;
GRANT ALL ON public.signature_documents TO service_role;
ALTER TABLE public.signature_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signature_documents_admin_all" ON public.signature_documents FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin')) WITH CHECK (private.has_role(auth.uid(), 'admin'));
CREATE INDEX signature_documents_signature_idx ON public.signature_documents (signature_id);

CREATE POLICY "documents_admin_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY "signature_marks_admin_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'signature-marks' AND private.has_role(auth.uid(), 'admin'));