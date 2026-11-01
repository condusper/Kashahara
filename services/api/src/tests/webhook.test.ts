import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hmacSha512Hex, newId } from '../crypto';
import type { FundingRecord } from '../types';
import {
  makeHarness,
  registerUser,
  startServer,
  TEST_EMAIL,
} from './helpers';

const SECRET = 'sk_test_webhook_secret_for_tests';

function verifyingFetch(
  payload: Record<string, unknown> | (() => Record<string, unknown>),
): typeof fetch {
  return (async () => {
    const data = typeof payload === 'function' ? payload() : payload;
    return new Response(JSON.stringify({ status: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
}

async function createFunding(
  harness: ReturnType<typeof makeHarness>,
  userId: string,
  reference: string,
  amountKobo: number,
): Promise<FundingRecord> {
  const now = new Date();
  return harness.store.createFunding({
    id: newId(),
    userId,
    reference,
    amountKobo,
    status: 'awaiting_payment',
    provider: 'paystack',
    providerReference: null,
    authorizationUrl: 'https://checkout.paystack.com/test',
    simulated: false,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

async function postWebhook(
  baseUrl: string,
  payload: unknown,
  signature?: string,
): Promise<{ status: number; body: any }> {
  const raw = JSON.stringify(payload);
  const response = await fetch(`${baseUrl}/webhooks/paystack`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': signature ?? hmacSha512Hex(SECRET, raw),
    },
    body: raw,
  });
  return { status: response.status, body: await response.json() };
}

describe('Paystack webhook', () => {
  it('credits a verified payment once and ignores a duplicate event', async () => {
    const harness = makeHarness({ PAYSTACK_SECRET_KEY: SECRET });
    const session = await registerUser(harness);
    await createFunding(harness, session.user.id, 'KSH-FUND-WEBHOOK-1', 250_000);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    const payload = {
      event: 'charge.success',
      data: {
        id: 123456,
        reference: 'KSH-FUND-WEBHOOK-1',
        amount: 250_000,
        currency: 'NGN',
        paid_at: '2026-10-30T10:00:00.000Z',
      },
    };

    try {
      const first = await postWebhook(server.baseUrl, payload);
      assert.equal(first.status, 200);
      assert.equal(first.body.processed, true);

      const wallet = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(wallet.balanceKobo, 250_000);

      const duplicate = await postWebhook(server.baseUrl, payload);
      assert.equal(duplicate.status, 200);
      assert.equal(duplicate.body.processed, false);
      assert.equal(duplicate.body.reason, 'duplicate');

      const after = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(after.balanceKobo, 250_000);

      const reconciliation = await harness.services.wallet.reconcile(session.user.id);
      assert.equal(reconciliation.matches, true);
    } finally {
      await server.close();
    }
  });

  it('rejects an invalid signature without changing the wallet', async () => {
    const harness = makeHarness({ PAYSTACK_SECRET_KEY: SECRET });
    const session = await registerUser(harness);
    await createFunding(harness, session.user.id, 'KSH-FUND-WEBHOOK-2', 250_000);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const response = await postWebhook(
        server.baseUrl,
        {
          event: 'charge.success',
          data: {
            id: 2,
            reference: 'KSH-FUND-WEBHOOK-2',
            amount: 250_000,
            currency: 'NGN',
          },
        },
        'not-a-valid-signature',
      );
      assert.equal(response.status, 401);

      const wallet = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(wallet.balanceKobo, 0);
    } finally {
      await server.close();
    }
  });

  it('does not credit a payment whose amount does not match', async () => {
    const harness = makeHarness({ PAYSTACK_SECRET_KEY: SECRET });
    const session = await registerUser(harness);
    await createFunding(harness, session.user.id, 'KSH-FUND-WEBHOOK-3', 250_000);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const response = await postWebhook(server.baseUrl, {
        event: 'charge.success',
        data: {
          id: 3,
          reference: 'KSH-FUND-WEBHOOK-3',
          amount: 100,
          currency: 'NGN',
        },
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.processed, false);
      assert.equal(response.body.reason, 'amount_or_currency_mismatch');

      const wallet = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(wallet.balanceKobo, 0);

      const funding = await harness.store.getFundingByReference('KSH-FUND-WEBHOOK-3');
      assert.equal(funding?.status, 'failed');
    } finally {
      await server.close();
    }
  });

  it('acknowledges an unknown reference without creating a credit', async () => {
    const harness = makeHarness({ PAYSTACK_SECRET_KEY: SECRET });
    const session = await registerUser(harness);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const response = await postWebhook(server.baseUrl, {
        event: 'charge.success',
        data: {
          id: 4,
          reference: 'KSH-FUND-UNKNOWN',
          amount: 100_000,
          currency: 'NGN',
        },
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.processed, false);
      assert.equal(response.body.reason, 'unknown_reference');

      const wallet = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(wallet.balanceKobo, 0);
    } finally {
      await server.close();
    }
  });

  it('recovers a lost funding record by matching the customer email', async () => {
    const reference = 'KSH-FUND-RECOVER-EMAIL';
    const harness = makeHarness(
      { PAYSTACK_SECRET_KEY: SECRET },
      verifyingFetch({
        status: 'success',
        reference,
        amount: 10_000,
        currency: 'NGN',
        paid_at: '2026-10-31T18:08:50.000Z',
      }),
    );
    const session = await registerUser(harness);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    const payload = {
      event: 'charge.success',
      data: {
        id: 9001,
        reference,
        amount: 10_000,
        currency: 'NGN',
        paid_at: '2026-10-31T18:08:50.000Z',
        metadata: { userId: 'user-from-before-the-restart', purpose: 'wallet_funding' },
        customer: { email: TEST_EMAIL },
      },
    };

    try {
      const first = await postWebhook(server.baseUrl, payload);
      assert.equal(first.status, 200);
      assert.equal(first.body.processed, true);
      assert.equal(first.body.reason, 'recovered_missing_funding');

      const wallet = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(wallet.balanceKobo, 10_000);

      const funding = await harness.store.getFundingByReference(reference);
      assert.equal(funding?.status, 'successful');
      assert.equal(funding?.userId, session.user.id);
      assert.equal(funding?.metadata.matchedBy, 'email');
      assert.equal(funding?.metadata.recovered, true);

      const ledger = await harness.services.wallet.getLedger(session.user.id);
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0]?.reference, `paystack:${reference}`);

      const duplicate = await postWebhook(server.baseUrl, payload);
      assert.equal(duplicate.body.processed, false);
      assert.equal(duplicate.body.reason, 'duplicate');
      const after = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(after.balanceKobo, 10_000);
    } finally {
      await server.close();
    }
  });

  it('recovers a lost funding record by matching metadata userId', async () => {
    const reference = 'KSH-FUND-RECOVER-METADATA';
    const harness = makeHarness(
      { PAYSTACK_SECRET_KEY: SECRET },
      verifyingFetch({
        status: 'success',
        reference,
        amount: 25_000,
        currency: 'NGN',
        paid_at: '2026-10-31T18:10:00.000Z',
      }),
    );
    const session = await registerUser(harness);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const response = await postWebhook(server.baseUrl, {
        event: 'charge.success',
        data: {
          id: 9002,
          reference,
          amount: 25_000,
          currency: 'NGN',
          metadata: { userId: session.user.id, purpose: 'wallet_funding' },
        },
      });
      assert.equal(response.body.processed, true);
      assert.equal(response.body.reason, 'recovered_missing_funding');

      const wallet = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(wallet.balanceKobo, 25_000);

      const funding = await harness.store.getFundingByReference(reference);
      assert.equal(funding?.metadata.matchedBy, 'metadata');
    } finally {
      await server.close();
    }
  });

  it('retries later when Paystack verification is unavailable', async () => {
    const reference = 'KSH-FUND-RECOVER-RETRY';
    let calls = 0;
    const flakyFetch = (async () => {
      calls += 1;
      if (calls === 1) throw new Error('network down');
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            status: 'success',
            reference,
            amount: 50_000,
            currency: 'NGN',
            paid_at: '2026-10-31T18:12:00.000Z',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const harness = makeHarness({ PAYSTACK_SECRET_KEY: SECRET }, flakyFetch);
    const session = await registerUser(harness);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    const payload = {
      event: 'charge.success',
      data: {
        id: 9003,
        reference,
        amount: 50_000,
        currency: 'NGN',
        metadata: { userId: session.user.id, purpose: 'wallet_funding' },
      },
    };

    try {
      const first = await postWebhook(server.baseUrl, payload);
      assert.equal(first.body.processed, false);
      assert.equal(first.body.reason, 'verification_unavailable');
      const before = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(before.balanceKobo, 0);

      const retry = await postWebhook(server.baseUrl, payload);
      assert.equal(retry.body.processed, true);
      assert.equal(retry.body.reason, 'recovered_missing_funding');
      const after = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(after.balanceKobo, 50_000);
    } finally {
      await server.close();
    }
  });
});
