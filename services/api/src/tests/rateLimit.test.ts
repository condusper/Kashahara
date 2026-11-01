import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import type { Request, RequestHandler, Response } from 'express';
import { AppError } from '../errors';
import {
  FallbackRateLimitStore,
  MemoryRateLimitStore,
  RedisRateLimitStore,
  rateLimit,
  type RateLimitStore,
  type RedisRateLimitClient,
} from '../middleware/rateLimit';
import { jsonRequest, makeHarness, startServer } from './helpers';

function request(ip = '203.0.113.10'): Request {
  return { ip, body: {} } as unknown as Request;
}

function response(): { res: Response; headers: Map<string, string> } {
  const headers = new Map<string, string>();
  const res = {
    setHeader: (name: string, value: string) => {
      headers.set(name, value);
    },
  } as unknown as Response;
  return { res, headers };
}

function invoke(
  handler: RequestHandler,
  req: Request,
  res: Response,
): Promise<unknown> {
  return new Promise((resolve) => {
    handler(req, res, (error?: unknown) => resolve(error));
  });
}

class FakeRedis implements RedisRateLimitClient {
  readonly counts = new Map<string, number>();
  readonly ttls = new Map<string, number>();

  async incr(key: string): Promise<number> {
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }

  async pExpire(key: string, milliseconds: number): Promise<boolean> {
    this.ttls.set(key, milliseconds);
    return true;
  }

  async pTTL(key: string): Promise<number> {
    return this.ttls.get(key) ?? -1;
  }
}

describe('rate limiting', () => {
  it('counts requests in memory and resets after the window', async () => {
    const store = new MemoryRateLimitStore();
    const first = await store.increment('key', 30);
    assert.equal(first.count, 1);

    const second = await store.increment('key', 30);
    assert.equal(second.count, 2);
    assert.equal(second.resetAt, first.resetAt);

    await delay(40);
    const afterWindow = await store.increment('key', 30);
    assert.equal(afterWindow.count, 1);
    assert.ok(afterWindow.resetAt > first.resetAt);
  });

  it('counts requests in Redis and keeps the original expiry', async () => {
    const redis = new FakeRedis();
    const store = new RedisRateLimitStore(redis);

    const first = await store.increment('rate:key', 60_000);
    assert.equal(first.count, 1);
    assert.equal(redis.ttls.get('rate:key'), 60_000);

    const second = await store.increment('rate:key', 60_000);
    assert.equal(second.count, 2);
    assert.ok(second.resetAt > Date.now());
  });

  it('does not queue commands while Redis is not ready', async () => {
    let calls = 0;
    const store = new RedisRateLimitStore({
      isReady: false,
      async incr() {
        calls += 1;
        return 1;
      },
      async pExpire() {
        return 1;
      },
      async pTTL() {
        return 1000;
      },
    });

    await assert.rejects(() => store.increment('key', 60_000), /not ready/);
    assert.equal(calls, 0);
  });

  it('falls back to memory when the shared store fails', async () => {
    const fallback = new MemoryRateLimitStore();
    const failing: RateLimitStore = {
      async increment() {
        throw new Error('redis unavailable');
      },
    };
    let errors = 0;
    const store = new FallbackRateLimitStore(failing, fallback, () => {
      errors += 1;
    });

    const first = await store.increment('key', 60_000);
    const second = await store.increment('key', 60_000);
    assert.equal(first.count, 1);
    assert.equal(second.count, 2);
    assert.equal(errors, 2);
  });

  it('falls back to memory when the shared store is slow', async () => {
    const fallback = new MemoryRateLimitStore();
    const slow: RateLimitStore = {
      increment() {
        return new Promise(() => {
          // Never resolves, like a Redis client waiting for a dead socket.
        });
      },
    };
    let errors = 0;
    const store = new FallbackRateLimitStore(
      slow,
      fallback,
      () => {
        errors += 1;
      },
      20,
    );

    const result = await store.increment('key', 60_000);
    assert.equal(result.count, 1);
    assert.equal(errors, 1);
  });

  it('rejects requests over the limit with a 429 and Retry-After', async () => {
    const store = new MemoryRateLimitStore();
    const limiter = rateLimit({ windowMs: 60_000, max: 2, store, prefix: 'test' });
    const { res, headers } = response();

    assert.equal(await invoke(limiter, request(), res), undefined);
    assert.equal(await invoke(limiter, request(), res), undefined);

    const error = await invoke(limiter, request(), res);
    assert.ok(error instanceof AppError);
    assert.equal(error.status, 429);
    assert.equal(error.code, 'RATE_LIMITED');
    assert.ok(Number(headers.get('Retry-After')) >= 1);
  });

  it('keeps separate counters per prefix', async () => {
    const store = new MemoryRateLimitStore();
    const global = rateLimit({ windowMs: 60_000, max: 1, store, prefix: 'global' });
    const auth = rateLimit({ windowMs: 60_000, max: 1, store, prefix: 'auth' });
    const { res } = response();

    assert.equal(await invoke(global, request(), res), undefined);
    assert.equal(await invoke(auth, request(), res), undefined);
    assert.ok((await invoke(global, request(), res)) instanceof AppError);
  });

  it('allows the request if the only store throws', async () => {
    const failing: RateLimitStore = {
      async increment() {
        throw new Error('store offline');
      },
    };
    const limiter = rateLimit({ windowMs: 60_000, max: 1, store: failing });
    assert.equal(await invoke(limiter, request(), response().res), undefined);
  });

  it('does not rate limit the health check', async () => {
    const harness = makeHarness({ RATE_LIMIT_MAX_REQUESTS: '1' });
    const server = await startServer({
      store: harness.store,
      config: harness.config,
      provider: harness.provider,
      paystack: harness.paystack,
      services: harness.services,
    });

    try {
      // Exhaust the one-request budget on a normal API route.
      assert.equal((await jsonRequest(`${server.baseUrl}/catalog`)).status, 200);
      assert.equal((await jsonRequest(`${server.baseUrl}/catalog`)).status, 429);

      // Render probes the health endpoint continuously; it must stay exempt.
      for (let i = 0; i < 3; i += 1) {
        const health = await jsonRequest(`${server.baseUrl}/health`);
        assert.equal(health.status, 200);
        assert.equal(health.body.status, 'ok');
      }
    } finally {
      await server.close();
    }
  });
});
