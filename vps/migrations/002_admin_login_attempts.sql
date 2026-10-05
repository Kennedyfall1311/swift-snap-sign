CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  email_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.admin_login_attempts TO assinaturas_app;
CREATE INDEX IF NOT EXISTS admin_login_attempts_ip_idx ON public.admin_login_attempts (ip_address, created_at DESC);