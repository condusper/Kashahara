import { Router } from 'express';
import { z } from 'zod';
import type { FundingAttempt } from '@kashahara/shared';
import { Errors } from '../errors';
import type { Config } from '../config';
import { createRequireAuth, currentUser, currentUserId } from '../middleware/auth';
import { idempotent } from '../middleware/idempotency';
import type { WalletService } from '../services/wallet';
import type { FundingRecord, Store } from '../types';
import { fundingAmountKoboSchema, parseBody, parseQuery } from '../validation';

const fundingSchema = z.object({
  amountKobo: fundingAmountKoboSchema,
  /** Optional deep link the app can handle after checkout. */
  callbackUrl: z.string().trim().max(2048).optional(),
});

const ledgerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export function toFundingAttempt(record: FundingRecord): FundingAttempt {
  const callbackUrl =
    typeof record.metadata.callbackUrl === 'string' ? record.metadata.callbackUrl : null;
  return {
    id: record.id,
    reference: record.reference,
    amountKobo: record.amountKobo,
    status: record.status,
    provider: record.provider,
    providerReference: record.providerReference,
    authorizationUrl: record.authorizationUrl,
    callbackUrl,
    simulated: record.simulated,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    completedAt: record.completedAt ? record.completedAt.toISOString() : null,
  };
}

export function createWalletRouter(
  wallet: WalletService,
  store: Store,
  config: Config,
): Router {
  const router = Router();
  const requireAuth = createRequireAuth(store, config);

  router.get('/', requireAuth, async (_req, res, next) => {
    try {
      const userId = currentUserId(res);
      // Settle any payment Paystack already confirmed before loading the
      // wallet, so a customer who paid but closed the checkout is still
      // credited the next time they open the wallet.
      await wallet.reconcilePendingFundings(userId);
      const [summary, ledger, reconciliation] = await Promise.all([
        wallet.getWallet(userId),
        wallet.getLedger(userId),
        wallet.reconcile(userId),
      ]);
      res.json({ wallet: summary, ledger, reconciliation });
    } catch (error) {
      next(error);
    }
  });

  router.get('/ledger', requireAuth, async (req, res, next) => {
    try {
      const query = parseQuery(ledgerQuerySchema, req.query);
      res.json({ items: await wallet.getLedger(currentUserId(res), query.limit) });
    } catch (error) {
      next(error);
    }
  });

  router.get('/reconciliation', requireAuth, async (_req, res, next) => {
    try {
      res.json(await wallet.reconcile(currentUserId(res)));
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/funding',
    requireAuth,
    idempotent(store, async (req, res) => {
      const body = parseBody(fundingSchema, req.body);
      const user = currentUser(res);
      const result = await wallet.initializeFunding(
        user.id,
        body.amountKobo,
        user.email,
        body.callbackUrl ?? null,
      );
      return {
        status: 201,
        body: {
          funding: toFundingAttempt(result.funding),
          mode: result.mode,
          authorizationUrl: result.authorizationUrl,
          callbackUrl: result.callbackUrl,
          message: result.message,
        },
      };
    }),
  );

  router.get('/funding/:reference', requireAuth, async (req, res, next) => {
    try {
      const reference =
        typeof req.params.reference === 'string' ? req.params.reference : '';
      if (!reference) throw Errors.badRequest('Funding reference is required');
      const result = await wallet.getFundingStatus(currentUserId(res), reference);
      res.json({
        funding: toFundingAttempt(result.funding),
        simulated: result.simulated,
        wallet: result.wallet,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/funding/:reference/simulate', requireAuth, async (req, res, next) => {
    try {
      const reference =
        typeof req.params.reference === 'string' ? req.params.reference : '';
      if (!reference) throw Errors.badRequest('Funding reference is required');
      const result = await wallet.simulateFunding(currentUserId(res), reference);
      res.json({
        funding: toFundingAttempt(result.funding),
        wallet: result.wallet,
        simulated: true,
        message: 'Payment confirmed. Your wallet has been credited.',
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
