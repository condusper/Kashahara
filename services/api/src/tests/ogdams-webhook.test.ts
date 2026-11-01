import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { newId } from '../crypto';
import type { TransactionRecord } from '../types';
import {
  fundWallet,
  makeHarness,
  registerUser,
  startServer,
  type Harness,
} from './helpers';

const OGDAMS_SECRET = 'sk_live_ogdams_webhook_test_secret';

function sign(raw: string): string {
  return createHmac('sha512', OGDAMS_SECRET).update(raw).digest('hex');
}

async function postOgdamsWebhook(
  baseUrl: string,
  payload: unknown,
  signature?: string,
): Promise<{ status: number; body: any }> {
  const raw = JSON.stringify(payload);
  const response = await fetch(`${baseUrl}/webhooks/ogdams`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ogdams-simhosting-signature': signature ?? sign(raw),
    },
    body: raw,
  });
  return { status: response.status, body: await response.json() };
}

async function createProcessingOrder(
  harness: Harness,
  userId: string,
  reference: string,
  providerReference: string,
  amountKobo: number,
): Promise<TransactionRecord> {
  await fundWallet(harness, userId, 100_000);
  const now = new Date();
  const id = newId();
  const transaction = await harness.store.createTransaction({
    id,
    userId,
    reference,
    type: 'airtime',
    status: 'processing',
    amountKobo,
    feeKobo: 0,
    currency: 'NGN',
    recipient: { network: 'MTN', phone: '08031234567' },
    details: {},
    providerReference: null,
    failureReason: null,
    simulated: false,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });

  await harness.store.transaction(async (tx) => {
    await harness.services.wallet.debit(tx, {
      userId,
      amountKobo,
      reference: `purchase:${reference}`,
      kind: 'airtime',
      transactionId: id,
      metadata: { type: 'airtime', reference },
    });
    await tx.updateTransaction(
      id,
      { status: 'processing', providerReference },
      now,
    );
  });

  return transaction;
}

describe('Ogdams webhook', () => {
  it('rejects a webhook with an invalid signature', async () => {
    const harness = makeHarness({ OGDAMS_API_KEY: OGDAMS_SECRET });
    const session = await registerUser(harness);
    const reference = 'KSH-AIR-WH-BAD-SIG';
    await createProcessingOrder(harness, session.user.id, reference, 'OGD-PROV-BAD', 10_000);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const response = await postOgdamsWebhook(
        server.baseUrl,
        { status: true, code: 200, data: { msg: 'Airtime delivered', ref: 'OGD-PROV-BAD' } },
        'not-a-valid-signature',
      );
      assert.equal(response.status, 401);

      const transaction = await harness.store.getTransactionByReference(reference);
      assert.equal(transaction?.status, 'processing');
      const wallet = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(wallet.balanceKobo, 90_000);
    } finally {
      await server.close();
    }
  });

  it('marks the order successful and keeps the debit on a success callback', async () => {
    const harness = makeHarness({ OGDAMS_API_KEY: OGDAMS_SECRET });
    const session = await registerUser(harness);
    const reference = 'KSH-AIR-WH-SUCCESS';
    await createProcessingOrder(harness, session.user.id, reference, 'OGD-PROV-OK', 10_000);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const response = await postOgdamsWebhook(server.baseUrl, {
        status: true,
        code: 200,
        data: { msg: 'Airtime delivered', ref: 'OGD-PROV-OK' },
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.processed, true);
      assert.equal(response.body.outcome, 'successful');

      const transaction = await harness.store.getTransactionByReference(reference);
      assert.equal(transaction?.status, 'successful');
      assert.equal(transaction?.providerReference, 'OGD-PROV-OK');
      assert.ok(transaction?.completedAt);

      const wallet = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(wallet.balanceKobo, 90_000);
    } finally {
      await server.close();
    }
  });

  it('refunds the wallet on a failure callback and ignores the duplicate', async () => {
    const harness = makeHarness({ OGDAMS_API_KEY: OGDAMS_SECRET });
    const session = await registerUser(harness);
    const reference = 'KSH-AIR-WH-FAILED';
    await createProcessingOrder(harness, session.user.id, reference, 'OGD-PROV-FAIL', 10_000);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const payload = {
        status: false,
        code: 424,
        data: { msg: 'Airtime delivery failed at the supplier', ref: 'OGD-PROV-FAIL' },
      };
      const first = await postOgdamsWebhook(server.baseUrl, payload);
      assert.equal(first.status, 200);
      assert.equal(first.body.processed, true);
      assert.equal(first.body.outcome, 'failed');

      const transaction = await harness.store.getTransactionByReference(reference);
      assert.equal(transaction?.status, 'refunded');
      assert.equal(transaction?.failureReason, 'Airtime delivery failed at the supplier');

      const wallet = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(wallet.balanceKobo, 100_000);

      const ledger = await harness.services.wallet.getLedger(session.user.id);
      assert.equal(ledger.filter((entry) => entry.kind !== 'wallet_funding').length, 2);
      const reversal = ledger.find(
        (entry) => entry.reference === `reversal:purchase:${reference}`,
      );
      assert.ok(reversal);
      assert.equal(reversal.direction, 'credit');

      const duplicate = await postOgdamsWebhook(server.baseUrl, payload);
      assert.equal(duplicate.status, 200);
      assert.equal(duplicate.body.processed, false);
      assert.equal(duplicate.body.reason, 'duplicate');

      const after = await harness.services.wallet.getWallet(session.user.id);
      assert.equal(after.balanceKobo, 100_000);
    } finally {
      await server.close();
    }
  });

  it('acknowledges an unknown supplier reference without a refund', async () => {
    const harness = makeHarness({ OGDAMS_API_KEY: OGDAMS_SECRET });
    await registerUser(harness);
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
    });

    try {
      const response = await postOgdamsWebhook(server.baseUrl, {
        status: true,
        code: 200,
        data: { msg: 'Airtime delivered', ref: 'OGD-UNKNOWN-REF' },
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.processed, false);
      assert.equal(response.body.reason, 'unknown_reference');
    } finally {
      await server.close();
    }
  });
});
