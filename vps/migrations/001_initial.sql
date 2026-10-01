-- Instalação limpa para PostgreSQL 16. Execute como assinaturas_app; não aplique migrations do Lovable Cloud.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE public.sign_status AS ENUM ('PENDENTE', 'ASSINADO', 'CANCELADO');
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.users TO assinaturas_app;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO assinaturas_app;

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO assinaturas_app;
CREATE INDEX sessions_user_idx ON public.sessions (user_id, expires_at);

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  tipo_pessoa text NOT NULL DEFAULT 'PF' CHECK (tipo_pessoa IN ('PF', 'PJ')),
  name text NOT NULL,
  cpf text NOT NULL,
  phone text NOT NULL DEFAULT '',
  rg text,
  orgao_expedidor text,
  apelido text,
  endereco text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  pais text NOT NULL DEFAULT 'Brasil',
  cep text,
  notes text,
  status public.sign_status NOT NULL DEFAULT 'PENDENTE',
  signed_at timestamptz,
  photo_path text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO assinaturas_app;
CREATE INDEX clients_cpf_idx ON public.clients (cpf);

CREATE TABLE public.signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  token_ciphertext text NOT NULL,
  title text NOT NULL DEFAULT 'Confirmação de assinatura',
  description text,
  require_photo boolean NOT NULL DEFAULT true,
  signer_name text,
  signer_cpf text,
  signer_document text,
  photo_path text,
  signature_path text,
  signed_at timestamptz,
  ip_address text,
  user_agent text,
  status public.sign_status NOT NULL DEFAULT 'PENDENTE',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signatures TO assinaturas_app;
-- Sem UNIQUE(client_id): toda solicitação mantém sua própria identidade e seus próprios arquivos.
CREATE INDEX signatures_client_history_idx ON public.signatures (client_id, created_at DESC);
CREATE INDEX signatures_status_idx ON public.signatures (status);

CREATE TABLE public.signature_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id uuid NOT NULL REFERENCES public.signatures(id) ON DELETE RESTRICT,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  content_type text NOT NULL CHECK (content_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  file_size integer NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_documents TO assinaturas_app;
CREATE INDEX signature_documents_signature_idx ON public.signature_documents (signature_id);

CREATE TABLE public.app_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  company_name text NOT NULL DEFAULT 'Minha Empresa',
  logo_data text,
  whatsapp_message text NOT NULL DEFAULT 'Olá, {NOME}. Para concluir seu cadastro, acesse o link abaixo e realize sua assinatura:' || E'\n\n' || '{LINK}',
  client_intro_text text NOT NULL DEFAULT 'Para concluir, informe seus dados e tire uma foto.',
  link_expiry_days integer NOT NULL DEFAULT 7 CHECK (link_expiry_days BETWEEN 0 AND 365),
  privacy_text text NOT NULL DEFAULT 'Seus dados (nome, CPF e foto) são coletados exclusivamente para confirmar sua identidade e comprovar esta assinatura. São armazenados de forma segura, acessíveis apenas pela empresa responsável, e tratados conforme a Lei Geral de Proteção de Dados (LGPD). Você pode solicitar informações ou a exclusão dos seus dados entrando em contato com a empresa.',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.app_settings TO assinaturas_app;
INSERT INTO public.app_settings (id) VALUES ('default');

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity text,
  entity_id uuid,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO assinaturas_app;
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);

CREATE TABLE public.sign_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  token_hash text,
  success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.sign_attempts TO assinaturas_app;
CREATE INDEX sign_attempts_ip_idx ON public.sign_attempts (ip_address, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER settings_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
