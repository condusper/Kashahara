import { resolve } from 'node:path';
import { Pool } from 'pg';
import { createClient } from 'redis';
import { createApp, createServices } from './app';
import { loadConfig } from './config';
import { poolConfig } from './database';
import { logger } from './logger';
import {
  FallbackRateLimitStore,
  MemoryRateLimitStore,
  RedisRateLimitStore,
  type RateLimitStore,
} from './middleware/rateLimit';
import { createProvider } from './providers';
import { PostgresStore } from './store/postgres';
import { openPersistentMemoryStore } from './store/memory';

const config = loadConfig();
const provider = createProvider(config);

let store;
let pool: Pool | null = null;

if (config.databaseUrl) {
  pool = new Pool(poolConfig(config.databaseUrl, 10));
  store = new PostgresStore(pool);
  logger.info('Using PostgreSQL store');
} else {
  const snapshotPath =
    process.env.MEMORY_STORE_PATH?.trim() ||
    resolve(__dirname, '..', '.data', 'memory-store.json');
  store = openPersistentMemoryStore(snapshotPath);
  logger.warn(
    'DATABASE_URL is not set. Using a file-backed development store. Data survives restarts, but this is not a production database.',
    { path: snapshotPath },
  );
}

let redisClient: ReturnType<typeof createClient> | null = null;
let rateLimitStore: RateLimitStore = new MemoryRateLimitStore();

if (config.redisUrl) {
  redisClient = createClient({ url: config.redisUrl });
  redisClient.on('error', (error: unknown) => {
    logger.error('Redis client error', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
  rateLimitStore = new FallbackRateLimitStore(
    new RedisRateLimitStore(redisClient),
    new MemoryRateLimitStore(),
    (error) => {
      logger.warn('Shared rate limiter unavailable; using in-memory fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
    },
  );
  redisClient
    .connect()
    .then(() => logger.info('Connected to Redis for shared rate limiting'))
    .catch((error: unknown) => {
      logger.error('Redis connection failed; using in-memory rate limiting', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
} else if (config.env === 'production') {
  logger.warn(
    'REDIS_URL is not set. Rate limits are per-instance; set REDIS_URL before running multiple API instances.',
  );
}

if (provider.isSimulated) {
  logger.warn(
    'VTU_PROVIDER=mock. Airtime, data, bills, and exam vouchers are simulated. No real products are delivered.',
  );
}
if (config.allowSimulatedPayments && config.env !== 'production') {
  logger.warn(
    'Simulated wallet funding is enabled. This is development-only and must be disabled before production.',
  );
}
if (config.paystackMode === 'live') {
  logger.warn('Paystack LIVE mode is active. Real cards and real money will be charged.', {
    callbackConfigured: Boolean(config.paystackCallbackUrl),
  });
  if (config.env !== 'production') {
    logger.warn(
      'A live Paystack key is being used outside NODE_ENV=production. Webhooks may not reach this host and developer shortcuts may still be enabled.',
    );
  }
  if (config.allowDevCodes) {
    logger.warn(
      'ALLOW_DEV_CODES=true with a live Paystack key. Turn it off before taking real payments.',
    );
  }
} else if (config.paystackMode === 'test') {
  logger.info('Paystack test mode is active. No real money will be charged.');
} else if (config.paystackMode === 'unknown') {
  logger.warn(
    'PAYSTACK_SECRET_KEY does not start with sk_test_ or sk_live_. Confirm it is a secret key, not a public key.',
  );
}
if (config.paystackMode && !config.paystackCallbackUrl) {
  logger.warn(
    'PAYSTACK_CALLBACK_URL is not set. Paystack will use the callback URL configured in the dashboard, if any.',
  );
}

const services = createServices({ store, config, provider });
const app = createApp({ store, config, provider, services, rateLimitStore });
const server = app.listen(config.port, () => {
  logger.info('Kashahara API listening', {
    port: config.port,
    env: config.env,
    store: store.kind,
    provider: provider.name,
    simulatedProvider: provider.isSimulated,
    paystackConfigured: Boolean(config.paystackSecretKey),
    reconcileIntervalMs: config.purchaseReconcileIntervalMs,
  });
});

let reconcileTimer: NodeJS.Timeout | null = null;
if (config.purchaseReconcileIntervalMs > 0) {
  let running = false;
  reconcileTimer = setInterval(() => {
    if (running) return;
    running = true;
    services.purchases
      .reconcilePendingTransactions()
      .then((result) => {
        if (result.checked > 0) {
          logger.info('Pending purchase reconciliation finished', result);
        }
      })
      .catch((error: unknown) => {
        logger.error('Pending purchase reconciliation failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        running = false;
      });
  }, config.purchaseReconcileIntervalMs);
  reconcileTimer.unref();
}

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  if (reconcileTimer) clearInterval(reconcileTimer);
  logger.info('Shutting down', { signal });
  server.close(async (error) => {
    if (error) logger.error('HTTP server close failed', { error: error.message });
    if (redisClient) await redisClient.close().catch(() => undefined);
    if (pool) await pool.end().catch(() => undefined);
    process.exit(error ? 1 : 0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
  });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});
