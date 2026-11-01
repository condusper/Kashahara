import dotenv from 'dotenv';
import { DEFAULT_AIRTIME_FEE } from '@kashahara/shared';
import { APP_CALLBACK_SCHEME, paystackKeyMode, type PaystackMode } from './paystack';

dotenv.config({ quiet: true });

export type AppEnv = 'development' | 'test' | 'production';

export interface Config {
  env: AppEnv;
  port: number;
  appUrl: string;
  corsOrigins: string[];
  databaseUrl: string | null;
  /** Shared rate-limit store; required for more than one API instance. */
  redisUrl: string | null;
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  paystackSecretKey: string | null;
  paystackPublicKey: string | null;
  paystackBaseUrl: string;
  paystackCallbackUrl: string | null;
  /** `test` and `live` are derived from the secret key prefix. */
  paystackMode: PaystackMode;
  vtuProvider: 'mock' | 'http' | 'ogdams' | 'bigisub';
  vtuBaseUrl: string | null;
  vtuApiKey: string | null;
  /** Ogdams SimHosting live/sandbox credentials. */
  ogdamsBaseUrl: string;
  ogdamsApiKey: string | null;
  /** Ogdams airtime product channel (VTU, SME, CG, MOMO, ...). */
  ogdamsAirtimeType: string;
  /** Bigisub wallet supplier credentials. */
  bigisubBaseUrl: string;
  bigisubApiToken: string | null;
  /** 4-digit transaction PIN sent with every Bigisub purchase. */
  bigisubTransactionPin: string | null;
  /** Customer-facing data markup, in percent, applied to live supplier prices. */
  dataMarkupPercent: number;
  /** Customer-facing airtime service fee, in percent of face value. */
  airtimeFeePercent: number;
  /** Minimum airtime service fee in kobo. */
  airtimeFeeMinKobo: number;
  /** How often to poll pending supplier orders. 0 disables the job. */
  purchaseReconcileIntervalMs: number;
  allowSimulatedPayments: boolean;
  allowDevCodes: boolean;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  authRateLimitMaxAttempts: number;
}

function readString(env: NodeJS.ProcessEnv, key: string): string | null {
  const value = env[key]?.trim();
  return value ? value : null;
}

function readInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = readString(env, key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return parsed;
}

function readBoolean(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = readString(env, key);
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function readNonNegativeInt(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = readString(env, key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative integer`);
  }
  return parsed;
}

function readPercent(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = readString(env, key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 50) {
    throw new Error(`${key} must be between 0 and 50`);
  }
  return parsed;
}

function parseEnv(value: string | undefined): AppEnv {
  if (value === 'production' || value === 'test' || value === 'development') {
    return value;
  }
  return 'development';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const appEnv = parseEnv(env.NODE_ENV);
  const jwtSecret = readString(env, 'JWT_SECRET');
  const paystackSecretKey = readString(env, 'PAYSTACK_SECRET_KEY');
  const paystackMode = paystackKeyMode(paystackSecretKey);
  const paystackCallbackUrl = readString(env, 'PAYSTACK_CALLBACK_URL');
  const rawVtuProvider = readString(env, 'VTU_PROVIDER');
  const effectiveVtuProvider: Config['vtuProvider'] =
    rawVtuProvider === 'http' || rawVtuProvider === 'ogdams' || rawVtuProvider === 'bigisub'
      ? rawVtuProvider
      : 'mock';

  if (appEnv === 'production') {
    // Report every missing guardrail at once so a failed deploy does not have
    // to be repeated once per variable.
    const problems: string[] = [];

    if (!jwtSecret || jwtSecret.length < 32) {
      problems.push('JWT_SECRET must be at least 32 characters in production');
    }
    if (!readString(env, 'DATABASE_URL')) {
      problems.push('DATABASE_URL is required in production');
    }
    if (readBoolean(env, 'ALLOW_SIMULATED_PAYMENTS', false)) {
      problems.push('ALLOW_SIMULATED_PAYMENTS must be false in production');
    }
    if (!paystackSecretKey) {
      problems.push('PAYSTACK_SECRET_KEY is required in production');
    }
    if (
      paystackCallbackUrl &&
      !paystackCallbackUrl.startsWith('https://') &&
      !paystackCallbackUrl.startsWith(APP_CALLBACK_SCHEME)
    ) {
      problems.push(
        'PAYSTACK_CALLBACK_URL must be an https URL or the kashahara:// app deep link in production',
      );
    }
    if (effectiveVtuProvider === 'mock' && paystackMode === 'live') {
      // Unset and "mock" both fall back to the simulator. A live Paystack key
      // must never charge real money for products that are never delivered.
      problems.push(
        rawVtuProvider === 'mock'
          ? 'VTU_PROVIDER must not be mock in production with a live Paystack key'
          : 'VTU_PROVIDER must be bigisub, http, or ogdams in production with a live Paystack key',
      );
    }
    if (effectiveVtuProvider === 'bigisub') {
      if (!readString(env, 'BIGISUB_API_TOKEN')) {
        problems.push('BIGISUB_API_TOKEN is required when VTU_PROVIDER=bigisub');
      }
      const pin = readString(env, 'BIGISUB_TRANSACTION_PIN');
      if (!pin || !/^\d{4}$/.test(pin)) {
        problems.push(
          'BIGISUB_TRANSACTION_PIN must be four digits when VTU_PROVIDER=bigisub',
        );
      }
    }
    if (rawVtuProvider === 'http') {
      if (!readString(env, 'VTU_BASE_URL') || !readString(env, 'VTU_API_KEY')) {
        problems.push('VTU_BASE_URL and VTU_API_KEY are required when VTU_PROVIDER=http');
      }
    }
    if (rawVtuProvider === 'ogdams' && !readString(env, 'OGDAMS_API_KEY')) {
      problems.push('OGDAMS_API_KEY is required when VTU_PROVIDER=ogdams');
    }

    if (problems.length > 0) {
      throw new Error(
        `Invalid production configuration:\n- ${problems.join('\n- ')}`,
      );
    }
  }

  const vtuProvider = effectiveVtuProvider;
  if (vtuProvider === 'http') {
    if (!readString(env, 'VTU_BASE_URL') || !readString(env, 'VTU_API_KEY')) {
      throw new Error('VTU_BASE_URL and VTU_API_KEY are required when VTU_PROVIDER=http');
    }
  }
  if (vtuProvider === 'ogdams' && !readString(env, 'OGDAMS_API_KEY')) {
    throw new Error('OGDAMS_API_KEY is required when VTU_PROVIDER=ogdams');
  }
  if (vtuProvider === 'bigisub') {
    if (!readString(env, 'BIGISUB_API_TOKEN')) {
      throw new Error('BIGISUB_API_TOKEN is required when VTU_PROVIDER=bigisub');
    }
    const pin = readString(env, 'BIGISUB_TRANSACTION_PIN');
    if (!pin || !/^\d{4}$/.test(pin)) {
      throw new Error('BIGISUB_TRANSACTION_PIN must be four digits when VTU_PROVIDER=bigisub');
    }
  }

  const corsOrigins = (readString(env, 'CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // A live key moves real money. Never let the development simulator run
  // alongside it, even if the environment variable says otherwise.
  const allowSimulatedPayments =
    readBoolean(env, 'ALLOW_SIMULATED_PAYMENTS', appEnv !== 'production') &&
    paystackMode !== 'live';

  return {
    env: appEnv,
    port: readInt(env, 'PORT', 4000),
    appUrl:
      readString(env, 'APP_URL') ??
      readString(env, 'RENDER_EXTERNAL_URL') ??
      'http://localhost:4000',
    corsOrigins:
      corsOrigins.length > 0
        ? corsOrigins
        : ['http://localhost:8081', 'http://localhost:19006'],
    databaseUrl: readString(env, 'DATABASE_URL'),
    redisUrl: readString(env, 'REDIS_URL'),
    jwtSecret:
      jwtSecret ??
      'development-only-secret-change-me-before-deploying-anywhere',
    accessTokenTtlSeconds: readInt(env, 'ACCESS_TOKEN_TTL_SECONDS', 900),
    refreshTokenTtlDays: readInt(env, 'REFRESH_TOKEN_TTL_DAYS', 30),
    paystackSecretKey,
    paystackPublicKey: readString(env, 'PAYSTACK_PUBLIC_KEY'),
    paystackBaseUrl: readString(env, 'PAYSTACK_BASE_URL') ?? 'https://api.paystack.co',
    paystackCallbackUrl,
    paystackMode,
    vtuProvider,
    vtuBaseUrl: readString(env, 'VTU_BASE_URL'),
    vtuApiKey: readString(env, 'VTU_API_KEY'),
    ogdamsBaseUrl:
      readString(env, 'OGDAMS_BASE_URL') ?? 'https://simhosting.ogdams.ng/api/v1',
    ogdamsApiKey: readString(env, 'OGDAMS_API_KEY'),
    ogdamsAirtimeType: readString(env, 'OGDAMS_AIRTIME_TYPE') ?? 'vtu',
    bigisubBaseUrl: readString(env, 'BIGISUB_BASE_URL') ?? 'https://api.bigisub.ng',
    bigisubApiToken: readString(env, 'BIGISUB_API_TOKEN'),
    bigisubTransactionPin: readString(env, 'BIGISUB_TRANSACTION_PIN'),
    dataMarkupPercent: readPercent(env, 'DATA_MARKUP_PERCENT', 3),
    airtimeFeePercent: readPercent(
      env,
      'AIRTIME_FEE_PERCENT',
      DEFAULT_AIRTIME_FEE.percent,
    ),
    airtimeFeeMinKobo: readNonNegativeInt(
      env,
      'AIRTIME_FEE_MIN_KOBO',
      DEFAULT_AIRTIME_FEE.minKobo,
    ),
    purchaseReconcileIntervalMs: readNonNegativeInt(
      env,
      'PURCHASE_RECONCILE_INTERVAL_MS',
      60_000,
    ),
    allowSimulatedPayments,
    allowDevCodes: readBoolean(env, 'ALLOW_DEV_CODES', appEnv !== 'production'),
    rateLimitWindowMs: readInt(env, 'RATE_LIMIT_WINDOW_MS', 60_000),
    rateLimitMaxRequests: readInt(env, 'RATE_LIMIT_MAX_REQUESTS', 120),
    authRateLimitMaxAttempts: readInt(env, 'AUTH_RATE_LIMIT_MAX_ATTEMPTS', 10),
  };
}
