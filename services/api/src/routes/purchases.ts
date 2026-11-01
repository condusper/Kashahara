import { Router } from 'express';
import { z } from 'zod';
import type { Config } from '../config';
import { createRequireAuth, currentUser } from '../middleware/auth';
import { idempotent } from '../middleware/idempotency';
import type { PurchaseService } from '../services/purchases';
import type { Store } from '../types';
import {
  amountKoboSchema,
  meterTypeSchema,
  networkSchema,
  parseBody,
  pinSchema,
  phoneSchema,
} from '../validation';

const airtimeSchema = z.object({
  network: networkSchema,
  phone: phoneSchema,
  amountKobo: amountKoboSchema,
  pin: pinSchema,
});

const dataSchema = z.object({
  network: networkSchema,
  phone: phoneSchema,
  planId: z.string().trim().min(1).max(80),
  pin: pinSchema,
});

const meterSchema = z.object({
  billerId: z.string().trim().min(1).max(80),
  meterNumber: z.string().trim().regex(/^\d{6,20}$/, 'Enter a valid meter number'),
  meterType: meterTypeSchema,
});

const electricitySchema = meterSchema.extend({
  amountKobo: amountKoboSchema,
  pin: pinSchema,
});

const cableSchema = z.object({
  providerId: z.string().trim().min(1).max(80),
  smartcardNumber: z.string().trim().regex(/^\d{6,20}$/, 'Enter a valid smartcard number'),
});

const cablePurchaseSchema = cableSchema.extend({
  packageId: z.string().trim().min(1).max(80),
  pin: pinSchema,
});

const examSchema = z.object({
  productId: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(5),
  pin: pinSchema,
});

export function createPurchasesRouter(
  purchases: PurchaseService,
  store: Store,
  config: Config,
): Router {
  const router = Router();
  const requireAuth = createRequireAuth(store, config);

  router.post('/verify-meter', requireAuth, async (req, res, next) => {
    try {
      const body = parseBody(meterSchema, req.body);
      res.json({ verification: await purchases.verifyMeter(body) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/verify-cable', requireAuth, async (req, res, next) => {
    try {
      const body = parseBody(cableSchema, req.body);
      res.json({ verification: await purchases.verifyCable(body) });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    '/airtime',
    requireAuth,
    idempotent(store, async (req, res) => {
      const body = parseBody(airtimeSchema, req.body);
      return { status: 201, body: await purchases.purchaseAirtime(currentUser(res), body) };
    }),
  );

  router.post(
    '/data',
    requireAuth,
    idempotent(store, async (req, res) => {
      const body = parseBody(dataSchema, req.body);
      return { status: 201, body: await purchases.purchaseData(currentUser(res), body) };
    }),
  );

  router.post(
    '/electricity',
    requireAuth,
    idempotent(store, async (req, res) => {
      const body = parseBody(electricitySchema, req.body);
      return {
        status: 201,
        body: await purchases.purchaseElectricity(currentUser(res), body),
      };
    }),
  );

  router.post(
    '/cable',
    requireAuth,
    idempotent(store, async (req, res) => {
      const body = parseBody(cablePurchaseSchema, req.body);
      return { status: 201, body: await purchases.purchaseCable(currentUser(res), body) };
    }),
  );

  router.post(
    '/exam',
    requireAuth,
    idempotent(store, async (req, res) => {
      const body = parseBody(examSchema, req.body);
      return { status: 201, body: await purchases.purchaseExam(currentUser(res), body) };
    }),
  );

  return router;
}
