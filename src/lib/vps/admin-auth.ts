import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

/** Checks the active backend on every request; never trusts a client mode flag. */
export const requireAdminBackend = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  if (process.env['DATABASE_URL']) {
    const { requireAdmin } = await import('./auth.server');
    const admin = await requireAdmin();
    return next({ context: { userId: admin.id, supabase: null as unknown as ReturnType<typeof createClient<Database>> } });
  }
  const url = process.env['SUPABASE_URL'], key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const token = getRequest().headers.get('authorization')?.replace(/^Bearer /, '');
  if (!url || !key || !token || token.split('.').length !== 3) throw new Error('Acesso negado');
  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
      headers.set('apikey',key);
      return fetch(input,{ ...init, headers });
    } },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims.sub) throw new Error('Acesso negado');
  return next({ context: { userId: data.claims.sub, supabase } });
});
