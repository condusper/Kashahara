import { Router } from 'express';
import { CATALOG_VERSION } from '@kashahara/shared';
import type { Config } from '../config';
import type { PaystackClient } from '../paystack';
import type { VtuProvider } from '../providers';
import type { Store } from '../types';

export function createHealthRouter(
  store: Store,
  config: Config,
  provider: VtuProvider,
  paystack: PaystackClient,
): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'kashahara-api',
      version: '0.1.0',
      env: config.env,
      time: new Date().toISOString(),
      store: store.kind,
      provider: { name: provider.name, simulated: provider.isSimulated },
      paystackConfigured: paystack.isConfigured,
      paystackMode: paystack.mode,
      simulatedFundingEnabled: config.allowSimulatedPayments && config.env !== 'production',
      catalogVersion: CATALOG_VERSION,
    });
  });

  return router;
}
