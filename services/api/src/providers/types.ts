import type { DataPlan } from '@kashahara/shared';
import type {
  CableVerification,
  MeterVerification,
  ProviderPurchaseResult,
  ProviderStatusResult,
} from '../types';

export interface AirtimeRequest {
  network: string;
  phone: string;
  amountKobo: number;
  reference: string;
}

export interface DataRequest {
  network: string;
  phone: string;
  planId: string;
  planName: string;
  amountKobo: number;
  reference: string;
}

export interface MeterRequest {
  billerId: string;
  meterNumber: string;
  meterType: 'prepaid' | 'postpaid';
}

export interface ElectricityRequest extends MeterRequest {
  amountKobo: number;
  reference: string;
}

export interface CableVerifyRequest {
  providerId: string;
  smartcardNumber: string;
}

export interface CablePurchaseRequest {
  providerId: string;
  packageId: string;
  packageName: string;
  smartcardNumber: string;
  amountKobo: number;
  reference: string;
}

export interface ExamRequest {
  productId: string;
  productName: string;
  quantity: number;
  amountKobo: number;
  reference: string;
}

export interface VtuProvider {
  readonly name: string;
  /** True for the development simulator. Never true for a live supplier. */
  readonly isSimulated: boolean;
  purchaseAirtime(request: AirtimeRequest): Promise<ProviderPurchaseResult>;
  purchaseData(request: DataRequest): Promise<ProviderPurchaseResult>;
  verifyMeter(request: MeterRequest): Promise<MeterVerification>;
  purchaseElectricity(request: ElectricityRequest): Promise<ProviderPurchaseResult>;
  verifyCable(request: CableVerifyRequest): Promise<CableVerification>;
  purchaseCable(request: CablePurchaseRequest): Promise<ProviderPurchaseResult>;
  purchaseExam(request: ExamRequest): Promise<ProviderPurchaseResult>;
  getStatus(providerReference: string): Promise<ProviderStatusResult>;
  /**
   * Supplier-backed data plans, when the supplier publishes a live catalogue.
   * Providers without a plan API omit this method and the bundled demo
   * catalogue is used instead.
   */
  listDataPlans?(): Promise<readonly DataPlan[]>;
}

/** The provider definitely declined the request. */
export class ProviderRejectedError extends Error {
  readonly providerReference: string | null;
  readonly raw: Record<string, unknown> | null;

  constructor(
    message: string,
    options: { providerReference?: string | null; raw?: Record<string, unknown> | null } = {},
  ) {
    super(message);
    this.name = 'ProviderRejectedError';
    this.providerReference = options.providerReference ?? null;
    this.raw = options.raw ?? null;
  }
}

/**
 * The supplier accepted the request and is still processing it. The debit is
 * kept and the transaction stays `processing` until a webhook or manual
 * reconciliation provides a final result.
 */
export class ProviderPendingError extends Error {
  readonly providerReference: string | null;
  readonly raw: Record<string, unknown> | null;

  constructor(
    message = 'The supplier accepted the request and is still processing it',
    options: { providerReference?: string | null; raw?: Record<string, unknown> | null } = {},
  ) {
    super(message);
    this.name = 'ProviderPendingError';
    this.providerReference = options.providerReference ?? null;
    this.raw = options.raw ?? null;
  }
}

/**
 * The request may have reached the provider, but no definitive result is
 * available. Callers must not retry blindly; they must reconcile first.
 */
export class ProviderTimeoutError extends Error {
  readonly providerReference: string | null;
  readonly raw: Record<string, unknown> | null;

  constructor(
    message = 'The provider did not return a definitive result',
    options: { providerReference?: string | null; raw?: Record<string, unknown> | null } = {},
  ) {
    super(message);
    this.name = 'ProviderTimeoutError';
    this.providerReference = options.providerReference ?? null;
    this.raw = options.raw ?? null;
  }
}

export class ProviderNotConfiguredError extends Error {
  constructor(message = 'No VTU supplier is configured') {
    super(message);
    this.name = 'ProviderNotConfiguredError';
  }
}
