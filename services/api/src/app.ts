import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express } from 'express';
import type { Config } from './config';
import { createRequireAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error';
import {
  MemoryRateLimitStore,
  rateLimit,
  type RateLimitStore,
} from './middleware/rateLimit';
import { PaystackClient } from './paystack';
import type { VtuProvider } from './providers';
import { AuthService } from './services/auth';
import { CatalogService } from './services/catalog';
import { PurchaseService } from './services/purchases';
import { WalletService } from './services/wallet';
import type { Store } from './types';
import { createAuthRouter } from './routes/auth';
import { createCatalogRouter } from './routes/catalog';
import { createHealthRouter } from './routes/health';
import { createPurchasesRouter } from './routes/purchases';
import { createSupportRouter } from './routes/support';
import { createTransactionsRouter } from './routes/transactions';
import { createWalletRouter } from './routes/wallet';
import { createWebhookRouter } from './routes/webhooks';

export interface AppDependencies {
  store: Store;
  config: Config;
  provider: VtuProvider;
  paystack?: PaystackClient;
  services?: AppServices;
  now?: () => Date;
  rateLimitStore?: RateLimitStore;
}

export interface AppServices {
  auth: AuthService;
  wallet: WalletService;
  catalog: CatalogService;
  purchases: PurchaseService;
  paystack: PaystackClient;
}

export function createServices(deps: AppDependencies): AppServices {
  const paystack =
    deps.paystack ??
    new PaystackClient({
      secretKey: deps.config.paystackSecretKey,
      baseUrl: deps.config.paystackBaseUrl,
    });
  const now = deps.now ?? (() => new Date());
  const auth = new AuthService(deps.store, deps.config, now);
  const wallet = new WalletService(deps.store, deps.config, paystack, now);
  const catalog = new CatalogService(deps.provider, {
    percent: deps.config.airtimeFeePercent,
    minKobo: deps.config.airtimeFeeMinKobo,
  });
  const purchases = new PurchaseService(
    deps.store,
    deps.config,
    deps.provider,
    catalog,
    auth,
    wallet,
    now,
  );
  return { auth, wallet, catalog, purchases, paystack };
}

export function createApp(deps: AppDependencies): Express {
  const { store, config, provider } = deps;
  const services = deps.services ?? createServices(deps);
  const rateLimitStore = deps.rateLimitStore ?? new MemoryRateLimitStore();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    const supplied = req.get('x-request-id');
    const requestId =
      supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : randomUUID();
    req.requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: false,
      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'Idempotency-Key',
        'X-Request-Id',
        'X-Paystack-Signature',
      ],
      exposedHeaders: ['X-Request-Id', 'Idempotent-Replay', 'Retry-After'],
    }),
  );

  app.use(
    express.json({
      limit: '1mb',
      verify(req, _res, buffer) {
        (req as express.Request).rawBody = Buffer.from(buffer);
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));

  // Paystack retries non-2xx responses. Keep the webhook out of the global
  // request limiter so a burst of legitimate retries is not rejected.
  app.use(
    '/api/v1/webhooks',
    createWebhookRouter(services.wallet, services.paystack, services.purchases, config),
  );

  // Health checks are deliberately mounted before the global limiter: Render
  // probes them frequently and they must never be throttled.
  const health = createHealthRouter(store, config, provider, services.paystack);
  app.use('/health', health);
  app.use('/api/v1/health', health);

  app.use(
    '/api/v1',
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMaxRequests,
      message: 'Too many requests. Please slow down and try again shortly.',
      prefix: 'global',
      store: rateLimitStore,
    }),
  );

  app.use(
    '/api/v1/auth',
    createAuthRouter(services.auth, store, config, rateLimitStore),
  );
  app.use('/api/v1/catalog', createCatalogRouter(services.catalog, provider));
  app.use('/api/v1/wallet', createWalletRouter(services.wallet, store, config));
  app.use(
    '/api/v1/purchases',
    createPurchasesRouter(services.purchases, store, config),
  );
  app.use(
    '/api/v1/transactions',
    createTransactionsRouter(services.purchases, store, config),
  );
  app.use('/api/v1/support', createSupportRouter(store, config));

  // A tiny protected probe useful for mobile connectivity checks.
  app.get('/api/v1/ping', createRequireAuth(store, config), (req, res) => {
    res.json({ ok: true, requestId: req.requestId });
  });

  app.use(notFoundHandler());
  app.use(errorHandler);

  return app;
}
