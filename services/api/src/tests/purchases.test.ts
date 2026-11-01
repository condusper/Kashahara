import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AirtimeRequest } from '../providers';
import { MockVtuProvider, ProviderPendingError, ProviderTimeoutError } from '../providers';
import type { ProviderPurchaseResult, ProviderStatusResult } from '../types';
import { AppError } from '../errors';
import {
  fundWallet,
  makeHarness,
  makeHarnessWithProvider,
  registerUser,
  setPin,
  TEST_PIN,
} from './helpers';

class TimeoutThenSuccessProvider extends MockVtuProvider {
  override async purchaseAirtime(_request: AirtimeRequest): Promise<ProviderPurchaseResult> {
    throw new ProviderTimeoutError('Simulated ambiguous timeout', {
      providerReference: 'PROV-TIMEOUT-1',
    });
  }

  override async getStatus(providerReference: string): Promise<ProviderStatusResult> {
    return {
      state: 'successful',
      providerReference,
      message: 'Supplier reconciled the order as successful.',
    };
  }
}

class PendingProvider extends MockVtuProvider {
  override async purchaseAirtime(_request: AirtimeRequest): Promise<ProviderPurchaseResult> {
    throw new ProviderPendingError('Simulated supplier accepted the request and is processing it.', {
      providerReference: 'PROV-PENDING-1',
    });
  }
}

class RecordingProvider extends MockVtuProvider {
  airtimeRequests: AirtimeRequest[] = [];

  override async purchaseAirtime(request: AirtimeRequest): Promise<ProviderPurchaseResult> {
    this.airtimeRequests.push(request);
    return super.purchaseAirtime(request);
  }
}

class TimeoutThenFailedProvider extends MockVtuProvider {
  override async purchaseAirtime(_request: AirtimeRequest): Promise<ProviderPurchaseResult> {
    throw new ProviderTimeoutError('Simulated ambiguous timeout', {
      providerReference: 'PROV-TIMEOUT-2',
    });
  }

  override async getStatus(providerReference: string): Promise<ProviderStatusResult> {
    return {
      state: 'failed',
      providerReference,
      message: 'Supplier reconciled the order as failed.',
    };
  }
}

async function readyUser(harness: ReturnType<typeof makeHarness>, balance = 500_000) {
  const session = await registerUser(harness);
  await setPin(harness, session.user.id);
  if (balance > 0) await fundWallet(harness, session.user.id, balance);
  const user = await harness.store.findUserById(session.user.id);
  assert.ok(user);
  return { session, user };
}

describe('purchases', () => {
  it('debits the wallet once and records a successful simulated airtime purchase', async () => {
    const harness = makeHarness();
    const { user } = await readyUser(harness);

    const result = await harness.services.purchases.purchaseAirtime(user, {
      network: 'MTN',
      phone: '08031234567',
      amountKobo: 10_000,
      pin: TEST_PIN,
    });

    assert.equal(result.transaction.status, 'successful');
    assert.equal(result.transaction.type, 'airtime');
    assert.equal(result.transaction.amountKobo, 10_000);
    assert.equal(result.transaction.feeKobo, 300);
    assert.equal(result.transaction.totalKobo, 10_300);
    assert.equal(result.transaction.details.faceValueKobo, 10_000);
    assert.equal(result.transaction.details.serviceFeeKobo, 300);
    assert.equal(result.transaction.simulated, true);
    assert.equal(result.wallet.balanceKobo, 489_700);

    const reconciliation = await harness.services.wallet.reconcile(user.id);
    assert.equal(reconciliation.matches, true);
    assert.equal(reconciliation.ledgerBalanceKobo, 489_700);

    const page = await harness.services.purchases.listTransactions(user.id, {});
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]?.status, 'successful');
  });

  it('sends only the face value to the supplier while debiting the fee too', async () => {
    const provider = new RecordingProvider();
    const harness = makeHarnessWithProvider(provider);
    const { user } = await readyUser(harness);

    const result = await harness.services.purchases.purchaseAirtime(user, {
      network: 'MTN',
      phone: '08031234567',
      amountKobo: 50_000,
      pin: TEST_PIN,
    });

    assert.equal(provider.airtimeRequests.length, 1);
    assert.equal(provider.airtimeRequests[0]?.amountKobo, 50_000);
    assert.equal(result.transaction.amountKobo, 50_000);
    assert.equal(result.transaction.feeKobo, 1_300);
    assert.equal(result.transaction.totalKobo, 51_300);
    assert.equal(result.wallet.balanceKobo, 448_700);
  });

  it('applies the minimum airtime fee when the percentage is zero', async () => {
    const harness = makeHarness({ AIRTIME_FEE_PERCENT: '0' });
    const { user } = await readyUser(harness);

    const result = await harness.services.purchases.purchaseAirtime(user, {
      network: 'MTN',
      phone: '08031234567',
      amountKobo: 5_000,
      pin: TEST_PIN,
    });

    assert.equal(result.transaction.feeKobo, 100);
    assert.equal(result.transaction.totalKobo, 5_100);
    assert.equal(result.wallet.balanceKobo, 494_900);
  });

  it('rejects an invalid transaction PIN without moving money', async () => {
    const harness = makeHarness();
    const { user } = await readyUser(harness);

    await assert.rejects(
      harness.services.purchases.purchaseAirtime(user, {
        network: 'MTN',
        phone: '08031234567',
        amountKobo: 10_000,
        pin: '9999',
      }),
      (error: unknown) => error instanceof AppError && error.code === 'INVALID_PIN',
    );

    const wallet = await harness.services.wallet.getWallet(user.id);
    assert.equal(wallet.balanceKobo, 500_000);
    const page = await harness.services.purchases.listTransactions(user.id, {});
    assert.equal(page.items.length, 0);
  });

  it('refunds a confirmed supplier rejection exactly once', async () => {
    const harness = makeHarness();
    const { user } = await readyUser(harness);

    const result = await harness.services.purchases.purchaseAirtime(user, {
      network: 'MTN',
      phone: '08031230000',
      amountKobo: 10_000,
      pin: TEST_PIN,
    });

    assert.equal(result.transaction.status, 'refunded');
    assert.equal(result.wallet.balanceKobo, 500_000);

    const ledger = await harness.services.wallet.getLedger(user.id);
    assert.equal(ledger.length, 3);
    assert.equal(ledger.filter((entry) => entry.direction === 'debit').length, 1);
    assert.equal(ledger.filter((entry) => entry.direction === 'credit').length, 2);

    const reconciliation = await harness.services.wallet.reconcile(user.id);
    assert.equal(reconciliation.matches, true);
  });

  it('keeps the debit and marks the order processing when the supplier accepts asynchronously', async () => {
    const harness = makeHarnessWithProvider(new PendingProvider());
    const { user } = await readyUser(harness);

    const result = await harness.services.purchases.purchaseAirtime(user, {
      network: 'MTN',
      phone: '08031234567',
      amountKobo: 10_000,
      pin: TEST_PIN,
    });

    assert.equal(result.transaction.status, 'processing');
    assert.equal(result.transaction.providerReference, 'PROV-PENDING-1');
    assert.equal(result.wallet.balanceKobo, 489_700);

    const ledger = await harness.services.wallet.getLedger(user.id);
    assert.equal(ledger.filter((entry) => entry.direction === 'credit').length, 1);
  });

  it('settles due pending orders in a background reconciliation pass', async () => {
    const harness = makeHarnessWithProvider(new PendingProvider());
    const { user } = await readyUser(harness);

    const purchased = await harness.services.purchases.purchaseAirtime(user, {
      network: 'MTN',
      phone: '08031234567',
      amountKobo: 10_000,
      pin: TEST_PIN,
    });
    assert.equal(purchased.transaction.status, 'processing');

    const tooSoon = await harness.services.purchases.reconcilePendingTransactions({
      minAgeMs: 60_000,
    });
    assert.equal(tooSoon.checked, 0);

    const result = await harness.services.purchases.reconcilePendingTransactions({
      minAgeMs: 0,
    });
    assert.equal(result.checked, 1);
    assert.equal(result.settled, 1);
    assert.equal(result.failed, 0);

    const page = await harness.services.purchases.listTransactions(user.id, {});
    assert.equal(page.items[0]?.status, 'successful');
    const wallet = await harness.services.wallet.getWallet(user.id);
    assert.equal(wallet.balanceKobo, 489_700);
  });

  it('keeps the debit when the supplier outcome is uncertain', async () => {
    const harness = makeHarness();
    const { user } = await readyUser(harness);

    const result = await harness.services.purchases.purchaseAirtime(user, {
      network: 'MTN',
      phone: '08031239999',
      amountKobo: 10_000,
      pin: TEST_PIN,
    });

    assert.equal(result.transaction.status, 'uncertain');
    assert.equal(result.wallet.balanceKobo, 489_700);

    const ledger = await harness.services.wallet.getLedger(user.id);
    assert.equal(ledger.length, 2);
    assert.equal(ledger.filter((entry) => entry.direction === 'credit').length, 1);
  });

  it('reconciles an uncertain order as successful without a second debit', async () => {
    const harness = makeHarnessWithProvider(new TimeoutThenSuccessProvider());
    const { user } = await readyUser(harness);

    const purchased = await harness.services.purchases.purchaseAirtime(user, {
      network: 'MTN',
      phone: '08031234567',
      amountKobo: 10_000,
      pin: TEST_PIN,
    });
    assert.equal(purchased.transaction.status, 'uncertain');
    assert.equal(purchased.transaction.providerReference, 'PROV-TIMEOUT-1');

    const refreshed = await harness.services.purchases.refreshTransaction(
      user.id,
      purchased.transaction.id,
    );
    assert.equal(refreshed.transaction.status, 'successful');
    assert.equal(refreshed.wallet.balanceKobo, 489_700);

    const ledger = await harness.services.wallet.getLedger(user.id);
    assert.equal(ledger.filter((entry) => entry.direction === 'debit').length, 1);
  });

  it('reconciles an uncertain order as failed and refunds it once', async () => {
    const harness = makeHarnessWithProvider(new TimeoutThenFailedProvider());
    const { user } = await readyUser(harness);

    const purchased = await harness.services.purchases.purchaseAirtime(user, {
      network: 'MTN',
      phone: '08031234567',
      amountKobo: 10_000,
      pin: TEST_PIN,
    });
    assert.equal(purchased.transaction.status, 'uncertain');

    const refreshed = await harness.services.purchases.refreshTransaction(
      user.id,
      purchased.transaction.id,
    );
    assert.equal(refreshed.transaction.status, 'refunded');
    assert.equal(refreshed.wallet.balanceKobo, 500_000);

    const again = await harness.services.purchases.refreshTransaction(
      user.id,
      purchased.transaction.id,
    );
    assert.equal(again.transaction.status, 'refunded');
    assert.equal(again.wallet.balanceKobo, 500_000);
  });

  it('fails cleanly when the wallet cannot cover the purchase', async () => {
    const harness = makeHarness();
    const { user } = await readyUser(harness, 0);

    await assert.rejects(
      harness.services.purchases.purchaseAirtime(user, {
        network: 'MTN',
        phone: '08031234567',
        amountKobo: 10_000,
        pin: TEST_PIN,
      }),
      (error: unknown) => error instanceof AppError && error.status === 402,
    );

    const wallet = await harness.services.wallet.getWallet(user.id);
    assert.equal(wallet.balanceKobo, 0);
    const page = await harness.services.purchases.listTransactions(user.id, {});
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]?.status, 'failed');
  });

  it('issues the requested number of simulated exam vouchers', async () => {
    const harness = makeHarness();
    const { user } = await readyUser(harness, 1_000_000);

    const result = await harness.services.purchases.purchaseExam(user, {
      productId: 'waec-result-checker',
      quantity: 2,
      pin: TEST_PIN,
    });

    assert.equal(result.transaction.status, 'successful');
    assert.equal(result.transaction.amountKobo, 700_000);
    const vouchers = result.transaction.details.vouchers;
    assert.ok(Array.isArray(vouchers));
    assert.equal(vouchers.length, 2);
    assert.equal(result.wallet.balanceKobo, 300_000);
  });

  it('rejects a network mismatch before creating a transaction', async () => {
    const harness = makeHarness();
    const { user } = await readyUser(harness);

    await assert.rejects(
      harness.services.purchases.purchaseAirtime(user, {
        network: 'GLO',
        phone: '08031234567',
        amountKobo: 10_000,
        pin: TEST_PIN,
      }),
      (error: unknown) => error instanceof AppError && error.status === 422,
    );

    const page = await harness.services.purchases.listTransactions(user.id, {});
    assert.equal(page.items.length, 0);
  });

  it('rejects an airtime amount that is not a whole Naira amount', async () => {
    const harness = makeHarness();
    const { user } = await readyUser(harness);

    await assert.rejects(
      harness.services.purchases.purchaseAirtime(user, {
        network: 'MTN',
        phone: '08031234567',
        amountKobo: 10_050,
        pin: TEST_PIN,
      }),
      (error: unknown) => error instanceof AppError && error.status === 422,
    );

    const page = await harness.services.purchases.listTransactions(user.id, {});
    assert.equal(page.items.length, 0);
  });
});
