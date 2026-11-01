import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { poolConfig } from '../database';

describe('database pool configuration', () => {
  it('uses TLS for a remote database without an explicit sslmode', () => {
    const config = poolConfig(
      'postgresql://user:pass@dpg-example-a.frankfurt-postgres.render.com/db',
      5,
    );

    assert.deepEqual(config.ssl, { rejectUnauthorized: false });
    assert.equal(config.max, 5);
  });

  it('keeps a local database unencrypted', () => {
    assert.equal(
      poolConfig('postgres://user:pass@localhost:5432/db', 5).ssl,
      undefined,
    );
    assert.equal(
      poolConfig('postgres://user:pass@127.0.0.1:5432/db', 5).ssl,
      undefined,
    );
  });

  it('leaves the SSL mode to the connection string when it is explicit', () => {
    const config = poolConfig(
      'postgresql://user:pass@db.example.com/db?sslmode=require',
      5,
    );

    assert.equal(config.ssl, undefined);
  });
});
