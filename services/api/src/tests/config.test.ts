import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../config';
import { fundingAmountKoboSchema } from '../validation';

const base = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
} as Record<string, string>;

describe('configuration', () => {
  it('forces simulated funding off when a live Paystack key is present', () => {
    const config = loadConfig({
      ...base,
      PAYSTACK_SECRET_KEY: 'sk_live_example',
      ALLOW_SIMULATED_PAYMENTS: 'true',
    } as NodeJS.ProcessEnv);

    assert.equal(config.paystackMode, 'live');
    assert.equal(config.allowSimulatedPayments, false);
  });

  it('keeps simulated funding available with a test key', () => {
    const config = loadConfig({
      ...base,
      PAYSTACK_SECRET_KEY: 'sk_test_example',
      ALLOW_SIMULATED_PAYMENTS: 'true',
    } as NodeJS.ProcessEnv);

    assert.equal(config.paystackMode, 'test');
    assert.equal(config.allowSimulatedPayments, true);
  });

  it('treats a missing callback URL as unset instead of localhost', () => {
    const config = loadConfig({ ...base } as NodeJS.ProcessEnv);
    assert.equal(config.paystackCallbackUrl, null);
    assert.equal(config.paystackMode, null);
  });

  it('requires a Paystack key and an HTTPS or app-scheme callback in production', () => {
    const production = {
      ...base,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      VTU_PROVIDER: 'bigisub',
      BIGISUB_API_TOKEN: 'live-token',
      BIGISUB_TRANSACTION_PIN: '1234',
    } as Record<string, string>;

    assert.throws(() => loadConfig(production as NodeJS.ProcessEnv), /PAYSTACK_SECRET_KEY/);

    assert.throws(
      () =>
        loadConfig({
          ...production,
          PAYSTACK_SECRET_KEY: 'sk_live_example',
          PAYSTACK_CALLBACK_URL: 'http://kashahara.example/callback',
        } as NodeJS.ProcessEnv),
      /https/i,
    );

    assert.throws(
      () =>
        loadConfig({
          ...production,
          PAYSTACK_SECRET_KEY: 'sk_live_example',
          PAYSTACK_CALLBACK_URL: 'exp://192.168.1.2:8081/--/funding',
        } as NodeJS.ProcessEnv),
      /https/i,
    );

    const config = loadConfig({
      ...production,
      PAYSTACK_SECRET_KEY: 'sk_live_example',
      PAYSTACK_CALLBACK_URL: 'https://kashahara.example/callback',
      ALLOW_SIMULATED_PAYMENTS: 'false',
    } as NodeJS.ProcessEnv);
    assert.equal(config.paystackMode, 'live');
    assert.equal(config.paystackCallbackUrl, 'https://kashahara.example/callback');

    const appConfig = loadConfig({
      ...production,
      PAYSTACK_SECRET_KEY: 'sk_live_example',
      PAYSTACK_CALLBACK_URL: 'kashahara://funding/{reference}',
      ALLOW_SIMULATED_PAYMENTS: 'false',
    } as NodeJS.ProcessEnv);
    assert.equal(appConfig.paystackCallbackUrl, 'kashahara://funding/{reference}');
  });

  it('refuses the mock provider with a live Paystack key in production', () => {
    const production = {
      ...base,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
      PAYSTACK_SECRET_KEY: 'sk_live_example',
      ALLOW_SIMULATED_PAYMENTS: 'false',
    } as Record<string, string>;

    assert.throws(
      () => loadConfig(production as NodeJS.ProcessEnv),
      /VTU_PROVIDER must be bigisub, http, or ogdams in production with a live Paystack key/,
    );
    assert.throws(
      () =>
        loadConfig({ ...production, VTU_PROVIDER: 'mock' } as NodeJS.ProcessEnv),
      /VTU_PROVIDER must not be mock in production with a live Paystack key/,
    );

    const testMode = loadConfig({
      ...production,
      PAYSTACK_SECRET_KEY: 'sk_test_example',
    } as NodeJS.ProcessEnv);
    assert.equal(testMode.vtuProvider, 'mock');
    assert.equal(testMode.paystackMode, 'test');
  });

  it('enforces the funding amount limits', () => {
    assert.equal(fundingAmountKoboSchema.safeParse(9_999).success, false);
    assert.equal(fundingAmountKoboSchema.safeParse(10_000).success, true);
    assert.equal(fundingAmountKoboSchema.safeParse(10_000_001).success, false);
    assert.equal(fundingAmountKoboSchema.safeParse(12_345.5).success, false);
  });

  it('requires a Bigisub token and a four-digit PIN when selected', () => {
    assert.throws(
      () => loadConfig({ ...base, VTU_PROVIDER: 'bigisub' } as NodeJS.ProcessEnv),
      /BIGISUB_API_TOKEN/,
    );
    assert.throws(
      () =>
        loadConfig({
          ...base,
          VTU_PROVIDER: 'bigisub',
          BIGISUB_API_TOKEN: 'live-token',
          BIGISUB_TRANSACTION_PIN: '123',
        } as NodeJS.ProcessEnv),
      /four digits/,
    );

    const config = loadConfig({
      ...base,
      VTU_PROVIDER: 'bigisub',
      BIGISUB_API_TOKEN: 'live-token',
      BIGISUB_TRANSACTION_PIN: '1234',
    } as NodeJS.ProcessEnv);
    assert.equal(config.vtuProvider, 'bigisub');
    assert.equal(config.bigisubBaseUrl, 'https://api.bigisub.ng');
    assert.equal(config.bigisubApiToken, 'live-token');
    assert.equal(config.bigisubTransactionPin, '1234');
    assert.equal(config.dataMarkupPercent, 3);
    assert.equal(config.airtimeFeePercent, 2.5);
    assert.equal(config.airtimeFeeMinKobo, 100);
    assert.equal(config.purchaseReconcileIntervalMs, 60_000);
  });

  it('parses pricing and reconciliation settings', () => {
    const config = loadConfig({
      ...base,
      DATA_MARKUP_PERCENT: '2.5',
      AIRTIME_FEE_PERCENT: '4',
      AIRTIME_FEE_MIN_KOBO: '200',
      PURCHASE_RECONCILE_INTERVAL_MS: '0',
    } as NodeJS.ProcessEnv);
    assert.equal(config.dataMarkupPercent, 2.5);
    assert.equal(config.airtimeFeePercent, 4);
    assert.equal(config.airtimeFeeMinKobo, 200);
    assert.equal(config.purchaseReconcileIntervalMs, 0);

    assert.throws(
      () => loadConfig({ ...base, DATA_MARKUP_PERCENT: '60' } as NodeJS.ProcessEnv),
      /between 0 and 50/,
    );
    assert.throws(
      () => loadConfig({ ...base, AIRTIME_FEE_PERCENT: '-1' } as NodeJS.ProcessEnv),
      /between 0 and 50/,
    );
    assert.throws(
      () => loadConfig({ ...base, AIRTIME_FEE_MIN_KOBO: '-1' } as NodeJS.ProcessEnv),
      /non-negative integer/,
    );
    assert.throws(
      () => loadConfig({ ...base, PURCHASE_RECONCILE_INTERVAL_MS: '-1' } as NodeJS.ProcessEnv),
      /non-negative integer/,
    );
  });
});
