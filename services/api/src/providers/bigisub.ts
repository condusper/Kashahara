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

/**
 * Bigisub network ids differ from the ones used by some other suppliers. These
 * were transposed on 26 October 2026, so never reuse another adapter's map.
 */
const NETWORK_ID: Record<Network, number> = {
  MTN: 1,
  GLO: 2,
  AIRTEL: 3,
  '9MOBILE': 4,
};

const NETWORK_BY_ID: Record<number, Network> = {
  1: 'MTN',
  2: 'GLO',
  3: 'AIRTEL',
  4: '9MOBILE',
};

const NETWORK_ORDER: readonly Network[] = ['MTN', 'GLO', 'AIRTEL', '9MOBILE'];

const PLAN_CACHE_TTL_MS = 5 * 60 * 1000;
const AIRTIME_MIN_KOBO = 2_500;

const SUCCESS_STATUSES = new Set(['successful', 'success', 'completed', 'delivered']);
const FAILED_STATUSES = new Set([
  'failed',
  'declined',
  'reversed',
  'cancelled',
  'canceled',
  'refunded',
]);
const PENDING_STATUSES = new Set(['processing', 'pending', 'queued', 'initiated', 'recorded']);

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

function readBoolean(object: JsonObject | null, key: string): boolean | null {
  if (!object) return null;
  const value = object[key];
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
}

/**
 * Bigisub answers a rejected request with a generic `"message": "Validation
 * failed"` and the reason in `errors`, e.g.
 * `{"non_field_errors": ["Incorrect PIN"]}`. Read those first so the customer
 * is told what actually went wrong instead of "Validation failed".
 */
function readFieldErrors(payload: JsonObject | null): string[] {
  const errors = asObject(payload?.errors);
  if (!errors) return [];
  const messages: string[] = [];
  for (const [field, value] of Object.entries(errors)) {
    const items = Array.isArray(value) ? value : [value];
    for (const item of items) {
      if (typeof item !== 'string' || !item.trim()) continue;
      messages.push(field === 'non_field_errors' ? item.trim() : `${field}: ${item.trim()}`);
    }
  }
  return messages;
}

function readMessage(payload: JsonObject | null): string | null {
  if (!payload) return null;
  const fieldErrors = readFieldErrors(payload);
  if (fieldErrors.length > 0) return fieldErrors.join('; ');
  const data = asObject(payload.data);
  const candidates = [
    readString(payload, 'message'),
    readString(data, 'message'),
    readString(data, 'msg'),
    typeof payload.data === 'string' ? payload.data : null,
  ];
  return candidates.find((value) => Boolean(value)) ?? null;
}

function readStatus(payload: JsonObject | null): string | null {
  if (!payload) return null;
  const data = asObject(payload.data);
  return (readString(data, 'status') ?? readString(payload, 'status'))?.toLowerCase() ?? null;
}

function readProviderReference(payload: JsonObject | null): string | null {
  if (!payload) return null;
  const data = asObject(payload.data);
  return (
    readString(data, 'transaction_id') ??
    readString(data, 'tranx_id') ??
    readString(data, 'reference') ??
    readString(payload, 'transaction_id') ??
    readString(payload, 'tranx_id') ??
    readString(payload, 'reference')
  );
}

function readScalarString(object: JsonObject | null, key: string): string | null {
  if (!object) return null;
  const value = object[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function normalizeAllowance(value: string | null): string | null {
  if (!value) return null;
  const match = value.replace(/\s+/g, '').match(/^(\d+(?:\.\d+)?)(KB|MB|GB|TB)$/i);
  if (!match) return null;
  return `${match[1]}${match[2]!.toUpperCase()}`;
}

function extractAllowance(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)/i);
  if (!match) return null;
  return `${match[1]}${match[2]!.toUpperCase()}`;
}

/**
 * The live catalogue returns `size` as a bare number and `plan_volume` as the
 * unit (`20` + `MB`), while the published examples show `1.5GB` + `1536MB`.
 * Accept both shapes instead of silently dropping every live plan.
 */
function allowanceFor(plan: JsonObject): string | null {
  const size = readScalarString(plan, 'size');
  const volume = readScalarString(plan, 'plan_volume');
  const fromSize = normalizeAllowance(size) ?? extractAllowance(size);
  if (fromSize) return fromSize;
  const unit = volume?.trim().match(/^(KB|MB|GB|TB)$/i);
  if (size && unit && /^\d+(?:\.\d+)?$/.test(size)) {
    return `${size}${unit[1]!.toUpperCase()}`;
  }
  return extractAllowance(volume);
}

function categoryFor(plantype: string | null): DataPlan['category'] {
  const type = (plantype ?? '').toUpperCase();
  if (type.includes('SME')) return 'SME';
  if (type.includes('CGIFT') || type.includes('CORPORATE')) return 'Corporate';
  if (type.includes('GIFT') || type.includes('AWOOF')) return 'Gifting';
  return 'Direct';
}

function labelFor(plantype: string | null): string | null {
  const type = (plantype ?? '').toUpperCase();
  if (!type) return null;
  if (type.startsWith('CGIFT')) return 'Corporate';
  if (type === 'GIFTING') return 'Gifting';
  if (type === 'DATATRANSFER') return 'Data Transfer';
  if (type.startsWith('SME')) return 'SME';
  return type.charAt(0) + type.slice(1).toLowerCase();
}

function toDataPlan(raw: unknown, markupPercent: number): DataPlan | null {
  const plan = asObject(raw);
  if (!plan) return null;
  const planId = readNumber(plan, 'id');
  const networkId = readNumber(plan, 'network');
  const price = readNumber(plan, 'amount');
  if (!planId || !networkId || !price || price <= 0) return null;
  if (readBoolean(plan, 'plan_disabled') === true) return null;
  const network = NETWORK_BY_ID[networkId];
  if (!network) return null;

  const allowance = allowanceFor(plan);
  if (!allowance) return null;

  const plantype = readString(plan, 'plantype');
  const label = labelFor(plantype);
  return {
    id: String(planId),
    network,
    name: label ? `${allowance} ${label}` : allowance,
    allowance,
    validity: readString(plan, 'validity') ?? '—',
    priceKobo: applyMarkup(Math.round(price * 100), markupPercent),
    category: categoryFor(plantype),
    isDemo: false,
  };
}

/**
 * Applies the configured margin to a supplier price and rounds up to the next
 * whole Naira, so the customer-facing catalogue stays clean. A zero markup
 * leaves the supplier price untouched.
 */
function applyMarkup(priceKobo: number, markupPercent: number): number {
  if (markupPercent <= 0) return priceKobo;
  return Math.ceil((priceKobo * (1 + markupPercent / 100)) / 100) * 100;
}

/**
 * Bigisub wallet supplier adapter.
 *
 * Endpoints used:
 *  - `GET  /api/v2/vtu/data/plans/` live catalogue
 *  - `POST /api/v2/vtu/airtime/purchase/`
 *  - `POST /api/v2/vtu/data/purchase/`
 *  - `GET  /api/v2/anubis/transactions/:id/` status lookup
 *
 * Authentication is `Authorization: Token <token>`. Every purchase also needs
 * the account's 4-digit transaction PIN in the body. Bigisub does not send
 * webhooks, so pending orders are reconciled by polling the status endpoint.
 */
export class BigisubVtuProvider implements VtuProvider {
  readonly name = 'bigisub';
  readonly isSimulated = false;

  private readonly baseUrl: string;
  private readonly apiToken: string;
  private readonly pin: string;
  private readonly fetchImpl: typeof fetch;
  private readonly planTtlMs: number;
  private readonly markupPercent: number;

  private planCache: { at: number; plans: readonly DataPlan[] } | null = null;
  private plansInFlight: Promise<readonly DataPlan[]> | null = null;

  constructor(options: {
    baseUrl: string;
    apiToken: string;
    pin: string;
    fetchImpl?: typeof fetch;
    planTtlMs?: number;
    /** Percentage added to supplier data prices. Defaults to 0. */
    markupPercent?: number;
  }) {
    if (!options.baseUrl || !options.apiToken || !options.pin) {
      throw new ProviderNotConfiguredError(
        'BIGISUB_BASE_URL, BIGISUB_API_TOKEN and BIGISUB_TRANSACTION_PIN are required',
      );
    }
    if (!/^\d{4}$/.test(options.pin)) {
      throw new ProviderNotConfiguredError('BIGISUB_TRANSACTION_PIN must be four digits');
    }
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiToken = options.apiToken;
    this.pin = options.pin;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.planTtlMs = options.planTtlMs ?? PLAN_CACHE_TTL_MS;
    this.markupPercent = options.markupPercent ?? 0;
    if (!Number.isFinite(this.markupPercent) || this.markupPercent < 0 || this.markupPercent > 50) {
      throw new ProviderNotConfiguredError('DATA_MARKUP_PERCENT must be between 0 and 50');
    }
  }

  private async request(method: 'GET' | 'POST', path: string, body?: JsonObject): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Token ${this.apiToken}`,
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
    const object = asObject(payload);

    if (response.status === 401 || response.status === 403) {
      throw new ProviderRejectedError(
        readMessage(object) ??
          'The VTU supplier rejected the API token, or this server IP is not whitelisted.',
        { raw: object ?? { httpStatus: response.status } },
      );
    }
    if (response.status === 402) {
      throw new ProviderRejectedError(
        readMessage(object) ?? 'The supplier wallet does not have enough balance for this order.',
        { providerReference: readProviderReference(object), raw: object ?? { httpStatus: 402 } },
      );
    }
    if (response.status === 429) {
      throw new ProviderRejectedError(
        readMessage(object) ?? 'The supplier rate-limited this request. Please try again shortly.',
        { providerReference: readProviderReference(object), raw: object ?? { httpStatus: 429 } },
      );
    }
    if (response.status >= 500) {
      throw new ProviderTimeoutError('The VTU supplier returned a server error.', {
        raw: object ?? { httpStatus: response.status, body: text.slice(0, 500) },
      });
    }
    if (!response.ok) {
      throw new ProviderRejectedError(
        readMessage(object) ?? `The VTU supplier rejected the request (${response.status}).`,
        {
          providerReference: readProviderReference(object),
          raw: object ? { ...object, httpStatus: response.status } : { httpStatus: response.status },
        },
      );
    }
    if (payload === null) {
      throw new ProviderTimeoutError('The VTU supplier returned an unreadable response.');
    }
    return payload;
  }

  private purchaseResult(payload: unknown, fallbackMessage: string): ProviderPurchaseResult {
    const object = asObject(payload);
    if (!object) {
      throw new ProviderTimeoutError('The VTU supplier returned an unexpected response.');
    }
    const message = readMessage(object) ?? fallbackMessage;
    const providerReference = readProviderReference(object);
    const status = readStatus(object);
    const success = object.success === true;

    if (!success && !status) {
      throw new ProviderRejectedError(message, {
        providerReference,
        raw: object,
      });
    }
    if (status && FAILED_STATUSES.has(status)) {
      throw new ProviderRejectedError(message, {
        providerReference,
        raw: object,
      });
    }
    if (status && PENDING_STATUSES.has(status)) {
      throw new ProviderPendingError(message, {
        providerReference,
        raw: object,
      });
    }
    if (success && status && SUCCESS_STATUSES.has(status)) {
      if (!providerReference) {
        throw new ProviderTimeoutError(
          'The supplier accepted the order but returned no transaction reference.',
          { raw: object },
        );
      }
      return {
        providerReference,
        message,
        raw: object,
        simulated: false,
      };
    }
    if (success && !status) {
      // The documented responses always include a status. Treat an unlabelled
      // success as pending rather than guessing that a bundle was delivered.
      throw new ProviderPendingError(message, {
        providerReference,
        raw: object,
      });
    }
    throw new ProviderRejectedError(message, {
      providerReference,
      raw: object,
    });
  }

  async purchaseAirtime(request: AirtimeRequest): Promise<ProviderPurchaseResult> {
    const networkId = networkIdFor(request.network);
    if (!networkId) {
      throw new ProviderRejectedError(`Unsupported network: ${request.network}`);
    }
    if (request.amountKobo < AIRTIME_MIN_KOBO) {
      throw new ProviderRejectedError('Airtime amount must be at least ₦25.');
    }
    if (request.amountKobo % 100 !== 0) {
      throw new ProviderRejectedError('Airtime amount must be a whole Naira amount.');
    }

    const payload = await this.request('POST', '/api/v2/vtu/airtime/purchase/', {
      network: networkId,
      phone_number: request.phone,
      amount: String(request.amountKobo / 100),
      airtime_type: 'vtu',
      pin: this.pin,
    });
    return this.purchaseResult(
      payload,
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

    // Never send a stale price. If the catalogue cannot be refreshed, reject
    // (and refund) instead of keeping an uncertain debit for an order that was
    // never sent.
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

    const payload = await this.request('POST', '/api/v2/vtu/data/purchase/', {
      network: networkId,
      plan: planId,
      phone_number: request.phone,
      pin: this.pin,
    });
    return this.purchaseResult(
      payload,
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
    const payload = await this.request('GET', '/api/v2/vtu/data/plans/');
    const object = asObject(payload);
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(object?.data)
        ? (object!.data as unknown[])
        : null;
    if (!list) {
      throw new ProviderTimeoutError('The VTU supplier returned an unexpected data plan catalogue.');
    }

    const seen = new Set<string>();
    const plans = list
      .map((plan) => toDataPlan(plan, this.markupPercent))
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
    throw new ProviderRejectedError('Bigisub electricity verification is not wired yet.');
  }

  async purchaseElectricity(_request: ElectricityRequest): Promise<ProviderPurchaseResult> {
    throw new ProviderRejectedError('Bigisub electricity payments are not wired yet.');
  }

  async verifyCable(_request: CableVerifyRequest): Promise<CableVerification> {
    throw new ProviderRejectedError('Bigisub cable verification is not wired yet.');
  }

  async purchaseCable(_request: CablePurchaseRequest): Promise<ProviderPurchaseResult> {
    throw new ProviderRejectedError('Bigisub cable subscriptions are not wired yet.');
  }

  async purchaseExam(_request: ExamRequest): Promise<ProviderPurchaseResult> {
    throw new ProviderRejectedError('Bigisub examination vouchers are not wired yet.');
  }

  async getStatus(providerReference: string): Promise<ProviderStatusResult> {
    if (!providerReference) {
      throw new ProviderRejectedError('No supplier transaction reference is available to check.');
    }

    let payload: unknown;
    try {
      payload = await this.request(
        'GET',
        `/api/v2/anubis/transactions/${encodeURIComponent(providerReference)}/`,
      );
    } catch (error) {
      const raw = error instanceof ProviderRejectedError ? error.raw : null;
      if (raw && (raw.httpStatus === 404 || raw.status === '404')) {
        return {
          state: 'pending',
          providerReference,
          message: 'The supplier has no final record for this order yet.',
        };
      }
      throw error;
    }

    const object = asObject(payload);
    let data = asObject(object?.data);
    if (!object || object.success !== true || !data) {
      throw new ProviderRejectedError(
        readMessage(object) ?? 'The supplier could not return this transaction status.',
        { providerReference, raw: object },
      );
    }
    let status = (readString(data, 'status') ?? '').toLowerCase();
    let message =
      readMessage(object) ??
      (status ? `Supplier status: ${status}.` : 'The supplier did not return a status.');

    // The detail endpoint only reads Bigisub's database. A processing order may
    // stay there until an active requery asks the upstream provider. Requery is
    // throttled, so a 429 is treated as "still pending" rather than an error.
    if (!SUCCESS_STATUSES.has(status) && !FAILED_STATUSES.has(status)) {
      try {
        const requeryPayload = await this.request(
          'POST',
          `/api/v2/anubis/transactions/${encodeURIComponent(providerReference)}/requery/`,
        );
        const requery = asObject(requeryPayload);
        const requeryData = asObject(requery?.data);
        if (requery?.success === true && requeryData) {
          data = requeryData;
          status = (readString(requeryData, 'status') ?? status).toLowerCase();
          message = readMessage(requery) ?? message;
        }
      } catch {
        // Keep the polled status. The next reconciliation pass tries again
        // after the supplier's 30-second requery throttle.
      }
    }

    const details = { ...data };

    if (SUCCESS_STATUSES.has(status)) {
      return { state: 'successful', providerReference, message, details };
    }
    if (FAILED_STATUSES.has(status)) {
      return { state: 'failed', providerReference, message, details };
    }
    return { state: 'pending', providerReference, message, details };
  }
}
