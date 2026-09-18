REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
CREATE POLICY "sign_attempts_no_client_access" ON public.sign_attempts FOR SELECT TO authenticated USING (false);