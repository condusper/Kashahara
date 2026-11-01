import type { LedgerEntry, WalletSummary } from '@kashahara/shared';
import type { Config } from '../config';
import { AppError, Errors } from '../errors';
import { newId, newReference } from '../crypto';
import { logger } from '../logger';
import {
  buildPaystackCallbackUrl,
  isAllowedCallbackUrl,
  PaystackClient,
  PaystackError,
  PaystackNotConfiguredError,
} from '../paystack';
import type {
  FundingRecord,
  LedgerRecord,
  Store,
  WalletRecord,
} from '../types';
import { toWalletSummary } from '../types';

type JsonObject = Record<string, unknown>;

/**
 * Paystack reports an initialized-but-unpaid checkout as `abandoned`
 * immediately. That is not the same as a customer giving up, so we keep the
 * attempt open for a grace period before closing it. A later `charge.success`
 * webhook still credits the wallet even if the attempt was already closed.
 */
const ABANDONED_GRACE_MS = 30 * 60 * 1000;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function readString(object: JsonObject | null, key: string): string | null {
  if (!object) return null;
  const value = object[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNumber(object: JsonObject | null, key: string): number | null {
  if (!object) return null;
  const value = object[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

export function toLedgerEntry(entry: LedgerRecord): LedgerEntry {
  return {
    id: entry.id,
    direction: entry.direction,
    amountKobo: entry.amountKobo,
    balanceAfterKobo: entry.balanceAfterKobo,
    reference: entry.reference,
    kind: entry.kind,
    createdAt: entry.createdAt.toISOString(),
  };
}

export interface CreditInput {
  userId: string;
  amountKobo: number;
  reference: string;
  kind: string;
  transactionId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DebitInput {
  userId: string;
  amountKobo: number;
  reference: string;
  kind: string;
  transactionId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface LedgerMutation {
  wallet: WalletRecord;
  entry: LedgerRecord;
  duplicated: boolean;
}

export class WalletService {
  constructor(
    private readonly store: Store,
    private readonly config: Config,
    private readonly paystack: PaystackClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getWallet(userId: string): Promise<WalletSummary> {
    const wallet = await this.store.getWalletByUserId(userId);
    if (!wallet) throw Errors.internal('Wallet is missing for this account');
    return toWalletSummary(wallet);
  }

  async getLedger(userId: string, limit = 25): Promise<LedgerEntry[]> {
    const entries = await this.store.listLedger(userId, Math.min(Math.max(limit, 1), 100));
    return entries.map(toLedgerEntry);
  }

  /**
   * Settles payments that Paystack already confirmed but that the app never
   * saw — for example when the customer closed the checkout before the app
   * polled, or when no webhook can reach a local API. Called when the wallet
   * is opened so a paid customer is credited without the original screen.
   */
  async reconcilePendingFundings(
    userId: string,
    limit = 5,
  ): Promise<{ checked: number; credited: number }> {
    if (!this.paystack.isConfigured) return { checked: 0, credited: 0 };

    let pending: FundingRecord[];
    try {
      pending = await this.store.listFundingsByUser(userId, ['awaiting_payment'], limit);
    } catch (error) {
      logger.warn('Could not list pending fundings for reconciliation', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { checked: 0, credited: 0 };
    }

    let checked = 0;
    let credited = 0;
    for (const funding of pending) {
      if (funding.provider !== 'paystack' || funding.simulated) continue;
      checked += 1;
      try {
        const verification = await this.paystack.verify(funding.reference);
        const updated = await this.applyPaystackVerification(funding, verification);
        if (updated.status === 'successful') credited += 1;
      } catch (error) {
        // One failed check must not stop the wallet from loading.
        logger.warn('Paystack reconciliation failed for a pending funding', {
          reference: funding.reference,
          status: error instanceof PaystackError ? error.status : null,
          code: error instanceof PaystackError ? error.code : null,
        });
      }
    }

    if (credited > 0) {
      logger.info('Reconciled pending Paystack funding', { userId, checked, credited });
    }
    return { checked, credited };
  }

  /**
   * Idempotent credit. The unique ledger reference is the final guard against
   * double-crediting a Paystack webhook or a duplicate status poll.
   */
  async credit(tx: Store, input: CreditInput): Promise<LedgerMutation> {
    if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo <= 0) {
      throw Errors.validation('Credit amount must be a positive integer in kobo');
    }
    const wallet = await tx.getWalletByUserId(input.userId);
    if (!wallet) throw Errors.internal('Wallet is missing for this account');

    const existing = await tx.findLedgerByReference(input.reference);
    if (existing) {
      if (existing.amountKobo !== input.amountKobo) {
        throw Errors.conflict('A ledger entry with this reference has a different amount');
      }
      return { wallet, entry: existing, duplicated: true };
    }

    const at = this.now();
    const balanceAfter = wallet.balanceKobo + input.amountKobo;
    const entry = await tx.appendLedgerEntry({
      id: newId(),
      walletId: wallet.id,
      userId: input.userId,
      direction: 'credit',
      amountKobo: input.amountKobo,
      balanceAfterKobo: balanceAfter,
      reference: input.reference,
      kind: input.kind,
      transactionId: input.transactionId ?? null,
      metadata: input.metadata ?? {},
      createdAt: at,
    });
    await tx.updateWalletBalance(wallet.id, balanceAfter, at);
    return {
      wallet: { ...wallet, balanceKobo: balanceAfter, updatedAt: at },
      entry,
      duplicated: false,
    };
  }

  async debit(tx: Store, input: DebitInput): Promise<LedgerMutation> {
    if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo <= 0) {
      throw Errors.validation('Debit amount must be a positive integer in kobo');
    }
    const wallet = await tx.getWalletByUserId(input.userId);
    if (!wallet) throw Errors.internal('Wallet is missing for this account');

    const existing = await tx.findLedgerByReference(input.reference);
    if (existing) {
      throw Errors.conflict('A ledger entry with this reference already exists');
    }
    if (wallet.balanceKobo < input.amountKobo) {
      throw new AppError(
        402,
        'INSUFFICIENT_FUNDS',
        'Your wallet balance is too low for this purchase. Add money and try again.',
        {
          details: {
            balanceKobo: wallet.balanceKobo,
            requiredKobo: input.amountKobo,
            shortfallKobo: input.amountKobo - wallet.balanceKobo,
          },
        },
      );
    }

    const at = this.now();
    const balanceAfter = wallet.balanceKobo - input.amountKobo;
    const entry = await tx.appendLedgerEntry({
      id: newId(),
      walletId: wallet.id,
      userId: input.userId,
      direction: 'debit',
      amountKobo: input.amountKobo,
      balanceAfterKobo: balanceAfter,
      reference: input.reference,
      kind: input.kind,
      transactionId: input.transactionId ?? null,
      metadata: input.metadata ?? {},
      createdAt: at,
    });
    await tx.updateWalletBalance(wallet.id, balanceAfter, at);
    return {
      wallet: { ...wallet, balanceKobo: balanceAfter, updatedAt: at },
      entry,
      duplicated: false,
    };
  }

  async reverse(
    tx: Store,
    input: {
      userId: string;
      amountKobo: number;
      originalReference: string;
      transactionId?: string | null;
      reason: string;
    },
  ): Promise<LedgerMutation> {
    return this.credit(tx, {
      userId: input.userId,
      amountKobo: input.amountKobo,
      reference: `reversal:${input.originalReference}`,
      kind: 'reversal',
      transactionId: input.transactionId ?? null,
      metadata: { originalReference: input.originalReference, reason: input.reason },
    });
  }

  async reconcile(userId: string): Promise<{
    walletBalanceKobo: number;
    ledgerBalanceKobo: number;
    matches: boolean;
  }> {
    const wallet = await this.store.getWalletByUserId(userId);
    if (!wallet) throw Errors.internal('Wallet is missing for this account');
    const ledgerBalanceKobo = await this.store.sumLedger(wallet.id);
    return {
      walletBalanceKobo: wallet.balanceKobo,
      ledgerBalanceKobo,
      matches: wallet.balanceKobo === ledgerBalanceKobo,
    };
  }

  async initializeFunding(
    userId: string,
    amountKobo: number,
    email: string,
    callbackBase?: string | null,
  ): Promise<{
    funding: FundingRecord;
    mode: 'paystack' | 'simulated';
    authorizationUrl: string | null;
    callbackUrl: string | null;
    message: string;
  }> {
    const at = this.now();
    const reference = newReference('KSH-FUND');
    // The mobile app supplies the deep link it can handle (Expo Go uses an
    // `exp://` URL; a build uses `kashahara://`). Fall back to the configured
    // callback when the client does not send one.
    const requestedCallback = callbackBase?.trim() || null;
    const callbackBaseUrl =
      requestedCallback &&
      isAllowedCallbackUrl(requestedCallback, {
        allowExpo: this.config.env !== 'production',
        allowHttp: this.config.env !== 'production',
      })
        ? requestedCallback
        : this.config.paystackCallbackUrl;
    const callbackUrl = buildPaystackCallbackUrl(callbackBaseUrl, reference);
    const base: FundingRecord = {
      id: newId(),
      userId,
      reference,
      amountKobo,
      status: 'awaiting_payment',
      provider: this.paystack.isConfigured ? 'paystack' : 'simulated',
      providerReference: null,
      authorizationUrl: null,
      simulated: !this.paystack.isConfigured,
      metadata: {},
      createdAt: at,
      updatedAt: at,
      completedAt: null,
    };

    const funding = await this.store.createFunding(base);

    if (this.paystack.isConfigured) {
      try {
        const initialized = await this.paystack.initialize({
          email,
          amountKobo,
          reference,
          callbackUrl,
          metadata: { userId, purpose: 'wallet_funding' },
        });
        const updated = await this.store.updateFunding(
          funding.id,
          {
            providerReference: initialized.reference,
            authorizationUrl: initialized.authorizationUrl,
            metadata: {
              paystackReference: initialized.reference,
              ...(callbackUrl ? { callbackUrl } : {}),
            },
          },
          this.now(),
        );
        return {
          funding: updated,
          mode: 'paystack',
          authorizationUrl: initialized.authorizationUrl,
          callbackUrl,
          message: 'Continue to the secure Paystack checkout to fund your wallet.',
        };
      } catch (error) {
        const paystackError = error instanceof PaystackError ? error : null;
        logger.warn('Paystack initialize failed', {
          status: paystackError?.status ?? null,
          code: paystackError?.code ?? null,
          providerCode: paystackError?.providerCode ?? null,
          providerMessage: paystackError?.message ?? null,
          mode: this.paystack.mode,
        });
        await this.store.updateFunding(
          funding.id,
          { status: 'failed', metadata: { error: 'PAYSTACK_INITIALIZE_FAILED' } },
          this.now(),
        );
        if (error instanceof PaystackNotConfiguredError) {
          throw new AppError(
            503,
            'PAYSTACK_NOT_CONFIGURED',
            'Paystack is not configured on this server.',
          );
        }
        if (paystackError?.status === 401 || paystackError?.status === 403) {
          throw new AppError(
            503,
            'PAYSTACK_AUTH_FAILED',
            'The payment provider rejected our credentials. Funding is temporarily unavailable.',
          );
        }
        throw new AppError(
          502,
          'PAYSTACK_UNAVAILABLE',
          'Could not start the payment. No money has been taken; please try again.',
        );
      }
    }

    if (!this.config.allowSimulatedPayments) {
      await this.store.updateFunding(
        funding.id,
        { status: 'failed', metadata: { error: 'PAYSTACK_NOT_CONFIGURED' } },
        this.now(),
      );
      throw new AppError(
        503,
        'PAYSTACK_NOT_CONFIGURED',
        'Paystack is not configured. Wallet funding is unavailable.',
      );
    }

    return {
      funding,
      mode: 'simulated',
      authorizationUrl: null,
      callbackUrl: null,
      message: 'Your funding attempt is ready. Complete the payment to credit your wallet.',
    };
  }

  async getFundingStatus(
    userId: string,
    reference: string,
  ): Promise<{
    funding: FundingRecord;
    simulated: boolean;
    wallet: WalletSummary;
  }> {
    let funding = await this.store.getFundingByReference(reference);
    if (!funding || funding.userId !== userId) {
      throw Errors.notFound('Funding attempt not found');
    }

    if (funding.status === 'awaiting_payment' && this.paystack.isConfigured) {
      try {
        const verification = await this.paystack.verify(reference);
        funding = await this.applyPaystackVerification(funding, verification);
      } catch (error) {
        // A verification outage must not break the status screen. The webhook
        // and later polls can still settle the payment; return what we know.
        logger.warn('Paystack verification failed while checking funding status', {
          reference,
          status: error instanceof PaystackError ? error.status : null,
          code: error instanceof PaystackError ? error.code : null,
        });
      }
    }

    const wallet = await this.getWallet(userId);
    return { funding, simulated: funding.simulated, wallet };
  }

  private async applyPaystackVerification(
    funding: FundingRecord,
    verification: Awaited<ReturnType<PaystackClient['verify']>>,
  ): Promise<FundingRecord> {
    if (verification.state === 'successful') {
      if (
        verification.reference !== funding.reference ||
        verification.amountKobo !== funding.amountKobo ||
        verification.currency !== 'NGN'
      ) {
        await this.store.updateFunding(
          funding.id,
          {
            status: 'failed',
            metadata: {
              ...funding.metadata,
              error: 'PAYSTACK_VERIFICATION_MISMATCH',
              verifiedAmountKobo: verification.amountKobo,
              verifiedCurrency: verification.currency,
            },
          },
          this.now(),
        );
        await this.store.recordAudit({
          id: newId(),
          userId: funding.userId,
          action: 'wallet.funding_verification_mismatch',
          metadata: { reference: funding.reference },
          ip: null,
          createdAt: this.now(),
        });
        return (await this.store.getFundingByReference(funding.reference)) ?? funding;
      }
      return this.creditFunding(funding, 'paystack', verification.paidAt);
    }

    if (verification.state === 'failed') {
      return this.store.updateFunding(
        funding.id,
        {
          status: 'failed',
          metadata: { ...funding.metadata, gatewayResponse: verification.gatewayResponse },
        },
        this.now(),
      );
    }

    if (verification.state === 'abandoned') {
      const ageMs = this.now().getTime() - funding.createdAt.getTime();
      if (ageMs < ABANDONED_GRACE_MS) {
        // Still payable. Keep showing "awaiting payment" rather than a failure.
        return funding;
      }
      return this.store.updateFunding(
        funding.id,
        {
          status: 'abandoned',
          metadata: { ...funding.metadata, gatewayResponse: verification.gatewayResponse },
        },
        this.now(),
      );
    }

    return funding;
  }

  private async creditFunding(
    funding: FundingRecord,
    kind: 'paystack' | 'simulated',
    paidAt: string | null,
  ): Promise<FundingRecord> {
    return this.store.transaction(async (tx) => {
      const current = await tx.getFundingByReference(funding.reference);
      if (!current) throw Errors.notFound('Funding attempt not found');
      if (current.status === 'successful') return current;

      const reference =
        kind === 'paystack'
          ? `paystack:${current.reference}`
          : `simulated-funding:${current.reference}`;
      await this.credit(tx, {
        userId: current.userId,
        amountKobo: current.amountKobo,
        reference,
        kind: 'wallet_funding',
        metadata: {
          fundingReference: current.reference,
          provider: kind,
          simulated: kind === 'simulated',
        },
      });
      const updated = await tx.updateFunding(
        current.id,
        {
          status: 'successful',
          simulated: kind === 'simulated',
          completedAt: paidAt ? new Date(paidAt) : this.now(),
          metadata: { ...current.metadata, credited: true },
        },
        this.now(),
      );
      await tx.recordAudit({
        id: newId(),
        userId: current.userId,
        action: 'wallet.funding_credited',
        metadata: {
          reference: current.reference,
          amountKobo: current.amountKobo,
          provider: kind,
          simulated: kind === 'simulated',
        },
        ip: null,
        createdAt: this.now(),
      });
      return updated;
    });
  }

  async simulateFunding(
    userId: string,
    reference: string,
  ): Promise<{ funding: FundingRecord; wallet: WalletSummary }> {
    if (!this.config.allowSimulatedPayments || this.config.env === 'production') {
      throw Errors.forbidden('This funding attempt cannot be completed automatically');
    }
    const funding = await this.store.getFundingByReference(reference);
    if (!funding || funding.userId !== userId) {
      throw Errors.notFound('Funding attempt not found');
    }
    if (funding.provider !== 'simulated') {
      throw Errors.conflict('This funding attempt uses a real payment provider');
    }
    const updated = await this.creditFunding(funding, 'simulated', null);
    return { funding: updated, wallet: await this.getWallet(userId) };
  }

  /**
   * Recovers a successful payment whose funding record is missing. This
   * happens when the API restarts before the attempt can be persisted (the
   * development store is in-memory), or when a checkout outlives its record.
   * The webhook signature is already verified by the route and the
   * transaction is re-verified with Paystack, so a forged payload can never
   * create money.
   */
  private async recoverMissingFunding(
    reference: string,
    data: JsonObject,
  ): Promise<{ processed: boolean; reason: string; retryable?: boolean }> {
    const metadata = asObject(data.metadata) ?? {};
    const purpose = readString(metadata, 'purpose');
    if (purpose && purpose !== 'wallet_funding') {
      return { processed: false, reason: 'not_wallet_funding' };
    }

    const metadataUserId = readString(metadata, 'userId');
    const email = readString(asObject(data.customer), 'email');

    let user = metadataUserId ? await this.store.findUserById(metadataUserId) : null;
    let matchedBy: 'metadata' | 'email' | null = user ? 'metadata' : null;
    if (!user && email) {
      // The account was recreated after a restart, so its id changed. Fall
      // back to the customer email that Paystack recorded for the payment.
      user = await this.store.findUserByEmail(email);
      if (user) matchedBy = 'email';
    }
    if (!user) return { processed: false, reason: 'unknown_reference' };

    let verification: Awaited<ReturnType<PaystackClient['verify']>>;
    try {
      verification = await this.paystack.verify(reference);
    } catch (error) {
      logger.warn('Could not verify a payment with no funding record', {
        reference,
        status: error instanceof PaystackError ? error.status : null,
        code: error instanceof PaystackError ? error.code : null,
      });
      // Do not record the event: a Paystack retry should get another chance.
      return { processed: false, reason: 'verification_unavailable', retryable: true };
    }

    if (verification.state !== 'successful') {
      return { processed: false, reason: `payment_${verification.state}` };
    }
    if (
      verification.reference !== reference ||
      verification.currency !== 'NGN' ||
      !Number.isSafeInteger(verification.amountKobo) ||
      verification.amountKobo <= 0
    ) {
      return { processed: false, reason: 'verification_mismatch' };
    }
    const webhookAmount = readNumber(data, 'amount');
    const webhookCurrency = readString(data, 'currency');
    if (
      (webhookAmount !== null && webhookAmount !== verification.amountKobo) ||
      (webhookCurrency !== null && webhookCurrency !== verification.currency)
    ) {
      return { processed: false, reason: 'amount_or_currency_mismatch' };
    }

    let funding = await this.store.getFundingByReference(reference);
    if (!funding) {
      try {
        funding = await this.store.createFunding({
          id: newId(),
          userId: user.id,
          reference,
          amountKobo: verification.amountKobo,
          status: 'awaiting_payment',
          provider: 'paystack',
          providerReference: reference,
          authorizationUrl: null,
          simulated: false,
          metadata: {
            recovered: true,
            matchedBy,
            paystackTransactionId: readNumber(data, 'id'),
          },
          createdAt: this.now(),
          updatedAt: this.now(),
          completedAt: null,
        });
      } catch {
        // Another delivery of the same webhook won the insert race.
        funding = await this.store.getFundingByReference(reference);
      }
    }
    if (!funding) return { processed: false, reason: 'recovery_failed' };
    if (funding.userId !== user.id) return { processed: false, reason: 'user_mismatch' };
    if (funding.amountKobo !== verification.amountKobo) {
      return { processed: false, reason: 'amount_or_currency_mismatch' };
    }

    const credited = await this.creditFunding(funding, 'paystack', verification.paidAt);
    logger.info('Recovered a payment that had no funding record', {
      reference,
      userId: user.id,
      matchedBy,
      status: credited.status,
    });
    return { processed: credited.status === 'successful', reason: 'recovered_missing_funding' };
  }

  /**
   * Handles a verified Paystack webhook payload. The route verifies the
   * signature on the raw body before calling this method.
   */
  async handlePaystackWebhook(
    event: string,
    data: JsonObject,
  ): Promise<{ processed: boolean; reason?: string }> {
    const reference = readString(data, 'reference');
    const transactionId = readNumber(data, 'id');
    const eventId = `paystack:${event}:${transactionId ?? reference ?? 'unknown'}`;

    if (await this.store.hasWebhookEvent(eventId)) {
      return { processed: false, reason: 'duplicate' };
    }

    const recordEvent = () =>
      this.store.recordWebhookEvent({
        id: eventId,
        provider: 'paystack',
        eventType: event,
        payloadHash: '',
        processedAt: this.now(),
      });

    if (!reference) {
      await recordEvent();
      return { processed: false, reason: 'missing_reference' };
    }

    if (event !== 'charge.success') {
      await recordEvent();
      return { processed: false, reason: 'ignored_event' };
    }

    const funding = await this.store.getFundingByReference(reference);
    if (!funding) {
      const recovery = await this.recoverMissingFunding(reference, data);
      if (recovery.retryable) {
        return { processed: false, reason: recovery.reason };
      }
      await recordEvent();
      return { processed: recovery.processed, reason: recovery.reason };
    }

    const amount = readNumber(data, 'amount');
    const currency = readString(data, 'currency');
    if (amount !== funding.amountKobo || currency !== 'NGN') {
      await this.store.updateFunding(
        funding.id,
        {
          status: 'failed',
          metadata: {
            ...funding.metadata,
            error: 'PAYSTACK_WEBHOOK_MISMATCH',
            webhookAmountKobo: amount,
            webhookCurrency: currency,
          },
        },
        this.now(),
      );
      await this.store.recordAudit({
        id: newId(),
        userId: funding.userId,
        action: 'wallet.webhook_mismatch',
        metadata: { reference, amount, currency },
        ip: null,
        createdAt: this.now(),
      });
      await recordEvent();
      return { processed: false, reason: 'amount_or_currency_mismatch' };
    }

    await this.creditFunding(funding, 'paystack', readString(data, 'paid_at'));
    await recordEvent();
    return { processed: true };
  }
}

export { asObject, readString, readNumber };
