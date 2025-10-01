import type { Config } from 'drizzle-kit';

function buildUrlFromPgEnv(): string | undefined {
  const user = process.env.PGUSER;
  const password = process.env.PGPASSWORD;
  const host = process.env.PGHOST;
  const port = process.env.PGPORT || '5432';
  const database = process.env.PGDATABASE || 'postgres';
  if (user && password && host) {
    const encUser = encodeURIComponent(user);
    const encPass = encodeURIComponent(password);
    return `postgresql://${encUser}:${encPass}@${host}:${port}/${database}`;
  }
  return undefined;
}

const url = process.env.POSTGRES_URL || buildUrlFromPgEnv();

if (!url) {
  throw new Error('POSTGRES_URL or PG* environment variables must be set for drizzle-kit');
}

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url,
  },
} satisfies Config;
