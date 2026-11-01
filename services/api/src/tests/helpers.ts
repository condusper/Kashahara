import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, createServices, type AppDependencies } from '../app';
import { loadConfig, type Config } from '../config';
import { PaystackClient } from '../paystack';
import { MockVtuProvider, type VtuProvider } from '../providers';
import { MemoryStore } from '../store/memory';
import type { Store } from '../types';

export const TEST_PASSWORD = 'DemoPass123!';
export const TEST_PIN = '1234';
export const TEST_EMAIL = 'ada@example.test';
export const TEST_PHONE = '08031234567';

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
    ALLOW_SIMULATED_PAYMENTS: 'true',
    ALLOW_DEV_CODES: 'true',
    RATE_LIMIT_MAX_REQUESTS: '10000',
    AUTH_RATE_LIMIT_MAX_ATTEMPTS: '1000',
    ...overrides,
  } as NodeJS.ProcessEnv);
}

export interface Harness {
  store: Store;
  config: Config;
  provider: VtuProvider;
  paystack: PaystackClient;
  services: ReturnType<typeof createServices>;
}

export function makeHarnessWithProvider(
  provider: VtuProvider,
  overrides: Record<string, string> = {},
  paystackFetch?: typeof fetch,
): Harness {
  const config = testConfig(overrides);
  const store = new MemoryStore();
  const paystack = new PaystackClient({
    secretKey: config.paystackSecretKey,
    baseUrl: config.paystackBaseUrl,
    fetchImpl: paystackFetch,
  });
  const services = createServices({ store, config, provider, paystack });
  return { store, config, provider, paystack, services };
}

export function makeHarness(
  overrides: Record<string, string> = {},
  paystackFetch?: typeof fetch,
): Harness {
  return makeHarnessWithProvider(new MockVtuProvider(), overrides, paystackFetch);
}

export async function registerUser(harness: Harness) {
  return harness.services.auth.register({
    fullName: 'Ada Okafor',
    email: TEST_EMAIL,
    phone: TEST_PHONE,
    password: TEST_PASSWORD,
    userAgent: 'test',
    ip: '127.0.0.1',
  });
}

export async function setPin(harness: Harness, userId: string): Promise<void> {
  await harness.services.auth.setTransactionPin(userId, TEST_PASSWORD, TEST_PIN);
}

export async function fundWallet(
  harness: Harness,
  userId: string,
  amountKobo: number,
): Promise<void> {
  const funding = await harness.services.wallet.initializeFunding(
    userId,
    amountKobo,
    TEST_EMAIL,
  );
  await harness.services.wallet.simulateFunding(userId, funding.funding.reference);
}

export interface TestServer {
  server: Server;
  baseUrl: string;
  close: () => Promise<void>;
}

export async function startServer(deps: AppDependencies): Promise<TestServer> {
  const app = createApp(deps);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}/api/v1`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export async function jsonRequest(
  url: string,
  options: RequestInit = {},
): Promise<{ status: number; body: any; headers: Headers }> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
}
