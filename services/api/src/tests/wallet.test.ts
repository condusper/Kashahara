import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { newId, newReference } from '../crypto';
import { PaystackClient } from '../paystack';
import { jsonRequest, makeHarness, registerUser, startServer } from './helpers';
import { WalletService } from '../services/wallet';
import type { FundingRecord } from '../types';

function verifyClient(payload: Record<string, unknown>): PaystackClient {
  return new PaystackClient({
    secretKey: 'sk_test_verification',
    baseUrl: 'https://api.paystack.co',
    fetchImpl: (async () =>
      new Response(JSON.stringify({ status: true, data: payload }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch,
  });
}

async function createFunding(
  harness: ReturnType<typeof makeHarness>,
  userId: string,
  options: { amountKobo: number; createdAt: Date },
): Promise<FundingRecord> {
  return harness.store.createFunding({
    id: newId(),
    userId,
    reference: newReference('KSH-FUND'),
    amountKobo: options.amountKobo,
    status: 'awaiting_payment',
    provider: 'paystack',
    providerReference: null,
    authorizationUrl: 'https://checkout.paystack.com/test',
    simulated: false,
    metadata: {},
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
    completedAt: null,
  });
}

describe('wallet ledger and simulated funding', () => {
  it('credits simulated funding once and keeps the ledger reconciled', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);

    const initialized = await harness.services.wallet.initializeFunding(
      session.user.id,
      250_000,
      session.user.email,
    );
    assert.equal(initialized.mode, 'simulated');
    assert.equal(initialized.funding.status, 'awaiting_payment');

    const first = await harness.services.wallet.simulateFunding(
      session.user.id,
      initialized.funding.reference,
    );
    assert.equal(first.funding.status, 'successful');
    assert.equal(first.wallet.balanceKobo, 250_000);

    const second = await harness.services.wallet.simulateFunding(
      session.user.id,
      initialized.funding.reference,
    );
    assert.equal(second.wallet.balanceKobo, 250_000);

    const reconciliation = await harness.services.wallet.reconcile(session.user.id);
    assert.equal(reconciliation.matches, true);
    assert.equal(reconciliation.walletBalanceKobo, 250_000);
    assert.equal(reconciliation.ledgerBalanceKobo, 250_000);

    const ledger = await harness.services.wallet.getLedger(session.user.id);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]?.direction, 'credit');
    assert.equal(ledger[0]?.amountKobo, 250_000);
  });

  it('refuses to credit a different amount under an existing ledger reference', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);
    await harness.services.wallet.initializeFunding(
      session.user.id,
      100_000,
      session.user.email,
    );

    await harness.store.transaction(async (tx) => {
      await harness.services.wallet.credit(tx, {
        userId: session.user.id,
        amountKobo: 100_000,
        reference: 'test:credit-once',
        kind: 'test',
      });
    });

    await assert.rejects(
      harness.store.transaction(async (tx) => {
        await harness.services.wallet.credit(tx, {
          userId: session.user.id,
          amountKobo: 200_000,
          reference: 'test:credit-once',
          kind: 'test',
        });
      }),
      /different amount/,
    );
  });

  it('rejects debits that exceed the wallet balance', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);

    await assert.rejects(
      harness.store.transaction(async (tx) => {
        await harness.services.wallet.debit(tx, {
          userId: session.user.id,
          amountKobo: 1_000,
          reference: 'test:debit-too-much',
          kind: 'test',
        });
      }),
      /balance is too low/,
    );

    const wallet = await harness.services.wallet.getWallet(session.user.id);
    assert.equal(wallet.balanceKobo, 0);
  });
});

describe('Paystack funding callbacks', () => {
  function paystackInitializeHarness(overrides: Record<string, string> = {}) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const harness = makeHarness(
      { PAYSTACK_SECRET_KEY: 'sk_test_callback', ...overrides },
      (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        calls.push({ url: String(input), init: init ?? {} });
        return new Response(
          JSON.stringify({
            status: true,
            data: {
              authorization_url: 'https://checkout.paystack.com/abc',
              access_code: 'abc',
              reference: 'KSH-FUND-PROVIDER',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }) as typeof fetch,
    );
    return { harness, calls };
  }

  it('sends the app callback to Paystack and returns it with the attempt', async () => {
    const { harness, calls } = paystackInitializeHarness();
    const session = await registerUser(harness);
    const callbackBase = 'exp://192.168.1.2:8081/--/funding';

    const result = await harness.services.wallet.initializeFunding(
      session.user.id,
      250_000,
      session.user.email,
      callbackBase,
    );

    const expected = `${callbackBase}/${result.funding.reference}`;
    assert.equal(result.callbackUrl, expected);
    assert.equal(result.funding.metadata.callbackUrl, expected);
    assert.equal(calls.length, 1);
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    assert.equal(body.callback_url, expected);
  });

  it('falls back to the configured callback when the app one is not allowed', async () => {
    const { harness, calls } = paystackInitializeHarness({
      PAYSTACK_CALLBACK_URL: 'kashahara://funding/{reference}',
    });
    const session = await registerUser(harness);

    const result = await harness.services.wallet.initializeFunding(
      session.user.id,
      250_000,
      session.user.email,
      'javascript:alert(1)',
    );

    assert.equal(
      result.callbackUrl,
      `kashahara://funding/${result.funding.reference}`,
    );
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    assert.equal(body.callback_url, result.callbackUrl);
  });

  it('refuses Expo callbacks in production and uses the configured deep link', async () => {
    const { harness } = paystackInitializeHarness({
      PAYSTACK_CALLBACK_URL: 'kashahara://funding/{reference}',
    });
    const session = await registerUser(harness);
    const wallet = new WalletService(
      harness.store,
      { ...harness.config, env: 'production' },
      harness.paystack,
    );

    const result = await wallet.initializeFunding(
      session.user.id,
      250_000,
      session.user.email,
      'exp://192.168.1.2:8081/--/funding',
    );

    assert.equal(
      result.callbackUrl,
      `kashahara://funding/${result.funding.reference}`,
    );
  });

  it('exposes the callback on the funding response over HTTP', async () => {
    const { harness } = paystackInitializeHarness();
    const session = await registerUser(harness);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const response = await jsonRequest(`${server.baseUrl}/wallet/funding`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Idempotency-Key': 'test-funding-callback',
        },
        body: JSON.stringify({
          amountKobo: 250_000,
          callbackUrl: 'kashahara://funding',
        }),
      });
      assert.equal(response.status, 201);
      assert.equal(
        response.body.callbackUrl,
        `kashahara://funding/${response.body.funding.reference}`,
      );
      assert.equal(response.body.funding.callbackUrl, response.body.callbackUrl);
    } finally {
      await server.close();
    }
  });
});

describe('Paystack funding verification', () => {
  it('keeps a fresh unpaid checkout open instead of marking it abandoned', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);
    const now = new Date('2026-10-31T12:00:00.000Z');
    const funding = await createFunding(harness, session.user.id, {
      amountKobo: 10_000,
      createdAt: now,
    });
    const wallet = new WalletService(
      harness.store,
      harness.config,
      verifyClient({
        status: 'abandoned',
        reference: funding.reference,
        amount: funding.amountKobo,
        currency: 'NGN',
      }),
      () => now,
    );

    const status = await wallet.getFundingStatus(session.user.id, funding.reference);
    assert.equal(status.funding.status, 'awaiting_payment');
  });

  it('closes a checkout as abandoned after the grace period', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);
    const now = new Date('2026-10-31T12:00:00.000Z');
    const funding = await createFunding(harness, session.user.id, {
      amountKobo: 10_000,
      createdAt: new Date(now.getTime() - 31 * 60 * 1000),
    });
    const wallet = new WalletService(
      harness.store,
      harness.config,
      verifyClient({
        status: 'abandoned',
        reference: funding.reference,
        amount: funding.amountKobo,
        currency: 'NGN',
      }),
      () => now,
    );

    const status = await wallet.getFundingStatus(session.user.id, funding.reference);
    assert.equal(status.funding.status, 'abandoned');
  });

  it('credits a verified successful payment exactly once', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);
    const funding = await createFunding(harness, session.user.id, {
      amountKobo: 10_000,
      createdAt: new Date(),
    });
    const wallet = new WalletService(
      harness.store,
      harness.config,
      verifyClient({
        status: 'success',
        reference: funding.reference,
        amount: funding.amountKobo,
        currency: 'NGN',
        paid_at: '2026-10-31T12:00:00.000Z',
      }),
    );

    const first = await wallet.getFundingStatus(session.user.id, funding.reference);
    assert.equal(first.funding.status, 'successful');
    assert.equal(first.wallet.balanceKobo, 10_000);

    const second = await wallet.getFundingStatus(session.user.id, funding.reference);
    assert.equal(second.wallet.balanceKobo, 10_000);
  });

  it('settles a paid checkout while reconciling pending fundings', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);
    const funding = await createFunding(harness, session.user.id, {
      amountKobo: 10_000,
      createdAt: new Date(),
    });
    const wallet = new WalletService(
      harness.store,
      harness.config,
      verifyClient({
        status: 'success',
        reference: funding.reference,
        amount: funding.amountKobo,
        currency: 'NGN',
        paid_at: '2026-10-31T12:00:00.000Z',
      }),
    );

    const first = await wallet.reconcilePendingFundings(session.user.id);
    assert.deepEqual(first, { checked: 1, credited: 1 });
    const afterFirst = await wallet.getWallet(session.user.id);
    assert.equal(afterFirst.balanceKobo, 10_000);

    const second = await wallet.reconcilePendingFundings(session.user.id);
    assert.deepEqual(second, { checked: 0, credited: 0 });

    const ledger = await wallet.getLedger(session.user.id);
    assert.equal(ledger.length, 1);
    assert.equal(ledger[0]?.reference, `paystack:${funding.reference}`);
    const reconciliation = await wallet.reconcile(session.user.id);
    assert.equal(reconciliation.matches, true);
  });

  it('credits a paid checkout when the wallet is loaded over HTTP', async () => {
    const reference = 'KSH-FUND-WALLET-LOAD';
    const harness = makeHarness(
      { PAYSTACK_SECRET_KEY: 'sk_test_wallet_load' },
      (async () =>
        new Response(
          JSON.stringify({
            status: true,
            data: {
              status: 'success',
              reference,
              amount: 10_000,
              currency: 'NGN',
              paid_at: '2026-10-31T12:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )) as typeof fetch,
    );
    const session = await registerUser(harness);
    const now = new Date();
    await harness.store.createFunding({
      id: newId(),
      userId: session.user.id,
      reference,
      amountKobo: 10_000,
      status: 'awaiting_payment',
      provider: 'paystack',
      providerReference: reference,
      authorizationUrl: 'https://checkout.paystack.com/test',
      simulated: false,
      metadata: {},
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const response = await jsonRequest(`${server.baseUrl}/wallet`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.wallet.balanceKobo, 10_000);
      assert.equal(response.body.ledger.length, 1);
      assert.equal(response.body.ledger[0].reference, `paystack:${reference}`);
      assert.equal(response.body.reconciliation.matches, true);
    } finally {
      await server.close();
    }
  });
});
