import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fundWallet,
  jsonRequest,
  makeHarness,
  registerUser,
  setPin,
  startServer,
  TEST_PIN,
} from './helpers';

describe('HTTP idempotency', () => {
  it('replays a completed purchase and refuses a reused key with different data', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);
    await setPin(harness, session.user.id);
    await fundWallet(harness, session.user.id, 500_000);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const headers = {
        Authorization: `Bearer ${session.accessToken}`,
        'Idempotency-Key': 'purchase-key-0001',
      };
      const body = {
        network: 'MTN',
        phone: '08031234567',
        amountKobo: 10_000,
        pin: TEST_PIN,
      };

      const first = await jsonRequest(`${server.baseUrl}/purchases/airtime`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      assert.equal(first.status, 201);
      const firstId = first.body.transaction.id;
      assert.equal(first.body.transaction.status, 'successful');

      const second = await jsonRequest(`${server.baseUrl}/purchases/airtime`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      assert.equal(second.status, 201);
      assert.equal(second.headers.get('idempotent-replay'), 'true');
      assert.equal(second.body.transaction.id, firstId);

      const wallet = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(wallet.balanceKobo, 489_700);

      const conflict = await jsonRequest(`${server.baseUrl}/purchases/airtime`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, amountKobo: 20_000 }),
      });
      assert.equal(conflict.status, 409);
      assert.equal(conflict.body.error.code, 'CONFLICT');

      const still = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(still.balanceKobo, 489_700);
    } finally {
      await server.close();
    }
  });

  it('requires an Idempotency-Key on financial endpoints', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);
    await setPin(harness, session.user.id);
    await fundWallet(harness, session.user.id, 500_000);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const response = await jsonRequest(`${server.baseUrl}/purchases/airtime`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({
          network: 'MTN',
          phone: '08031234567',
          amountKobo: 10_000,
          pin: TEST_PIN,
        }),
      });
      assert.equal(response.status, 400);
      assert.equal(response.body.error.code, 'BAD_REQUEST');

      const wallet = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(wallet.balanceKobo, 500_000);
    } finally {
      await server.close();
    }
  });

  it('does not double-debit concurrent requests that share a key', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);
    await setPin(harness, session.user.id);
    await fundWallet(harness, session.user.id, 500_000);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const headers = {
        Authorization: `Bearer ${session.accessToken}`,
        'Idempotency-Key': 'purchase-key-race-0001',
      };
      const body = JSON.stringify({
        network: 'MTN',
        phone: '08031234567',
        amountKobo: 10_000,
        pin: TEST_PIN,
      });

      const results = await Promise.all([
        jsonRequest(`${server.baseUrl}/purchases/airtime`, {
          method: 'POST',
          headers,
          body,
        }),
        jsonRequest(`${server.baseUrl}/purchases/airtime`, {
          method: 'POST',
          headers,
          body,
        }),
      ]);

      const statuses = results.map((result) => result.status).sort();
      assert.ok(
        statuses[0] === 201 && (statuses[1] === 201 || statuses[1] === 409),
        `unexpected statuses: ${statuses.join(',')}`,
      );

      const wallet = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(wallet.balanceKobo, 489_700);
    } finally {
      await server.close();
    }
  });
});
