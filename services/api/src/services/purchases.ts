import type {
  Network,
  Recipient,
  ServiceType,
  Transaction,
  TransactionStatus,
  TransactionType,
  WalletSummary,
} from '@kashahara/shared';
import {
  calculateAirtimeFeeKobo,
  detectNetwork,
  getCablePackage,
  getCableProvider,
  getElectricityBiller,
  getExamProduct,
  isValidNigerianPhone,
  normalizeNigerianPhone,
} from '@kashahara/shared';
import type { Config } from '../config';
import { AppError, Errors } from '../errors';
import { newId, newReference } from '../crypto';
import type { AuthService } from './auth';
import type { CatalogService } from './catalog';
import type { WalletService } from './wallet';
import type {
  CableVerification,
  MeterVerification,
  ProviderPurchaseResult,
  ProviderStatusResult,
  Store,
  TransactionFilter,
  TransactionRecord,
  UserRecord,
} from '../types';
import {
  ProviderPendingError,
  ProviderRejectedError,
  ProviderTimeoutError,
  type VtuProvider,
} from '../providers';

const AIRTIME_MIN_KOBO = 5_000;
const AIRTIME_MAX_KOBO = 5_000_000;
const ELECTRICITY_MIN_KOBO = 50_000;
const ELECTRICITY_MAX_KOBO = 50_000_000;
const EXAM_MAX_QUANTITY = 5;

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

const REFERENCE_KEYS = new Set([
  'reference',
  'ref',
  'customer_reference',
  'customerreference',
  'transaction_reference',
  'transactionreference',
  'provider_reference',
  'providerreference',
]);

const STATUS_KEYS = new Set([
  'status',
  'state',
  'event',
  'code',
  'transaction_status',
  'transactionstatus',
]);

const MESSAGE_KEYS = new Set(['msg', 'message', 'reason', 'description', 'detail']);

function collectWebhookFields(
  value: unknown,
  keys: Set<string>,
  out: unknown[],
  depth = 0,
): void {
  if (depth > 6) return;
  if (Array.isArray(value)) {
    for (const item of value) collectWebhookFields(item, keys, out, depth + 1);
    return;
  }
  const object = asObject(value);
  if (!object) return;
  for (const [key, item] of Object.entries(object)) {
    if (keys.has(key.toLowerCase())) out.push(item);
    if (item && typeof item === 'object') collectWebhookFields(item, keys, out, depth + 1);
  }
}

export type ProviderWebhookOutcome = 'successful' | 'failed' | 'pending' | 'unknown';

function deriveWebhookOutcome(signals: readonly unknown[]): ProviderWebhookOutcome {
  let outcome: ProviderWebhookOutcome = 'unknown';
  for (const signal of signals) {
    if (typeof signal === 'number') {
      if (signal === 424 || signal === 400 || signal === 401 || signal === 404) return 'failed';
      if (signal === 201 || signal === 202) outcome = 'pending';
      else if (signal === 200) return 'successful';
      continue;
    }
    if (typeof signal === 'boolean') {
      if (!signal) return 'failed';
      if (outcome === 'unknown') outcome = 'successful';
      continue;
    }
    if (typeof signal !== 'string') continue;
    const normalized = signal.toLowerCase();
    if (/(fail|declin|revers|error|cancel)/.test(normalized)) return 'failed';
    if (/(pending|process|queue|recorded|accept)/.test(normalized)) outcome = 'pending';
    else if (/(success|complet|deliver|credit)/.test(normalized)) outcome = 'successful';
  }
  return outcome;
}

export function toTransaction(record: TransactionRecord): Transaction {
  return {
    id: record.id,
    reference: record.reference,
    type: record.type,
    status: record.status,
    amountKobo: record.amountKobo,
    feeKobo: record.feeKobo,
    totalKobo: record.amountKobo + record.feeKobo,
    currency: record.currency,
    recipient: record.recipient as Recipient,
    details: record.details,
    providerReference: record.providerReference,
    failureReason: record.failureReason,
    simulated: record.simulated,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
  };
}

export interface AirtimePurchaseInput {
  network: Network;
  phone: string;
  amountKobo: number;
  pin: string;
}

export interface DataPurchaseInput {
  network: Network;
  phone: string;
  planId: string;
  pin: string;
}

export interface MeterVerifyInput {
  billerId: string;
  meterNumber: string;
  meterType: 'prepaid' | 'postpaid';
}

export interface ElectricityPurchaseInput extends MeterVerifyInput {
  amountKobo: number;
  pin: string;
}

export interface CableVerifyInput {
  providerId: string;
  smartcardNumber: string;
}

export interface CablePurchaseInput extends CableVerifyInput {
  packageId: string;
  pin: string;
}

export interface ExamPurchaseInput {
  productId: string;
  quantity: number;
  pin: string;
}

export interface PurchaseResult {
  transaction: Transaction;
  wallet: WalletSummary;
  simulated: boolean;
}

export class PurchaseService {
  constructor(
    private readonly store: Store,
    private readonly config: Config,
    private readonly provider: VtuProvider,
    private readonly catalog: CatalogService,
    private readonly auth: AuthService,
    private readonly wallet: WalletService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private validatePhoneForNetwork(phone: string, network: Network): string {
    const normalized = normalizeNigerianPhone(phone);
    if (!isValidNigerianPhone(normalized)) {
      throw Errors.validation('Enter a valid Nigerian phone number');
    }
    const detected = detectNetwork(normalized);
    if (detected && detected !== network) {
      throw Errors.validation(
        `The number looks like a ${detected} number, not ${network}. Confirm the network before continuing. Number portability may affect this check; the supplier remains authoritative.`,
      );
    }
    return normalized;
  }

  private async verification<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof ProviderRejectedError) {
        throw new AppError(422, 'VERIFICATION_FAILED', error.message);
      }
      if (error instanceof ProviderTimeoutError) {
        throw new AppError(
          504,
          'PROVIDER_UNCERTAIN',
          'The provider did not return a definitive verification result. Please try again.',
        );
      }
      if (error instanceof ProviderPendingError) {
        throw new AppError(
          504,
          'PROVIDER_PROCESSING',
          'The provider is still processing the verification. Please try again shortly.',
        );
      }
      throw error;
    }
  }

  async verifyMeter(input: MeterVerifyInput): Promise<MeterVerification> {
    const biller = getElectricityBiller(input.billerId);
    if (!biller) throw Errors.notFound('Electricity provider not found');
    if (!biller.meterTypes.includes(input.meterType)) {
      throw Errors.validation('This provider does not support the selected meter type');
    }
    if (!/^\d{6,20}$/.test(input.meterNumber)) {
      throw Errors.validation('Enter a valid meter number');
    }
    return this.verification(() =>
      this.provider.verifyMeter({
        billerId: input.billerId,
        meterNumber: input.meterNumber,
        meterType: input.meterType,
      }),
    );
  }

  async verifyCable(input: CableVerifyInput): Promise<CableVerification> {
    const provider = getCableProvider(input.providerId);
    if (!provider) throw Errors.notFound('Cable provider not found');
    if (!/^\d{6,20}$/.test(input.smartcardNumber)) {
      throw Errors.validation('Enter a valid smartcard or decoder number');
    }
    return this.verification(() =>
      this.provider.verifyCable({
        providerId: input.providerId,
        smartcardNumber: input.smartcardNumber,
      }),
    );
  }

  private async executePurchase(input: {
    user: UserRecord;
    type: ServiceType;
    amountKobo: number;
    feeKobo?: number;
    recipient: Record<string, unknown>;
    details: Record<string, unknown>;
    pin: string;
    operationName: string;
    callProvider: (reference: string) => Promise<ProviderPurchaseResult>;
  }): Promise<PurchaseResult> {
    await this.auth.verifyTransactionPin(input.user, input.pin);
    if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo <= 0) {
      throw Errors.validation('Enter a valid amount');
    }

    const at = this.now();
    const reference = newReference(input.type.toUpperCase());
    const feeKobo = input.feeKobo ?? 0;
    const totalKobo = input.amountKobo + feeKobo;
    const transaction = await this.store.createTransaction({
      id: newId(),
      userId: input.user.id,
      reference,
      type: input.type,
      status: 'created',
      amountKobo: input.amountKobo,
      feeKobo,
      currency: 'NGN',
      recipient: input.recipient,
      details: { ...input.details, simulated: this.provider.isSimulated },
      providerReference: null,
      failureReason: null,
      simulated: this.provider.isSimulated,
      createdAt: at,
      updatedAt: at,
      completedAt: null,
    });

    try {
      await this.store.transaction(async (tx) => {
        await this.wallet.debit(tx, {
          userId: input.user.id,
          amountKobo: totalKobo,
          reference: `purchase:${reference}`,
          kind: input.type,
          transactionId: transaction.id,
          metadata: { type: input.type, reference },
        });
        await tx.updateTransaction(
          transaction.id,
          { status: 'processing', updatedAt: this.now() },
          this.now(),
        );
      });
    } catch (error) {
      await this.store.updateTransaction(
        transaction.id,
        {
          status: 'failed',
          failureReason:
            error instanceof AppError ? error.message : 'Could not reserve wallet funds',
          completedAt: this.now(),
          updatedAt: this.now(),
        },
        this.now(),
      );
      throw error;
    }

    try {
      const result = await input.callProvider(reference);
      const completed = await this.store.transaction(async (tx) => {
        const updated = await tx.updateTransaction(
          transaction.id,
          {
            status: 'successful',
            providerReference: result.providerReference,
            simulated: result.simulated,
            details: {
              ...input.details,
              providerMessage: result.message,
              ...(result.token ? { token: result.token } : {}),
              ...(result.units ? { units: result.units } : {}),
              ...(result.vouchers ? { vouchers: result.vouchers } : {}),
              simulated: result.simulated,
            },
            completedAt: this.now(),
            updatedAt: this.now(),
          },
          this.now(),
        );
        await tx.recordProviderRequest({
          id: newId(),
          transactionId: transaction.id,
          provider: this.provider.name,
          operation: input.operationName,
          request: {
            reference,
            type: input.type,
            amountKobo: input.amountKobo,
          },
          response: {
            providerReference: result.providerReference,
            simulated: result.simulated,
            status: 'success',
          },
          status: 'success',
          createdAt: this.now(),
        });
        await tx.recordAudit({
          id: newId(),
          userId: input.user.id,
          action: `purchase.${input.type}.successful`,
          metadata: {
            reference,
            amountKobo: input.amountKobo,
            simulated: result.simulated,
          },
          ip: null,
          createdAt: this.now(),
        });
        return updated;
      });
      return {
        transaction: toTransaction(completed),
        wallet: await this.wallet.getWallet(input.user.id),
        simulated: completed.simulated,
      };
    } catch (error) {
      if (error instanceof ProviderPendingError) {
        const pending = await this.store.transaction(async (tx) => {
          const record = await tx.updateTransaction(
            transaction.id,
            {
              status: 'processing',
              providerReference: error.providerReference,
              details: {
                ...input.details,
                providerMessage: error.message,
                simulated: this.provider.isSimulated,
              },
              updatedAt: this.now(),
            },
            this.now(),
          );
          await tx.recordProviderRequest({
            id: newId(),
            transactionId: transaction.id,
            provider: this.provider.name,
            operation: input.operationName,
            request: { reference, type: input.type, amountKobo: input.amountKobo },
            response: { providerReference: error.providerReference, status: 'pending' },
            status: 'uncertain',
            createdAt: this.now(),
          });
          await tx.recordAudit({
            id: newId(),
            userId: input.user.id,
            action: `purchase.${input.type}.processing`,
            metadata: {
              reference,
              amountKobo: input.amountKobo,
              providerReference: error.providerReference,
            },
            ip: null,
            createdAt: this.now(),
          });
          return record;
        });
        return {
          transaction: toTransaction(pending),
          wallet: await this.wallet.getWallet(input.user.id),
          simulated: pending.simulated,
        };
      }

      if (error instanceof ProviderRejectedError) {
        const refunded = await this.store.transaction(async (tx) => {
          await this.wallet.reverse(tx, {
            userId: input.user.id,
            amountKobo: totalKobo,
            originalReference: `purchase:${reference}`,
            transactionId: transaction.id,
            reason: error.message,
          });
          const updated = await tx.updateTransaction(
            transaction.id,
            {
              status: 'refunded',
              failureReason: error.message,
              providerReference: error.providerReference,
              simulated: this.provider.isSimulated,
              details: {
                ...input.details,
                providerMessage: error.message,
                refunded: true,
                simulated: this.provider.isSimulated,
              },
              completedAt: this.now(),
              updatedAt: this.now(),
            },
            this.now(),
          );
          await tx.recordProviderRequest({
            id: newId(),
            transactionId: transaction.id,
            provider: this.provider.name,
            operation: input.operationName,
            request: { reference, type: input.type, amountKobo: input.amountKobo },
            response: { providerReference: error.providerReference, status: 'failed' },
            status: 'failed',
            createdAt: this.now(),
          });
          await tx.recordAudit({
            id: newId(),
            userId: input.user.id,
            action: `purchase.${input.type}.refunded`,
            metadata: { reference, amountKobo: input.amountKobo },
            ip: null,
            createdAt: this.now(),
          });
          return updated;
        });
        return {
          transaction: toTransaction(refunded),
          wallet: await this.wallet.getWallet(input.user.id),
          simulated: refunded.simulated,
        };
      }

      const uncertain = error instanceof ProviderTimeoutError;
      const updated = await this.store.transaction(async (tx) => {
        const record = await tx.updateTransaction(
          transaction.id,
          {
            status: 'uncertain',
            providerReference:
              error instanceof ProviderTimeoutError ? error.providerReference : null,
            details: {
              ...input.details,
              uncertain: true,
              providerMessage:
                error instanceof Error ? error.message : 'Unknown provider outcome',
              simulated: this.provider.isSimulated,
            },
            updatedAt: this.now(),
          },
          this.now(),
        );
        await tx.recordProviderRequest({
          id: newId(),
          transactionId: transaction.id,
          provider: this.provider.name,
          operation: input.operationName,
          request: { reference, type: input.type, amountKobo: input.amountKobo },
          response: {
            status: uncertain ? 'uncertain' : 'unknown',
            message: error instanceof Error ? error.message : 'Unknown provider outcome',
          },
          status: 'uncertain',
          createdAt: this.now(),
        });
        await tx.recordAudit({
          id: newId(),
          userId: input.user.id,
          action: `purchase.${input.type}.uncertain`,
          metadata: { reference, amountKobo: input.amountKobo },
          ip: null,
          createdAt: this.now(),
        });
        return record;
      });
      return {
        transaction: toTransaction(updated),
        wallet: await this.wallet.getWallet(input.user.id),
        simulated: updated.simulated,
      };
    }
  }

  async purchaseAirtime(user: UserRecord, input: AirtimePurchaseInput): Promise<PurchaseResult> {
    if (input.amountKobo < AIRTIME_MIN_KOBO || input.amountKobo > AIRTIME_MAX_KOBO) {
      throw Errors.validation(
        `Airtime amount must be between ₦${AIRTIME_MIN_KOBO / 100} and ₦${AIRTIME_MAX_KOBO / 100}`,
      );
    }
    if (input.amountKobo % 100 !== 0) {
      throw Errors.validation('Airtime amount must be a whole Naira amount');
    }
    const phone = this.validatePhoneForNetwork(input.phone, input.network);
    const serviceFeeKobo = calculateAirtimeFeeKobo(input.amountKobo, {
      percent: this.config.airtimeFeePercent,
      minKobo: this.config.airtimeFeeMinKobo,
    });
    return this.executePurchase({
      user,
      type: 'airtime',
      amountKobo: input.amountKobo,
      feeKobo: serviceFeeKobo,
      recipient: { phone, network: input.network },
      details: {
        network: input.network,
        phone,
        faceValueKobo: input.amountKobo,
        serviceFeeKobo,
      },
      pin: input.pin,
      operationName: 'airtime',
      callProvider: (reference) =>
        this.provider.purchaseAirtime({
          network: input.network,
          phone,
          amountKobo: input.amountKobo,
          reference,
        }),
    });
  }

  async purchaseData(user: UserRecord, input: DataPurchaseInput): Promise<PurchaseResult> {
    const plan = await this.catalog.findDataPlan(input.network, input.planId);
    if (!plan) throw Errors.notFound('Data plan not found for this network');
    const phone = this.validatePhoneForNetwork(input.phone, input.network);
    return this.executePurchase({
      user,
      type: 'data',
      amountKobo: plan.priceKobo,
      recipient: { phone, network: input.network },
      details: {
        network: input.network,
        phone,
        planId: plan.id,
        planName: plan.name,
        allowance: plan.allowance,
        validity: plan.validity,
      },
      pin: input.pin,
      operationName: 'data',
      callProvider: (reference) =>
        this.provider.purchaseData({
          network: input.network,
          phone,
          planId: plan.id,
          planName: plan.name,
          amountKobo: plan.priceKobo,
          reference,
        }),
    });
  }

  async purchaseElectricity(
    user: UserRecord,
    input: ElectricityPurchaseInput,
  ): Promise<PurchaseResult> {
    if (
      input.amountKobo < ELECTRICITY_MIN_KOBO ||
      input.amountKobo > ELECTRICITY_MAX_KOBO
    ) {
      throw Errors.validation(
        `Electricity amount must be between ₦${ELECTRICITY_MIN_KOBO / 100} and ₦${ELECTRICITY_MAX_KOBO / 100}`,
      );
    }
    const verification = await this.verifyMeter(input);
    return this.executePurchase({
      user,
      type: 'electricity',
      amountKobo: input.amountKobo,
      recipient: {
        billerId: input.billerId,
        meterNumber: input.meterNumber,
        meterType: input.meterType,
        name: verification.customerName,
      },
      details: {
        billerId: input.billerId,
        meterNumber: input.meterNumber,
        meterType: input.meterType,
        customerName: verification.customerName,
        customerAddress: verification.customerAddress,
        verificationIsDemo: verification.isDemo,
      },
      pin: input.pin,
      operationName: 'electricity',
      callProvider: (reference) =>
        this.provider.purchaseElectricity({
          billerId: input.billerId,
          meterNumber: input.meterNumber,
          meterType: input.meterType,
          amountKobo: input.amountKobo,
          reference,
        }),
    });
  }

  async purchaseCable(user: UserRecord, input: CablePurchaseInput): Promise<PurchaseResult> {
    const provider = getCableProvider(input.providerId);
    if (!provider) throw Errors.notFound('Cable provider not found');
    const item = getCablePackage(input.providerId, input.packageId);
    if (!item) throw Errors.notFound('Cable package not found');
    const verification = await this.verifyCable(input);
    return this.executePurchase({
      user,
      type: 'cable',
      amountKobo: item.priceKobo,
      recipient: {
        providerId: input.providerId,
        smartcardNumber: input.smartcardNumber,
        name: verification.customerName,
      },
      details: {
        providerId: input.providerId,
        providerName: provider.name,
        packageId: item.id,
        packageName: item.name,
        smartcardNumber: input.smartcardNumber,
        customerName: verification.customerName,
        verificationIsDemo: verification.isDemo,
      },
      pin: input.pin,
      operationName: 'cable',
      callProvider: (reference) =>
        this.provider.purchaseCable({
          providerId: input.providerId,
          packageId: item.id,
          packageName: item.name,
          smartcardNumber: input.smartcardNumber,
          amountKobo: item.priceKobo,
          reference,
        }),
    });
  }

  async purchaseExam(user: UserRecord, input: ExamPurchaseInput): Promise<PurchaseResult> {
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > EXAM_MAX_QUANTITY) {
      throw Errors.validation(`Choose between 1 and ${EXAM_MAX_QUANTITY} vouchers`);
    }
    const product = getExamProduct(input.productId);
    if (!product) throw Errors.notFound('Examination product not found');
    const amountKobo = product.priceKobo * input.quantity;
    return this.executePurchase({
      user,
      type: 'exam',
      amountKobo,
      recipient: {
        productId: product.id,
        productName: product.name,
        provider: product.provider,
        quantity: input.quantity,
      },
      details: {
        productId: product.id,
        productName: product.name,
        provider: product.provider,
        quantity: input.quantity,
        unitPriceKobo: product.priceKobo,
      },
      pin: input.pin,
      operationName: 'exam',
      callProvider: (reference) =>
        this.provider.purchaseExam({
          productId: product.id,
          productName: product.name,
          quantity: input.quantity,
          amountKobo,
          reference,
        }),
    });
  }

  /**
   * Applies a signed supplier webhook to the matching transaction.
   *
   * The payload shape is not documented, so reference and status fields are
   * discovered recursively. Signature verification happens in the route before
   * this method is called.
   */
  async handleProviderWebhook(
    provider: string,
    payload: JsonObject,
  ): Promise<{
    processed: boolean;
    reason?: string;
    reference: string | null;
    outcome: ProviderWebhookOutcome;
  }> {
    const referenceValues: unknown[] = [];
    collectWebhookFields(payload, REFERENCE_KEYS, referenceValues);
    const references = [
      ...new Set(
        referenceValues
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];

    let found: TransactionRecord | null = null;
    let matchedReference: string | null = null;
    for (const reference of references) {
      found =
        (await this.store.getTransactionByReference(reference)) ??
        (await this.store.findTransactionByProviderReference(reference));
      if (found) {
        matchedReference = reference;
        break;
      }
    }

    if (!found) {
      return {
        processed: false,
        reason: 'unknown_reference',
        reference: references[0] ?? null,
        outcome: 'unknown',
      };
    }
    const transaction = found;
    if (transaction.simulated) {
      return {
        processed: false,
        reason: 'simulated_transaction',
        reference: transaction.reference,
        outcome: 'unknown',
      };
    }

    const statusSignals: unknown[] = [];
    collectWebhookFields(payload, STATUS_KEYS, statusSignals);
    const outcome = deriveWebhookOutcome(statusSignals);

    const messageValues: unknown[] = [];
    collectWebhookFields(payload, MESSAGE_KEYS, messageValues);
    const message = messageValues.find(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );

    if (outcome === 'unknown') {
      return {
        processed: false,
        reason: 'unknown_outcome',
        reference: transaction.reference,
        outcome,
      };
    }

    const providerReference =
      transaction.providerReference ??
      (matchedReference && matchedReference !== transaction.reference ? matchedReference : null);

    if (outcome === 'pending') {
      if (['successful', 'failed', 'refunded', 'reversed'].includes(transaction.status)) {
        return {
          processed: false,
          reason: 'stale_pending',
          reference: transaction.reference,
          outcome,
        };
      }
      const updated = await this.store.transaction(async (tx) => {
        const record = await tx.updateTransaction(
          transaction.id,
          {
            status: 'processing',
            providerReference: providerReference ?? transaction.providerReference,
            details: {
              ...transaction.details,
              providerMessage: message ?? transaction.details.providerMessage ?? null,
              providerWebhook: true,
              lastCheckedAt: this.now().toISOString(),
            },
            updatedAt: this.now(),
          },
          this.now(),
        );
        await tx.recordAudit({
          id: newId(),
          userId: transaction.userId,
          action: `purchase.${transaction.type}.webhook_processing`,
          metadata: { reference: transaction.reference, provider },
          ip: null,
          createdAt: this.now(),
        });
        return record;
      });
      return {
        processed: true,
        reference: updated.reference,
        outcome,
      };
    }

    if (outcome === 'successful') {
      if (transaction.status === 'successful') {
        return {
          processed: false,
          reason: 'duplicate',
          reference: transaction.reference,
          outcome,
        };
      }
      if (['failed', 'refunded', 'reversed'].includes(transaction.status)) {
        await this.store.recordAudit({
          id: newId(),
          userId: transaction.userId,
          action: `purchase.${transaction.type}.webhook_conflict`,
          metadata: {
            reference: transaction.reference,
            provider,
            outcome,
            message: 'Supplier reported success after the order was already refunded.',
          },
          ip: null,
          createdAt: this.now(),
        });
        return {
          processed: false,
          reason: 'conflicting_final_status',
          reference: transaction.reference,
          outcome,
        };
      }
      const updated = await this.store.transaction(async (tx) => {
        const record = await tx.updateTransaction(
          transaction.id,
          {
            status: 'successful',
            providerReference: providerReference ?? transaction.providerReference,
            failureReason: null,
            details: {
              ...transaction.details,
              providerMessage: message ?? 'The supplier confirmed this order.',
              providerWebhook: true,
              reconciled: true,
            },
            completedAt: this.now(),
            updatedAt: this.now(),
          },
          this.now(),
        );
        await tx.recordAudit({
          id: newId(),
          userId: transaction.userId,
          action: `purchase.${transaction.type}.webhook_successful`,
          metadata: { reference: transaction.reference, provider },
          ip: null,
          createdAt: this.now(),
        });
        return record;
      });
      return {
        processed: true,
        reference: updated.reference,
        outcome,
      };
    }

    // outcome === 'failed'
    if (['failed', 'refunded', 'reversed'].includes(transaction.status)) {
      return {
        processed: false,
        reason: 'duplicate',
        reference: transaction.reference,
        outcome,
      };
    }
    if (transaction.status === 'successful') {
      await this.store.recordAudit({
        id: newId(),
        userId: transaction.userId,
        action: `purchase.${transaction.type}.webhook_conflict`,
        metadata: {
          reference: transaction.reference,
          provider,
          outcome,
          message: 'Supplier reported failure after the order was already successful.',
        },
        ip: null,
        createdAt: this.now(),
      });
      return {
        processed: false,
        reason: 'conflicting_final_status',
        reference: transaction.reference,
        outcome,
      };
    }

    const failureMessage = message ?? 'The supplier reported that this order failed.';
    const updated = await this.store.transaction(async (tx) => {
      const reversal = await tx.findLedgerByReference(
        `reversal:purchase:${transaction.reference}`,
      );
      if (!reversal) {
        const debit = await tx.findLedgerByReference(`purchase:${transaction.reference}`);
        if (debit) {
          await this.wallet.reverse(tx, {
            userId: transaction.userId,
            amountKobo: debit.amountKobo,
            originalReference: debit.reference,
            transactionId: transaction.id,
            reason: failureMessage,
          });
        }
      }
      const record = await tx.updateTransaction(
        transaction.id,
        {
          status: 'refunded',
          failureReason: failureMessage,
          providerReference: providerReference ?? transaction.providerReference,
          details: {
            ...transaction.details,
            providerMessage: failureMessage,
            providerWebhook: true,
            reconciled: true,
            refunded: true,
          },
          completedAt: this.now(),
          updatedAt: this.now(),
        },
        this.now(),
      );
      await tx.recordAudit({
        id: newId(),
        userId: transaction.userId,
        action: `purchase.${transaction.type}.webhook_refunded`,
        metadata: { reference: transaction.reference, provider },
        ip: null,
        createdAt: this.now(),
      });
      return record;
    });
    return {
      processed: true,
      reference: updated.reference,
      outcome,
    };
  }

  async getTransaction(
    userId: string,
    transactionId: string,
  ): Promise<{ transaction: Transaction; wallet: WalletSummary }> {
    const record = await this.store.getTransactionById(transactionId);
    if (!record || record.userId !== userId) {
      throw Errors.notFound('Transaction not found');
    }
    return {
      transaction: toTransaction(record),
      wallet: await this.wallet.getWallet(userId),
    };
  }

  async listTransactions(
    userId: string,
    filter: Omit<TransactionFilter, 'limit'> & { limit?: number },
  ): Promise<{ items: Transaction[]; nextCursor: string | null }> {
    const page = await this.store.listTransactions(userId, {
      type: filter.type,
      status: filter.status,
      limit: Math.min(Math.max(filter.limit ?? 20, 1), 50),
      cursor: filter.cursor,
    });
    return {
      items: page.items.map(toTransaction),
      nextCursor: page.nextCursor,
    };
  }

  async refreshTransaction(
    userId: string,
    transactionId: string,
  ): Promise<{ transaction: Transaction; wallet: WalletSummary }> {
    const record = await this.store.getTransactionById(transactionId);
    if (!record || record.userId !== userId) {
      throw Errors.notFound('Transaction not found');
    }
    if (!['uncertain', 'processing'].includes(record.status)) {
      return {
        transaction: toTransaction(record),
        wallet: await this.wallet.getWallet(userId),
      };
    }
    if (!record.providerReference) {
      return {
        transaction: toTransaction(record),
        wallet: await this.wallet.getWallet(userId),
      };
    }

    let status: ProviderStatusResult;
    try {
      status = await this.provider.getStatus(record.providerReference);
    } catch (error) {
      // A failed status lookup is not proof that the order failed. Keep the
      // debit in place and leave the transaction uncertain for a later check.
      const message =
        error instanceof Error ? error.message : 'Provider status lookup failed';
      const pending = await this.store.updateTransaction(
        record.id,
        {
          status: 'uncertain',
          details: {
            ...record.details,
            providerMessage: message,
            lastCheckedAt: this.now().toISOString(),
          },
          updatedAt: this.now(),
        },
        this.now(),
      );
      return {
        transaction: toTransaction(pending),
        wallet: await this.wallet.getWallet(userId),
      };
    }

    if (status.state === 'successful') {
      const updated = await this.store.transaction(async (tx) => {
        const result = await tx.updateTransaction(
          record.id,
          {
            status: 'successful',
            details: {
              ...record.details,
              providerMessage: status.message,
              reconciled: true,
            },
            completedAt: this.now(),
            updatedAt: this.now(),
          },
          this.now(),
        );
        await tx.recordAudit({
          id: newId(),
          userId,
          action: `purchase.${record.type}.reconciled_successful`,
          metadata: { reference: record.reference },
          ip: null,
          createdAt: this.now(),
        });
        return result;
      });
      return {
        transaction: toTransaction(updated),
        wallet: await this.wallet.getWallet(userId),
      };
    }

    if (status.state === 'failed') {
      const updated = await this.store.transaction(async (tx) => {
        const reversal = await tx.findLedgerByReference(`reversal:purchase:${record.reference}`);
        if (!reversal) {
          const debit = await tx.findLedgerByReference(`purchase:${record.reference}`);
          if (debit) {
            await this.wallet.reverse(tx, {
              userId,
              amountKobo: debit.amountKobo,
              originalReference: debit.reference,
              transactionId: record.id,
              reason: status.message,
            });
          }
        }
        const result = await tx.updateTransaction(
          record.id,
          {
            status: 'refunded',
            failureReason: status.message,
            details: { ...record.details, reconciled: true, refunded: true },
            completedAt: this.now(),
            updatedAt: this.now(),
          },
          this.now(),
        );
        await tx.recordAudit({
          id: newId(),
          userId,
          action: `purchase.${record.type}.reconciled_refunded`,
          metadata: { reference: record.reference },
          ip: null,
          createdAt: this.now(),
        });
        return result;
      });
      return {
        transaction: toTransaction(updated),
        wallet: await this.wallet.getWallet(userId),
      };
    }

    const pending = await this.store.updateTransaction(
      record.id,
      {
        status: record.status,
        details: { ...record.details, providerMessage: status.message, lastCheckedAt: this.now().toISOString() },
        updatedAt: this.now(),
      },
      this.now(),
    );
    return {
      transaction: toTransaction(pending),
      wallet: await this.wallet.getWallet(userId),
    };
  }

  /**
   * Polls supplier orders that are still `processing` or `uncertain`.
   *
   * Bigisub does not send webhooks, so this is the only automatic path to a
   * final result. `updatedAt` doubles as a throttle: a poll that comes back
   * pending updates the record, so the same order is not checked again until
   * the minimum age has elapsed. One failing order never blocks the rest.
   */
  async reconcilePendingTransactions(
    options: { limit?: number; minAgeMs?: number } = {},
  ): Promise<{ checked: number; settled: number; failed: number }> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const minAgeMs = Math.max(options.minAgeMs ?? 30_000, 0);
    const due = await this.store.listTransactionsByStatus(
      ['processing', 'uncertain'],
      new Date(this.now().getTime() - minAgeMs),
      limit,
    );

    let settled = 0;
    let failed = 0;
    for (const record of due) {
      try {
        const result = await this.refreshTransaction(record.userId, record.id);
        if (['successful', 'refunded', 'failed'].includes(result.transaction.status)) {
          settled += 1;
        }
      } catch {
        failed += 1;
      }
    }
    return { checked: due.length, settled, failed };
  }

  statusExplanation(status: TransactionStatus): string {
    switch (status) {
      case 'successful':
        return 'The provider confirmed this order.';
      case 'refunded':
      case 'reversed':
        return 'The order did not complete and your wallet was refunded.';
      case 'uncertain':
        return 'The provider has not returned a final result. We have kept the debit in place to avoid a double charge. Refresh the status before retrying.';
      case 'failed':
        return 'The provider declined this order.';
      case 'processing':
        return 'The provider is processing this order. Do not retry yet.';
      default:
        return 'This transaction is being prepared.';
    }
  }
}

export type { TransactionType };
