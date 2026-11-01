import { Router } from 'express';
import { z } from 'zod';
import type { Config } from '../config';
import { Errors } from '../errors';
import { createRequireAuth, currentUserId } from '../middleware/auth';
import type { PurchaseService } from '../services/purchases';
import type { Store } from '../types';
import {
  parseBody,
  parseQuery,
  transactionStatusSchema,
  transactionTypeSchema,
} from '../validation';

const listQuerySchema = z.object({
  type: transactionTypeSchema.optional(),
  status: transactionStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});

export function createTransactionsRouter(
  purchases: PurchaseService,
  store: Store,
  config: Config,
): Router {
  const router = Router();
  const requireAuth = createRequireAuth(store, config);

  router.get('/', requireAuth, async (req, res, next) => {
    try {
      const query = parseQuery(listQuerySchema, req.query);
      const page = await purchases.listTransactions(currentUserId(res), query);
      res.json(page);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', requireAuth, async (req, res, next) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      if (!id) throw Errors.badRequest('Transaction id is required');
      res.json(await purchases.getTransaction(currentUserId(res), id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/refresh', requireAuth, async (req, res, next) => {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : '';
      if (!id) throw Errors.badRequest('Transaction id is required');
      res.json(await purchases.refreshTransaction(currentUserId(res), id));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
