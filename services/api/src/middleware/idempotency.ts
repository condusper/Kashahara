import type { Request, RequestHandler, Response } from 'express';
import { AppError, Errors, isAppError } from '../errors';
import { newId, sha256Hex } from '../crypto';
import type { IdempotencyRecord, Store } from '../types';

export interface IdempotentResponse {
  status: number;
  body: unknown;
}

const STALE_IN_PROGRESS_MS = 2 * 60 * 1000;

function readKey(req: Request): string {
  const key = req.get('Idempotency-Key');
  if (!key) {
    throw Errors.badRequest(
      'Idempotency-Key header is required for this request. Use a unique value and retry with the same value.',
    );
  }
  if (key.length < 8 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw Errors.badRequest(
      'Idempotency-Key must be 8–128 characters using letters, numbers, dot, underscore, colon, or hyphen.',
    );
  }
  return key;
}

function requestHash(req: Request): string {
  return sha256Hex(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body ?? null)}`);
}

function replay(res: Response, record: IdempotencyRecord): void {
  res.setHeader('Idempotent-Replay', 'true');
  res.status(record.responseStatus ?? 200).json(record.responseBody);
}

/**
 * Executes a handler at most once for a given user + Idempotency-Key.
 *
 * The key is reserved atomically before the handler runs, so two concurrent
 * requests cannot both debit a wallet. A completed request is replayed with its
 * original status and body. An in-flight request returns 409. Validation/client
 * errors clear the key so the user can correct the input. Server errors keep a
 * completed 5xx record so a blind retry cannot repeat a potentially billable
 * operation; reconcile before clearing it manually.
 */
export async function withIdempotency(
  req: Request,
  res: Response,
  store: Store,
  handler: () => Promise<IdempotentResponse>,
): Promise<void> {
  const userId = res.locals.userId as string | undefined;
  if (!userId) throw Errors.unauthorized();

  const key = readKey(req);
  const hash = requestHash(req);
  const now = new Date();

  let existing = await store.getIdempotency(userId, key);
  if (existing) {
    if (existing.requestHash !== hash) {
      throw Errors.conflict(
        'This Idempotency-Key was already used with different request data.',
      );
    }
    if (existing.status === 'completed') {
      replay(res, existing);
      return;
    }
    const ageMs = now.getTime() - existing.updatedAt.getTime();
    if (ageMs < STALE_IN_PROGRESS_MS) {
      throw new AppError(
        409,
        'REQUEST_IN_PROGRESS',
        'A request with this Idempotency-Key is already being processed.',
      );
    }
    // A stale in-flight record can be retried only because no response was
    // recorded. Delete it first, then reserve the key atomically again.
    await store.deleteIdempotency(existing.id);
    existing = null;
  }

  const record: IdempotencyRecord = {
    id: newId(),
    userId,
    key,
    requestHash: hash,
    status: 'in_progress',
    responseStatus: null,
    responseBody: null,
    createdAt: now,
    updatedAt: now,
  };
  const claimed = await store.claimIdempotency(record);
  if (!claimed) {
    const winner = await store.getIdempotency(userId, key);
    if (winner?.status === 'completed' && winner.requestHash === hash) {
      replay(res, winner);
      return;
    }
    throw new AppError(
      409,
      'REQUEST_IN_PROGRESS',
      'A request with this Idempotency-Key is already being processed.',
    );
  }

  try {
    const result = await handler();
    await store.putIdempotency({
      ...record,
      status: 'completed',
      responseStatus: result.status,
      responseBody: result.body,
      updatedAt: new Date(),
    });
    res.status(result.status).json(result.body);
  } catch (error) {
    if (isAppError(error) && error.status < 500) {
      await store.deleteIdempotency(record.id);
    } else {
      const status = isAppError(error) ? error.status : 500;
      const body = isAppError(error)
        ? { error: { code: error.code, message: error.message } }
        : { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } };
      await store.putIdempotency({
        ...record,
        status: 'completed',
        responseStatus: status,
        responseBody: body,
        updatedAt: new Date(),
      });
    }
    throw error;
  }
}

/** Convenience wrapper for Express route handlers. */
export function idempotent(
  store: Store,
  handler: (req: Request, res: Response) => Promise<IdempotentResponse>,
): RequestHandler {
  return (req, res, next) => {
    withIdempotency(req, res, store, () => handler(req, res)).catch(next);
  };
}
