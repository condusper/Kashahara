import { constantTimeEqualString, hmacSha512Hex } from './crypto';

export type PaystackMode = 'test' | 'live' | 'unknown' | null;

/** The custom scheme declared by the mobile app in `app.config.js`. */
export const APP_CALLBACK_SCHEME = 'kashahara:';

/**
 * Paystack redirects the checkout to `callback_url` after a successful
 * payment. We accept https links and the app's own deep-link scheme in every
 * environment, plus Expo Go's `exp://` scheme during development so the flow
 * can be tested without a custom build.
 */
export function isAllowedCallbackUrl(
  value: string,
  options: { allowExpo?: boolean; allowHttp?: boolean } = {},
): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:') return true;
    if (url.protocol === APP_CALLBACK_SCHEME) return true;
    if (options.allowHttp && url.protocol === 'http:') return true;
    if (options.allowExpo && (url.protocol === 'exp:' || url.protocol === 'exps:')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Builds the per-transaction callback URL. A `{reference}` placeholder is
 * replaced when present; otherwise the reference is appended as a path segment
 * (or as a query parameter when the base already has a query string).
 */
export function buildPaystackCallbackUrl(
  base: string | null | undefined,
  reference: string,
): string | null {
  if (!base) return null;
  const encoded = encodeURIComponent(reference);
  if (base.includes('{reference}')) {
    return base.split('{reference}').join(encoded);
  }

  const hashIndex = base.indexOf('#');
  const hash = hashIndex >= 0 ? base.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? base.slice(0, hashIndex) : base;
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex >= 0) {
    return `${withoutHash}&reference=${encoded}${hash}`;
  }
  return `${withoutHash.replace(/\/$/, '')}/${encoded}${hash}`;
}


/**
 * Paystack secret keys are prefixed with `sk_test_` or `sk_live_`. The mode is
 * derived from the key itself so a live key can never be mistaken for a test
 * key in a stale config file.
 */
export function paystackKeyMode(secretKey: string | null): PaystackMode {
  if (!secretKey) return null;
  if (secretKey.startsWith('sk_live_')) return 'live';
  if (secretKey.startsWith('sk_test_')) return 'test';
  return 'unknown';
}

export class PaystackError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly providerCode: string | null;

  constructor(
    message: string,
    options: { status?: number | null; code?: string; providerCode?: string | null } = {},
  ) {
    super(message);
    this.name = 'PaystackError';
    this.status = options.status ?? null;
    this.code = options.code ?? 'PAYSTACK_ERROR';
    this.providerCode = options.providerCode ?? null;
  }
}

export class PaystackNotConfiguredError extends PaystackError {
  constructor() {
    super('Paystack is not configured on this server', { code: 'PAYSTACK_NOT_CONFIGURED' });
    this.name = 'PaystackNotConfiguredError';
  }
}

export interface PaystackInitializeInput {
  email: string;
  amountKobo: number;
  reference: string;
  /** Optional. Paystack falls back to the dashboard callback URL when omitted. */
  callbackUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PaystackBalance {
  currency: string;
  balance: number;
}

export interface PaystackInitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  raw: Record<string, unknown>;
}

export interface PaystackVerifyResult {
  state: 'successful' | 'failed' | 'abandoned' | 'pending';
  reference: string;
  amountKobo: number;
  currency: string;
  gatewayResponse: string | null;
  paidAt: string | null;
  raw: Record<string, unknown>;
}

type JsonObject = Record<string, unknown>;

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

export class PaystackClient {
  private readonly secretKey: string | null;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: {
    secretKey: string | null;
    baseUrl: string;
    fetchImpl?: typeof fetch;
  }) {
    this.secretKey = options.secretKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  get isConfigured(): boolean {
    return Boolean(this.secretKey);
  }

  get mode(): PaystackMode {
    return paystackKeyMode(this.secretKey);
  }

  get isLive(): boolean {
    return this.mode === 'live';
  }

  private requireKey(): string {
    if (!this.secretKey) throw new PaystackNotConfiguredError();
    return this.secretKey;
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: JsonObject,
  ): Promise<JsonObject> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.requireKey()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      throw new PaystackError('Could not reach Paystack. Please try again.', {
        code: 'PAYSTACK_NETWORK_ERROR',
      });
    }

    const text = await response.text();
    let payload: JsonObject | null = null;
    try {
      payload = text ? (JSON.parse(text) as JsonObject) : null;
    } catch {
      payload = null;
    }

    if (!response.ok || payload?.status !== true) {
      const providerCode = readString(payload, 'code');
      throw new PaystackError(
        readString(payload, 'message') ?? `Paystack request failed (${response.status})`,
        {
          status: response.status,
          code: 'PAYSTACK_REQUEST_FAILED',
          providerCode,
        },
      );
    }
    return payload;
  }

  async initialize(input: PaystackInitializeInput): Promise<PaystackInitializeResult> {
    const body: JsonObject = {
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      currency: 'NGN',
      metadata: input.metadata ?? {},
    };
    if (input.callbackUrl) body.callback_url = input.callbackUrl;

    const payload = await this.request('POST', '/transaction/initialize', body);
    const data = asObject(payload.data);
    const authorizationUrl = readString(data, 'authorization_url');
    const accessCode = readString(data, 'access_code');
    const reference = readString(data, 'reference') ?? input.reference;
    if (!authorizationUrl || !accessCode) {
      throw new PaystackError('Paystack did not return a checkout URL', {
        code: 'PAYSTACK_INVALID_RESPONSE',
      });
    }
    return { authorizationUrl, accessCode, reference, raw: payload };
  }

  async verify(reference: string): Promise<PaystackVerifyResult> {
    const payload = await this.request(
      'GET',
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    const data = asObject(payload.data);
    const rawStatus = readString(data, 'status')?.toLowerCase();
    const state =
      rawStatus === 'success'
        ? 'successful'
        : rawStatus === 'failed' || rawStatus === 'reversed'
          ? 'failed'
          : rawStatus === 'abandoned'
            ? 'abandoned'
            : 'pending';
    return {
      state,
      reference: readString(data, 'reference') ?? reference,
      amountKobo: readNumber(data, 'amount') ?? 0,
      currency: readString(data, 'currency') ?? '',
      gatewayResponse: readString(data, 'gateway_response'),
      paidAt: readString(data, 'paid_at'),
      raw: payload,
    };
  }

  /**
   * Returns the settlement balances for the account. Useful as a safe,
   * read-only check that a pasted key is valid before taking real payments.
   */
  async getBalances(): Promise<PaystackBalance[]> {
    const payload = await this.request('GET', '/balance');
    const data = payload.data;
    if (!Array.isArray(data)) return [];
    return data.flatMap((item) => {
      const entry = asObject(item);
      const currency = readString(entry, 'currency');
      const balance = readNumber(entry, 'balance');
      if (!currency || balance === null) return [];
      return [{ currency, balance }];
    });
  }

  /**
   * Paystack signs the raw request body with HMAC SHA512 using the secret key.
   * The raw body must be captured before JSON parsing.
   */
  verifySignature(rawBody: string | Buffer, signature: string | undefined): boolean {
    if (!this.secretKey || !signature) return false;
    const expected = hmacSha512Hex(this.secretKey, rawBody);
    return constantTimeEqualString(signature, expected);
  }
}
