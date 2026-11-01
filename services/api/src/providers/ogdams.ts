import type { DataPlan, Network } from '@kashahara/shared';
import type {
  CableVerification,
  MeterVerification,
  ProviderPurchaseResult,
  ProviderStatusResult,
} from '../types';
import {
  ProviderNotConfiguredError,
  ProviderPendingError,
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

const NETWORK_ID: Record<Network, number> = {
  MTN: 1,
  AIRTEL: 2,
  GLO: 3,
  '9MOBILE': 4,
};

const NETWORK_BY_ID: Record<number, Network> = {
  1: 'MTN',
  2: 'AIRTEL',
  3: 'GLO',
  4: '9MOBILE',
};

const NETWORK_ORDER: readonly Network[] = ['MTN', 'GLO', 'AIRTEL', '9MOBILE'];

const PLAN_CACHE_TTL_MS = 5 * 60 * 1000;

function networkIdFor(network: string): number | null {
  return NETWORK_ID[network as Network] ?? null;
}

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
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function readMessage(payload: JsonObject | null): string | null {
  if (!payload) return null;
  const data = asObject(payload.data);
  const candidates = [
    readString(data, 'msg'),
    readString(payload, 'msg'),
    readString(payload, 'message'),
    typeof payload.data === 'string' ? payload.data : null,
  ];
  return candidates.find((value) => Boolean(value)) ?? null;
}

function readReference(payload: JsonObject | null): string | null {
  if (!payload) return null;
  const data = asObject(payload.data);
  return (
    readString(data, 'ref') ??
    readString(data, 'reference') ??
    readString(payload, 'ref') ??
    readString(payload, 'reference')
  );
}

function formatValidity(value: string | null): string {
  if (!value) return '—';
  return value
    .replace(/^(\d+)\s*days?$/i, (_match, count: string) =>
      Number(count) === 1 ? '1 day' : `${count} days`,
    )
    .replace(/^(\d+)\s*months?$/i, (_match, count: string) => `${count} month${Number(count) === 1 ? '' : 's'}`);
}

function extractAllowance(name: string): string | null {
  const match = name.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)/i);
  if (!match) return null;
  return `${match[1]}${match[2]!.toUpperCase()}`;
}

function categoryFor(name: string): DataPlan['category'] {
  const upper = name.toUpperCase();
  if (upper.includes('[SME]') || upper.includes(' SME ')) return 'SME';
  if (upper.includes('CORPORATE')) return 'Corporate';
  if (upper.includes('GIFTING') || upper.includes('AWOOF')) return 'Gifting';
  return 'Direct';
}

function toDataPlan(raw: unknown): DataPlan | null {
  const plan = asObject(raw);
  if (!plan) return null;
  const networkId = readNumber(plan, 'networkId');
  const planId = readNumber(plan, 'planId');
  const price = readNumber(plan, 'price');
  const rawName = readString(plan, 'name');
  if (!networkId || !planId || !price || !rawName || price <= 0) return null;
  const network = NETWORK_BY_ID[networkId];
  if (!network) return null;

  const allowance = extractAllowance(rawName);
  // Voice-only and other non-data products are not data bundles. Skip them so
  // the data screen only offers products the customer can understand.
  if (!allowance) return null;

  const name = rawName.replace(/\s*\[[^\]]+\]/g, '').trim() || rawName;
  return {
    id: String(planId),
    network,
    name,
    allowance,
    validity: formatValidity(readString(plan, 'validity')),
    priceKobo: Math.round(price * 100),
    category: categoryFor(rawName),
    isDemo: false,
  };
}

/**
 * Ogdams SimHosting supplier adapter.
 *
 * Endpoints used:
 *  - `GET  /get/data/plans`  live catalogue (426 products at time of writing)
 *  - `POST /vend/airtime`    `{ networkId, amount, phoneNumber, type, reference }`
 *  - `POST /vend/data`       `{ networkId, planId, phoneNumber, reference }`
 *
 * Ogdams answers with `{ status, code, data: { msg, ref } }`. Codes 200/201
 * mean accepted, 202 means the supplier is still processing, and 424 (or a
 * false `status`) means rejected. There is no documented status lookup
 * endpoint, so an uncertain transaction stays uncertain until support checks
 * the supplier dashboard; the wallet debit is intentionally not reversed.
 */
export class OgdamsVtuProvider implements VtuProvider {
  readonly name = 'ogdams';
  readonly isSimulated = false;

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly airtimeType: string;
  private readonly fetchImpl: typeof fetch;
  private readonly planTtlMs: number;

  private planCache: { at: number; plans: readonly DataPlan[] } | null = null;
  private plansInFlight: Promise<readonly DataPlan[]> | null = null;

  constructor(options: {
    baseUrl: string;
    apiKey: string;
    airtimeType?: string;
    fetchImpl?: typeof fetch;
    planTtlMs?: number;
  }) {
    if (!options.baseUrl || !options.apiKey) {
      throw new ProviderNotConfiguredError('OGDAMS_BASE_URL and OGDAMS_API_KEY are required');
    }
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    const airtimeType = (options.airtimeType ?? 'vtu').toLowerCase();
    if (!['vtu', 'momo', 'sns', 'awuf4u'].includes(airtimeType)) {
      throw new ProviderNotConfiguredError(
        'OGDAMS_AIRTIME_TYPE must be one of vtu, momo, sns, or awuf4u',
      );
    }
    this.airtimeType = airtimeType;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.planTtlMs = options.planTtlMs ?? PLAN_CACHE_TTL_MS;
  }

  private async request(method: 'GET' | 'POST', path: string, body?: JsonObject): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new ProviderTimeoutError(
        'The VTU supplier could not be reached. The request may have been received.',
        { raw: { error: error instanceof Error ? error.message : String(error) } },
      );
    }

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (response.status >= 500) {
      throw new ProviderTimeoutError('The VTU supplier returned a server error.', {
        raw: asObject(payload) ?? { status: response.status, body: text.slice(0, 500) },
      });
    }
    if (response.status === 401 || response.status === 403) {
      throw new ProviderRejectedError('The VTU supplier rejected the configured API key.', {
        raw: asObject(payload) ?? { status: response.status },
      });
    }
    if (!response.ok) {
      const object = asObject(payload);
      throw new ProviderRejectedError(
        readMessage(object) ?? `The VTU supplier rejected the request (${response.status}).`,
        { providerReference: readReference(object), raw: object ?? { status: response.status } },
      );
    }
    if (payload === null) {
      throw new ProviderTimeoutError('The VTU supplier returned an unreadable response.');
    }
    return payload;
  }

  private purchaseResult(payload: unknown, requestReference: string, fallbackMessage: string): ProviderPurchaseResult {
    const object = asObject(payload);
    if (!object) {
      throw new ProviderTimeoutError('The VTU supplier returned an unexpected response.', {
        providerReference: requestReference,
      });
    }
    const status = object.status;
    const code = readNumber(object, 'code');
    const message = readMessage(object) ?? fallbackMessage;
    const providerReference = readReference(object) ?? requestReference;

    if (code === 201 || code === 202) {
      throw new ProviderPendingError(
        message || 'The VTU supplier is still processing the request.',
        { providerReference, raw: object },
      );
    }
    if (status === true || code === 200) {
      return {
        providerReference,
        message,
        raw: object,
        simulated: false,
      };
    }
    throw new ProviderRejectedError(message, {
      providerReference: readReference(object),
      raw: object,
    });
  }

  async purchaseAirtime(request: AirtimeRequest): Promise<ProviderPurchaseResult> {
    const networkId = networkIdFor(request.network);
    if (!networkId) {
      throw new ProviderRejectedError(`Unsupported network: ${request.network}`);
    }
    const payload = await this.request('POST', '/vend/airtime', {
      networkId,
      amount: request.amountKobo / 100,
      phoneNumber: request.phone,
      type: this.airtimeType,
      reference: request.reference,
    });
    return this.purchaseResult(
      payload,
      request.reference,
      `Airtime submitted to the supplier for ${request.phone}.`,
    );
  }

  async purchaseData(request: DataRequest): Promise<ProviderPurchaseResult> {
    const networkId = networkIdFor(request.network);
    if (!networkId) {
      throw new ProviderRejectedError(`Unsupported network: ${request.network}`);
    }
    const planId = Number(request.planId);
    if (!Number.isSafeInteger(planId) || planId <= 0) {
      throw new ProviderRejectedError('Invalid data plan selected.');
    }

    // Refuse to send a stale price. The catalogue and the wallet debit must
    // agree with what the supplier is going to charge. If the catalogue cannot
    // be refreshed, reject (and refund) rather than hold an uncertain debit
    // for a request that was never sent.
    let plans: readonly DataPlan[];
    try {
      plans = await this.listDataPlans();
    } catch {
      throw new ProviderRejectedError(
        'Could not confirm the current data plan price. Please try again.',
      );
    }
    const plan = plans.find((item) => item.network === request.network && item.id === String(planId));
    if (!plan) {
      throw new ProviderRejectedError('This data plan is no longer available. Please refresh.');
    }
    if (plan.priceKobo !== request.amountKobo) {
      throw new ProviderRejectedError('The data plan price changed. Please refresh and try again.');
    }

    const payload = await this.request('POST', '/vend/data', {
      networkId,
      planId,
      phoneNumber: request.phone,
      reference: request.reference,
    });
    return this.purchaseResult(
      payload,
      request.reference,
      `${request.planName} submitted to the supplier for ${request.phone}.`,
    );
  }

  async listDataPlans(): Promise<readonly DataPlan[]> {
    const now = Date.now();
    if (this.planCache && now - this.planCache.at < this.planTtlMs) {
      return this.planCache.plans;
    }
    if (this.plansInFlight) return this.plansInFlight;

    const pending = this.fetchDataPlans().finally(() => {
      this.plansInFlight = null;
    });
    this.plansInFlight = pending;
    return pending;
  }

  private async fetchDataPlans(): Promise<readonly DataPlan[]> {
    const payload = await this.request('GET', '/get/data/plans');
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(asObject(payload)?.data)
        ? (asObject(payload)!.data as unknown[])
        : Array.isArray(asObject(asObject(payload)?.data)?.msg)
          ? (asObject(asObject(payload)!.data)!.msg as unknown[])
          : null;
    if (!list) {
      throw new ProviderTimeoutError('The VTU supplier returned an unexpected data plan catalogue.');
    }

    const seen = new Set<string>();
    const plans = list
      .map(toDataPlan)
      .filter((plan): plan is DataPlan => Boolean(plan))
      .filter((plan) => {
        const key = `${plan.network}:${plan.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => {
        if (a.network !== b.network) {
          return NETWORK_ORDER.indexOf(a.network) - NETWORK_ORDER.indexOf(b.network);
        }
        if (a.priceKobo !== b.priceKobo) return a.priceKobo - b.priceKobo;
        return a.name.localeCompare(b.name);
      });

    this.planCache = { at: Date.now(), plans };
    return plans;
  }

  async verifyMeter(_request: MeterRequest): Promise<MeterVerification> {
    throw new ProviderRejectedError('Ogdams SimHosting does not provide electricity verification.');
  }

  async purchaseElectricity(_request: ElectricityRequest): Promise<ProviderPurchaseResult> {
    throw new ProviderRejectedError('Ogdams SimHosting does not provide electricity payments.');
  }

  async verifyCable(_request: CableVerifyRequest): Promise<CableVerification> {
    throw new ProviderRejectedError('Ogdams SimHosting does not provide cable verification.');
  }

  async purchaseCable(_request: CablePurchaseRequest): Promise<ProviderPurchaseResult> {
    throw new ProviderRejectedError('Ogdams SimHosting does not provide cable subscriptions.');
  }

  async purchaseExam(_request: ExamRequest): Promise<ProviderPurchaseResult> {
    throw new ProviderRejectedError('Ogdams SimHosting does not provide examination vouchers.');
  }

  async getStatus(providerReference: string): Promise<ProviderStatusResult> {
    // The supplier does not publish a status endpoint. Never guess: returning
    // `pending` keeps the debit in place until a human checks the dashboard.
    return {
      state: 'pending',
      providerReference,
      message:
        'Automatic status lookup is not available from this supplier. Contact support if the bundle is not delivered.',
    };
  }
}
