import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type {
  AuthSessionResponse,
  Catalog,
  FundingAttempt,
  LedgerEntry,
  Transaction,
  UserProfile,
  WalletSummary,
} from '@kashahara/shared';
import { getAccessToken, getRefreshToken, loadTokens, saveTokens, clearTokens } from './tokens';

function resolveBaseUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  const url = fromEnv || extra?.apiUrl || `http://${fallbackHost}:4000/api/v1`;
  return url.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { details?: unknown; requestId?: string } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.requestId = options.requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

async function perform<T>(
  path: string,
  options: RequestOptions,
  token: string | null,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 25_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const text = await response.text();
    let payload: any = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const body = payload?.error ?? {};
      throw new ApiError(
        response.status,
        typeof body.code === 'string' ? body.code : 'REQUEST_FAILED',
        typeof body.message === 'string'
          ? body.message
          : `Request failed (${response.status}).`,
        { details: body.details, requestId: body.requestId },
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(
        0,
        'NETWORK_TIMEOUT',
        'The request took too long. Check your connection and try again.',
      );
    }
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Could not reach Kashahara. Check your internet connection and try again.',
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;
      try {
        const session = await perform<AuthSessionResponse>(
          '/auth/refresh',
          {
            method: 'POST',
            body: { refreshToken },
            auth: false,
          },
          null,
        );
        await saveTokens({
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
        });
        return true;
      } catch {
        await clearTokens();
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  await loadTokens();
  const useAuth = options.auth !== false;
  const token = useAuth ? getAccessToken() : null;

  try {
    return await perform<T>(path, options, token);
  } catch (error) {
    if (
      useAuth &&
      error instanceof ApiError &&
      error.status === 401 &&
      error.code === 'UNAUTHORIZED'
    ) {
      const refreshed = await refreshSession();
      if (refreshed) {
        return perform<T>(path, options, getAccessToken());
      }
    }
    throw error;
  }
}

export function newIdempotencyKey(prefix = 'op'): string {
  const random = Math.random().toString(36).slice(2, 12);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export interface MeResponse {
  user: UserProfile;
  wallet: WalletSummary;
}

export interface WalletResponse {
  wallet: WalletSummary;
  ledger: LedgerEntry[];
  reconciliation: {
    walletBalanceKobo: number;
    ledgerBalanceKobo: number;
    matches: boolean;
  };
}

export interface CatalogResponse {
  catalog: Catalog;
  version: string;
  notice: string;
  provider: { name: string; simulated: boolean };
}

export interface PurchaseResponse {
  transaction: Transaction;
  wallet: WalletSummary;
  simulated: boolean;
}

export interface FundingResponse {
  funding: FundingAttempt;
  mode: 'paystack' | 'simulated';
  authorizationUrl: string | null;
  callbackUrl: string | null;
  message: string;
}

export interface FundingStatusResponse {
  funding: FundingAttempt;
  simulated: boolean;
  wallet: WalletSummary;
}

export interface TransactionPageResponse {
  items: Transaction[];
  nextCursor: string | null;
}

export interface SupportFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface MeterVerificationResponse {
  customerName: string;
  customerAddress: string | null;
  meterNumber: string;
  meterType: 'prepaid' | 'postpaid';
  billerId: string;
  isDemo: boolean;
}

export interface CableVerificationResponse {
  customerName: string;
  smartcardNumber: string;
  providerId: string;
  currentPackage: string | null;
  isDemo: boolean;
}

export const authApi = {
  register: (body: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => api<AuthSessionResponse>('/auth/register', { method: 'POST', body, auth: false }),
  login: (body: { identifier: string; password: string }) =>
    api<AuthSessionResponse>('/auth/login', { method: 'POST', body, auth: false }),
  logout: (refreshToken: string) =>
    api<{ message: string }>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    }),
  logoutAll: () => api<{ message: string }>('/auth/logout-all', { method: 'POST' }),
  me: () => api<MeResponse>('/auth/me'),
  updateProfile: (body: { fullName?: string; email?: string; phone?: string }) =>
    api<{ user: UserProfile }>('/auth/me', { method: 'PATCH', body }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api<{ message: string }>('/auth/change-password', { method: 'POST', body }),
  setPin: (body: { password: string; pin: string }) =>
    api<{ user: UserProfile; message: string }>('/auth/transaction-pin', {
      method: 'POST',
      body,
    }),
  forgotPassword: (identifier: string) =>
    api<{ message: string; devToken?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { identifier },
      auth: false,
    }),
  resetPassword: (body: { token: string; newPassword: string }) =>
    api<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body,
      auth: false,
    }),
  requestVerification: (channel: 'email' | 'phone') =>
    api<{ message: string; devCode?: string }>('/auth/verify/request', {
      method: 'POST',
      body: { channel },
    }),
  confirmVerification: (channel: 'email' | 'phone', code: string) =>
    api<{ user: UserProfile; message: string }>('/auth/verify/confirm', {
      method: 'POST',
      body: { channel, code },
    }),
};

export const catalogApi = {
  get: () => api<CatalogResponse>('/catalog', { auth: false }),
};

export const walletApi = {
  get: () => api<WalletResponse>('/wallet'),
  initializeFunding: (
    amountKobo: number,
    callbackUrl?: string | null,
    idempotencyKey?: string,
  ) =>
    api<FundingResponse>('/wallet/funding', {
      method: 'POST',
      body: { amountKobo, ...(callbackUrl ? { callbackUrl } : {}) },
      idempotencyKey: idempotencyKey ?? newIdempotencyKey('fund'),
    }),
  fundingStatus: (reference: string) =>
    api<FundingStatusResponse>(`/wallet/funding/${encodeURIComponent(reference)}`),
  simulateFunding: (reference: string) =>
    api<FundingStatusResponse & { message: string }>(
      `/wallet/funding/${encodeURIComponent(reference)}/simulate`,
      { method: 'POST' },
    ),
};

export const purchasesApi = {
  verifyMeter: (body: {
    billerId: string;
    meterNumber: string;
    meterType: 'prepaid' | 'postpaid';
  }) =>
    api<{ verification: MeterVerificationResponse }>('/purchases/verify-meter', {
      method: 'POST',
      body,
    }),
  verifyCable: (body: { providerId: string; smartcardNumber: string }) =>
    api<{ verification: CableVerificationResponse }>('/purchases/verify-cable', {
      method: 'POST',
      body,
    }),
  airtime: (
    body: {
      network: string;
      phone: string;
      amountKobo: number;
      pin: string;
    },
    idempotencyKey?: string,
  ) =>
    api<PurchaseResponse>('/purchases/airtime', {
      method: 'POST',
      body,
      idempotencyKey: idempotencyKey ?? newIdempotencyKey('airtime'),
    }),
  data: (
    body: { network: string; phone: string; planId: string; pin: string },
    idempotencyKey?: string,
  ) =>
    api<PurchaseResponse>('/purchases/data', {
      method: 'POST',
      body,
      idempotencyKey: idempotencyKey ?? newIdempotencyKey('data'),
    }),
  electricity: (
    body: {
      billerId: string;
      meterNumber: string;
      meterType: 'prepaid' | 'postpaid';
      amountKobo: number;
      pin: string;
    },
    idempotencyKey?: string,
  ) =>
    api<PurchaseResponse>('/purchases/electricity', {
      method: 'POST',
      body,
      idempotencyKey: idempotencyKey ?? newIdempotencyKey('electricity'),
    }),
  cable: (
    body: {
      providerId: string;
      smartcardNumber: string;
      packageId: string;
      pin: string;
    },
    idempotencyKey?: string,
  ) =>
    api<PurchaseResponse>('/purchases/cable', {
      method: 'POST',
      body,
      idempotencyKey: idempotencyKey ?? newIdempotencyKey('cable'),
    }),
  exam: (
    body: { productId: string; quantity: number; pin: string },
    idempotencyKey?: string,
  ) =>
    api<PurchaseResponse>('/purchases/exam', {
      method: 'POST',
      body,
      idempotencyKey: idempotencyKey ?? newIdempotencyKey('exam'),
    }),
};

export const transactionsApi = {
  list: (params: {
    type?: string;
    status?: string;
    limit?: number;
    cursor?: string | null;
  } = {}) => {
    const search = new URLSearchParams();
    if (params.type) search.set('type', params.type);
    if (params.status) search.set('status', params.status);
    if (params.limit) search.set('limit', String(params.limit));
    if (params.cursor) search.set('cursor', params.cursor);
    const query = search.toString();
    return api<TransactionPageResponse>(`/transactions${query ? `?${query}` : ''}`);
  },
  get: (id: string) =>
    api<{ transaction: Transaction; wallet: WalletSummary }>(
      `/transactions/${encodeURIComponent(id)}`,
    ),
  refresh: (id: string) =>
    api<{ transaction: Transaction; wallet: WalletSummary }>(
      `/transactions/${encodeURIComponent(id)}/refresh`,
      { method: 'POST' },
    ),
};

export const supportApi = {
  faq: () => api<{ items: SupportFaqItem[] }>('/support/faq', { auth: false }),
  tickets: () => api<{ items: SupportTicket[] }>('/support/tickets'),
  createTicket: (body: { subject: string; message: string }) =>
    api<{ ticket: SupportTicket }>('/support/tickets', { method: 'POST', body }),
};

export const healthApi = {
  get: () =>
    api<{
      status: string;
      env: string;
      store: string;
      provider: { name: string; simulated: boolean };
      paystackConfigured: boolean;
      simulatedFundingEnabled: boolean;
      catalogVersion: string;
    }>('/health', { auth: false }),
};
