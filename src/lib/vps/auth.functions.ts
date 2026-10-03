import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const vpsMode = createServerFn({ method: 'GET' }).handler(() => ({ local: !!process.env['DATABASE_URL'] }));
export const getLocalAdmin = createServerFn({ method: 'GET' }).handler(async () => {
  if (!process.env['DATABASE_URL']) return null;
  const { currentAdmin } = await import('./auth.server');
  return currentAdmin();
});
export const localLogin = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ email: z.string().email(), password: z.string().min(1).max(128) }).parse(data))
  .handler(async ({ data }) => {
    if (!process.env['DATABASE_URL']) throw new Error('Login não disponível');
    const { login } = await import('./auth.server');
    return { ok: await login(data.email, data.password) };
  });
export const localLogout = createServerFn({ method: 'POST' }).handler(async () => {
  if (!process.env['DATABASE_URL']) return;
  const { logout } = await import('./auth.server');
  await logout();
});
export const localChangePassword = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => z.object({ current: z.string().min(1), next: z.string().min(12).max(128) }).parse(data))
  .handler(async ({ data }) => {
    if (!process.env['DATABASE_URL']) throw new Error('Não disponível');
    const { requireAdmin, verifyPassword, hashPassword } = await import('./auth.server');
    const { database } = await import('./db.server');
    const admin = await requireAdmin();
    const { rows } = await database().query('SELECT password_hash FROM users WHERE id=$1', [admin.id]);
    if (!rows[0] || !(await verifyPassword(data.current, rows[0].password_hash))) return { ok: false };
    await database().query('UPDATE users SET password_hash=$1 WHERE id=$2', [await hashPassword(data.next), admin.id]);
    await database().query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [admin.id]);
    return { ok: true };
  });
