import { createHmac, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import type { Request } from 'express';
import type { Config } from '../config';
import { Errors } from '../errors';
import { logger } from '../logger';
import type { PaystackClient } from '../paystack';
import type { PurchaseService } from '../services/purchases';
import type { WalletService } from '../services/wallet';

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

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Ogdams signs the raw webhook body with HMAC-SHA512 using the API secret and
 * sends the digest in `ogdams-simhosting-signature`. Accept a `sha512=` prefix
 * and either hex or base64 encoding because the exact header encoding is not
 * documented.
 */
function verifyOgdamsSignature(rawBody: Buffer, header: string | undefined, secret: string): boolean {
  if (!header) return false;
  const provided = header.trim().replace(/^sha512=/i, '');
  const digest = createHmac('sha512', secret).update(rawBody).digest();
  return (
    safeEqual(provided.toLowerCase(), digest.toString('hex')) ||
    safeEqual(provided, digest.toString('base64'))
  );
}

export function createWebhookRouter(
  wallet: WalletService,
  paystack: PaystackClient,
  purchases: PurchaseService,
  config: Config,
): Router {
  const router = Router();

  router.post('/paystack', async (req: Request, res, next) => {
    try {
      if (!paystack.isConfigured) {
        throw Errors.providerUnavailable('Paystack is not configured on this server');
      }
      const signature = req.get('x-paystack-signature');
      const rawBody = req.rawBody;
      if (!rawBody || !paystack.verifySignature(rawBody, signature)) {
        logger.warn('Rejected Paystack webhook with invalid signature', {
          requestId: req.requestId,
        });
        throw Errors.unauthorized('Invalid webhook signature');
      }

      let payload: JsonObject | null = null;
      try {
        payload = JSON.parse(rawBody.toString('utf8')) as JsonObject;
      } catch {
        payload = null;
      }
      const event = readString(payload, 'event');
      const data = asObject(payload?.data);
      if (!event || !data) {
        res.status(200).json({ received: true, processed: false, reason: 'invalid_payload' });
        return;
      }

      const result = await wallet.handlePaystackWebhook(event, data);
      logger.info('Paystack webhook handled', {
        event,
        reference: data.reference ?? null,
        processed: result.processed,
        reason: result.reason ?? null,
      });
      res.status(200).json({ received: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/ogdams', async (req: Request, res, next) => {
    try {
      if (!config.ogdamsApiKey) {
        throw Errors.providerUnavailable('Ogdams is not configured on this server');
      }
      const rawBody = req.rawBody;
      const signature = req.get('ogdams-simhosting-signature');
      if (!rawBody || !verifyOgdamsSignature(rawBody, signature, config.ogdamsApiKey)) {
        logger.warn('Rejected Ogdams webhook with invalid signature', {
          requestId: req.requestId,
        });
        throw Errors.unauthorized('Invalid webhook signature');
      }

      let payload: JsonObject | null = null;
      try {
        payload = JSON.parse(rawBody.toString('utf8')) as JsonObject;
      } catch {
        payload = null;
      }
      if (!payload) {
        res.status(200).json({ received: true, processed: false, reason: 'invalid_payload' });
        return;
      }

      const result = await purchases.handleProviderWebhook('ogdams', payload);
      logger.info('Ogdams webhook handled', {
        reference: result.reference,
        outcome: result.outcome,
        processed: result.processed,
        reason: result.reason ?? null,
      });
      res.status(200).json({ received: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
