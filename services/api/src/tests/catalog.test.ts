import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MockVtuProvider } from '../providers';
import { CatalogService } from '../services/catalog';

describe('catalogue pricing', () => {
  it('exposes the configured airtime fee to clients', async () => {
    const catalog = new CatalogService(new MockVtuProvider(), {
      percent: 4,
      minKobo: 200,
    });

    const resolved = await catalog.getCatalog();

    assert.deepEqual(resolved.airtimeFee, { percent: 4, minKobo: 200 });
  });

  it('falls back to the bundled default fee', async () => {
    const catalog = new CatalogService(new MockVtuProvider());

    const resolved = await catalog.getCatalog();

    assert.deepEqual(resolved.airtimeFee, { percent: 2.5, minKobo: 100 });
  });
});
