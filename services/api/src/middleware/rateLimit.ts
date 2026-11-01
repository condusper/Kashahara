import type { Request, RequestHandler, Response } from 'express';
import { Errors } from '../errors';
import { logger } from '../logger';

export interface RateLimitResult {
  count: number;
  resetAt: number;
}

/**
 * Rate-limit counters live behind this interface so a single-instance
 * deployment can use memory while a multi-instance deployment can share Redis.
 */
export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitResult>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, RateLimitResult>();

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const bucket = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
      return { ...bucket };
    }

    existing.count += 1;
    return { ...existing };
  }

  clear(): void {
    this.buckets.clear();
  }
}

/** The small subset of node-redis this limiter needs. */
export interface RedisRateLimitClient {
  /** node-redis exposes this as a getter; absent on test doubles. */
  readonly isReady?: boolean;
  incr(key: string): Promise<number>;
  /** node-redis returns a number; other clients may return a boolean. */
  pExpire(key: string, milliseconds: number): Promise<unknown>;
  pTTL(key: string): Promise<number>;
}

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly client: RedisRateLimitClient) {}

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    // Never queue commands against a dead or still-connecting socket; a long
    // Redis outage would otherwise grow an unbounded command backlog.
    if (this.client.isReady === false) {
      throw new Error('Redis rate limit store is not ready');
    }

    const count = await this.client.incr(key);
    // INCR is atomic, so only the request that created the counter sets the
    // expiry. Later requests keep the original window.
    if (count === 1) {
      await this.client.pExpire(key, windowMs);
    }
    const ttl = await this.client.pTTL(key);
    return {
      count,
      resetAt: Date.now() + (ttl > 0 ? ttl : windowMs),
    };
  }
}

/**
 * Keeps the API available when Redis is down: counters fall back to process
 * memory, which is imperfect across instances but still limits a single one.
 *
 * A slow or unreachable Redis must never stall a request, so the primary store
 * is given a short deadline before the fallback takes over.
 */
export class FallbackRateLimitStore implements RateLimitStore {
  constructor(
    private readonly primary: RateLimitStore,
    private readonly fallback: RateLimitStore,
    private readonly onError: (error: unknown) => void,
    private readonly timeoutMs = 500,
  ) {}

  async increment(key: string, windowMs: number): Promise<RateLimitResult> {
    try {
      return await this.withTimeout(this.primary.increment(key, windowMs));
    } catch (error) {
      this.onError(error);
      return this.fallback.increment(key, windowMs);
    }
  }

  private withTimeout(promise: Promise<RateLimitResult>): Promise<RateLimitResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Rate limit store timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      timer.unref?.();
      promise.then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  key?: (req: Request, res: Response) => string;
  /** Separates counters for different limiters that may share a key. */
  prefix?: string;
  /** Defaults to an in-process store; production passes a shared Redis store. */
  store?: RateLimitStore;
}

const defaultStore = new MemoryRateLimitStore();

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const store = options.store ?? defaultStore;

  return (req, res, next) => {
    const key = `${options.prefix ?? 'default'}:${
      options.key?.(req, res) ?? req.ip ?? 'unknown'
    }`;

    store
      .increment(key, options.windowMs)
      .then((result) => {
        if (result.count > options.max) {
          const retryAfter = Math.max(
            1,
            Math.ceil((result.resetAt - Date.now()) / 1000),
          );
          res.setHeader('Retry-After', String(retryAfter));
          next(Errors.rateLimited(options.message));
          return;
        }
        next();
      })
      .catch((error: unknown) => {
        // A limiter outage must not take the API down. Log it and allow the
        // request; Redis-backed stores normally fall back before this point.
        logger.warn('Rate limit check failed; allowing request', {
          error: error instanceof Error ? error.message : String(error),
        });
        next();
      });
  };
}
