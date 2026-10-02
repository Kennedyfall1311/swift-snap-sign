import pg from 'pg';

let pool: pg.Pool | undefined;
export function database() {
  if (!process.env['DATABASE_URL']) throw new Error('DATABASE_URL não configurada');
  pool ??= new pg.Pool({ connectionString: process.env['DATABASE_URL'], max: 10, idleTimeoutMillis: 30000 });
  return pool;
}

export function iso(value: Date | string | null): string | null {
  return value ? new Date(value).toISOString() : null;
}
