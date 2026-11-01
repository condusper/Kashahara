import type { PoolConfig } from 'pg';

/**
 * node-postgres does not inherit libpq's `sslmode=prefer` default, so a managed
 * Postgres that requires TLS fails on the first query with "SSL/TLS required".
 *
 * Turn TLS on for anything that is not a local database, unless the connection
 * string already states its SSL mode. `rejectUnauthorized: false` keeps the
 * connection encrypted without pinning a CA; Render does not publish one.
 */
export function poolConfig(connectionString: string, max: number): PoolConfig {
  const config: PoolConfig = { connectionString, max };
  if (/[?&]sslmode=/.test(connectionString)) {
    return config;
  }
  if (isLocalHost(hostnameOf(connectionString))) {
    return config;
  }
  config.ssl = { rejectUnauthorized: false };
  return config;
}

function hostnameOf(connectionString: string): string {
  try {
    return new URL(connectionString).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return '';
  }
}

function isLocalHost(host: string): boolean {
  return host === '' || host === 'localhost' || host === '127.0.0.1' || host === '::1';
}
