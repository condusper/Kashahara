import type {
  CableVerification,
  MeterVerification,
  ProviderPurchaseResult,
  ProviderStatusResult,
  ProviderVoucher,
} from '../types';
import {
  ProviderNotConfiguredError,
  ProviderRejectedError,
  ProviderTimeoutError,
  type AirtimeRequest,
  type CablePurchaseRequest,
  type CableVerifyRequest,
  type DataRequest,
  type ElectricityRequest,
  type ExamRequest,
  type MeterRequest,
  type VtuProvider,
} from './types';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function readString(object: JsonObject, key: string): string | null {
  const value = object[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function readVouchers(value: unknown): ProviderVoucher[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => asObject(item))
    .filter((item): item is JsonObject => Boolean(item))
    .map((item) => ({
      pin: readString(item, 'pin') ?? '',
      serial: readString(item, 'serial') ?? '',
      ...(readString(item, 'expiresAt') ? { expiresAt: readString(item, 'expiresAt') as string } : {}),
    }))
    .filter((voucher) => voucher.pin.length > 0);
}

/**
 * Generic HTTP adapter for an authorized VTU supplier.
 *
 * The exact supplier contract varies. Adapt the paths and field names below to
 * the supplier's documented API, then verify every operation in the supplier's
 * sandbox before enabling live traffic. This adapter is deliberately not
 * enabled unless VTU_PROVIDER=http and credentials are configured.
 */
export class HttpVtuProvider implements VtuProvider {
  readonly name = 'http';
  readonly isSimulated = false;

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { baseUrl: string; apiKey: string; fetchImpl?: typeof fetch }) {
    if (!options.baseUrl || !options.apiKey) {
      throw new ProviderNotConfiguredError(
        'VTU_BASE_URL and VTU_API_KEY are required for the HTTP provider',
      );
    }
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async call(
    method: 'GET' | 'POST',
    path: string,
    body?: JsonObject,
    idempotencyKey?: string,
  ): Promise<JsonObject> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new ProviderTimeoutError(
        'The VTU supplier could not be reached. The request may have been received.',
        { raw: { error: error instanceof Error ? error.message : String(error) } },
      );
    }

    const text = await response.text();
    let payload: JsonObject | null = null;
    try {
      payload = text ? (JSON.parse(text) as JsonObject) : null;
    } catch {
      payload = null;
    }

    if (response.status >= 500) {
      throw new ProviderTimeoutError('The VTU supplier returned a server error.', {
        raw: payload ?? { status: response.status, body: text.slice(0, 500) },
      });
    }
    if (!response.ok) {
      throw new ProviderRejectedError(
        readString(payload ?? {}, 'message') ?? `The VTU supplier rejected the request (${response.status}).`,
        {
          providerReference: payload ? readString(payload, 'providerReference') : null,
          raw: payload ?? { status: response.status, body: text.slice(0, 500) },
        },
      );
    }
    if (!payload) {
      throw new ProviderTimeoutError('The VTU supplier returned an unreadable response.');
    }

    const status = readString(payload, 'status')?.toLowerCase();
    if (status === 'failed' || status === 'declined') {
      throw new ProviderRejectedError(
        readString(payload, 'message') ?? 'The VTU supplier declined the request.',
        {
          providerReference: readString(payload, 'providerReference'),
          raw: payload,
        },
      );
    }
    if (status === 'pending' || status === 'processing') {
      throw new ProviderTimeoutError(
        readString(payload, 'message') ?? 'The VTU supplier is still processing the request.',
        {
          providerReference: readString(payload, 'providerReference'),
          raw: payload,
        },
      );
    }
    if (status && status !== 'success' && status !== 'successful') {
      throw new ProviderTimeoutError('The VTU supplier returned an unknown status.', {
        providerReference: readString(payload, 'providerReference'),
        raw: payload,
      });
    }
    return payload;
  }

  private purchaseResult(payload: JsonObject, fallbackMessage: string): ProviderPurchaseResult {
    const providerReference =
      readString(payload, 'providerReference') ?? readString(payload, 'reference');
    if (!providerReference) {
      throw new ProviderTimeoutError(
        'The VTU supplier returned success without a provider reference.',
        { raw: payload },
      );
    }
    return {
      providerReference,
      message: readString(payload, 'message') ?? fallbackMessage,
      ...(readString(payload, 'token') ? { token: readString(payload, 'token') as string } : {}),
      ...(readString(payload, 'units') ? { units: readString(payload, 'units') as string } : {}),
      ...(readVouchers(payload.vouchers) ? { vouchers: readVouchers(payload.vouchers) } : {}),
      raw: payload,
      simulated: false,
    };
  }

  async purchaseAirtime(request: AirtimeRequest): Promise<ProviderPurchaseResult> {
    const payload = await this.call(
      'POST',
      '/v1/airtime',
      {
        network: request.network,
        phone: request.phone,
        amountKobo: request.amountKobo,
        reference: request.reference,
      },
      request.reference,
    );
    return this.purchaseResult(payload, 'Airtime purchase submitted to the supplier.');
  }

  async purchaseData(request: DataRequest): Promise<ProviderPurchaseResult> {
    const payload = await this.call(
      'POST',
      '/v1/data',
      {
        network: request.network,
        phone: request.phone,
        planId: request.planId,
        amountKobo: request.amountKobo,
        reference: request.reference,
      },
      request.reference,
    );
    return this.purchaseResult(payload, 'Data purchase submitted to the supplier.');
  }

  async verifyMeter(request: MeterRequest): Promise<MeterVerification> {
    const payload = await this.call('POST', '/v1/electricity/verify', {
      billerId: request.billerId,
      meterNumber: request.meterNumber,
      meterType: request.meterType,
    });
    const customerName = readString(payload, 'customerName');
    if (!customerName) {
      throw new ProviderTimeoutError('The supplier did not return a customer name.', {
        raw: payload,
      });
    }
    return {
      customerName,
      customerAddress: readString(payload, 'customerAddress'),
      meterNumber: request.meterNumber,
      meterType: request.meterType,
      billerId: request.billerId,
      isDemo: false,
    };
  }

  async purchaseElectricity(request: ElectricityRequest): Promise<ProviderPurchaseResult> {
    const payload = await this.call(
      'POST',
      '/v1/electricity',
      {
        billerId: request.billerId,
        meterNumber: request.meterNumber,
        meterType: request.meterType,
        amountKobo: request.amountKobo,
        reference: request.reference,
      },
      request.reference,
    );
    return this.purchaseResult(payload, 'Electricity payment submitted to the supplier.');
  }

  async verifyCable(request: CableVerifyRequest): Promise<CableVerification> {
    const payload = await this.call('POST', '/v1/cable/verify', {
      providerId: request.providerId,
      smartcardNumber: request.smartcardNumber,
    });
    const customerName = readString(payload, 'customerName');
    if (!customerName) {
      throw new ProviderTimeoutError('The supplier did not return a customer name.', {
        raw: payload,
      });
    }
    return {
      customerName,
      smartcardNumber: request.smartcardNumber,
      providerId: request.providerId,
      currentPackage: readString(payload, 'currentPackage'),
      isDemo: false,
    };
  }

  async purchaseCable(request: CablePurchaseRequest): Promise<ProviderPurchaseResult> {
    const payload = await this.call(
      'POST',
      '/v1/cable',
      {
        providerId: request.providerId,
        packageId: request.packageId,
        smartcardNumber: request.smartcardNumber,
        amountKobo: request.amountKobo,
        reference: request.reference,
      },
      request.reference,
    );
    return this.purchaseResult(payload, 'Cable subscription submitted to the supplier.');
  }

  async purchaseExam(request: ExamRequest): Promise<ProviderPurchaseResult> {
    const payload = await this.call(
      'POST',
      '/v1/exam',
      {
        productId: request.productId,
        quantity: request.quantity,
        amountKobo: request.amountKobo,
        reference: request.reference,
      },
      request.reference,
    );
    return this.purchaseResult(payload, 'Examination voucher submitted to the supplier.');
  }

  async getStatus(providerReference: string): Promise<ProviderStatusResult> {
    const payload = await this.call(
      'GET',
      `/v1/transactions/${encodeURIComponent(providerReference)}`,
    );
    const rawStatus = readString(payload, 'status')?.toLowerCase();
    const state =
      rawStatus === 'success' || rawStatus === 'successful'
        ? 'successful'
        : rawStatus === 'failed' || rawStatus === 'declined'
          ? 'failed'
          : 'pending';
    return {
      state,
      providerReference:
        readString(payload, 'providerReference') ?? providerReference,
      message: readString(payload, 'message') ?? `Supplier status: ${state}`,
      ...(asObject(payload.details) ? { details: asObject(payload.details) as Record<string, unknown> } : {}),
    };
  }
}
