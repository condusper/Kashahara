import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { OgdamsVtuProvider } from '../providers/ogdams';
import { ProviderPendingError, ProviderRejectedError } from '../providers/types';

interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockFetch(handler: (request: RecordedRequest) => Response): {
  fetchImpl: typeof fetch;
  requests: RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const request: RecordedRequest = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    };
    requests.push(request);
    return handler(request);
  }) as typeof fetch;
  return { fetchImpl, requests };
}

const PLANS = [
  { networkId: 1, planId: 20000, name: '75MB [GIFTING]', price: '75.00', validity: '1 Day' },
  { networkId: 1, planId: 20001, name: '1.5GB [GIFTING]', price: '1000.00', validity: '30 Days' },
  { networkId: 2, planId: 9001, name: '500MB [SME]', price: '300.00', validity: '30 Days' },
  { networkId: 1, planId: 11116, name: '50MB [DATA_SHARE]', price: '0.00', validity: '30 Days' },
  { networkId: 1, planId: 7000, name: 'XtraTalk 1500 [GIFTING]', price: '1500.00', validity: '30 Days' },
];

function providerWith(
  handler: (request: RecordedRequest) => Response,
): { provider: OgdamsVtuProvider; requests: RecordedRequest[] } {
  const { fetchImpl, requests } = mockFetch(handler);
  const provider = new OgdamsVtuProvider({
    baseUrl: 'https://supplier.test/api/v1',
    apiKey: 'sk_live_test',
    airtimeType: 'vtu',
    fetchImpl,
    planTtlMs: 60_000,
  });
  return { provider, requests };
}

describe('Ogdams provider', () => {
  it('parses the live plan catalogue and skips unpriced or non-data products', async () => {
    const { provider, requests } = providerWith(() => jsonResponse(PLANS));

    const plans = await provider.listDataPlans();

    assert.equal(requests[0]?.url, 'https://supplier.test/api/v1/get/data/plans');
    assert.equal(requests[0]?.method, 'GET');
    assert.equal(requests[0]?.headers.Authorization, 'Bearer sk_live_test');
    assert.deepEqual(
      plans.map((plan) => [plan.network, plan.id, plan.allowance, plan.priceKobo]),
      [
        ['MTN', '20000', '75MB', 7_500],
        ['MTN', '20001', '1.5GB', 100_000],
        ['AIRTEL', '9001', '500MB', 30_000],
      ],
    );
    assert.equal(plans[0]?.isDemo, false);
    assert.equal(plans[0]?.validity, '1 day');
    assert.equal(plans[1]?.category, 'Gifting');
    assert.equal(plans[2]?.category, 'SME');
  });

  it('caches the catalogue between lookups', async () => {
    const { provider, requests } = providerWith(() => jsonResponse(PLANS));
    await provider.listDataPlans();
    await provider.listDataPlans();
    assert.equal(requests.length, 1);
  });

  it('sends airtime in Naira with the configured channel', async () => {
    const { provider, requests } = providerWith(() =>
      jsonResponse({ status: true, code: 200, data: { msg: 'Airtime delivered', ref: 'OGD-1' } }),
    );

    const result = await provider.purchaseAirtime({
      network: 'MTN',
      phone: '08031234567',
      amountKobo: 5_000,
      reference: 'KSH-AIR-1',
    });

    assert.deepEqual(requests[0]?.body, {
      networkId: 1,
      amount: 50,
      phoneNumber: '08031234567',
      type: 'vtu',
      reference: 'KSH-AIR-1',
    });
    assert.equal(result.providerReference, 'OGD-1');
    assert.equal(result.simulated, false);
  });

  it('sends the supplier plan id and rejects a stale price', async () => {
    const { provider, requests } = providerWith(() => jsonResponse(PLANS));
    await provider.listDataPlans();

    await assert.rejects(
      provider.purchaseData({
        network: 'MTN',
        phone: '08031234567',
        planId: '20001',
        planName: '1.5GB',
        amountKobo: 90_000,
        reference: 'KSH-DATA-1',
      }),
      (error: unknown) =>
        error instanceof ProviderRejectedError && /price changed/i.test(error.message),
    );
    assert.equal(requests.length, 1);
  });

  it('vend data with the numeric supplier plan id', async () => {
    const { provider, requests } = providerWith((request) => {
      if (request.url.endsWith('/get/data/plans')) return jsonResponse(PLANS);
      return jsonResponse({
        status: true,
        code: 200,
        data: { msg: 'Data delivered', ref: 'OGD-DATA-1' },
      });
    });

    const result = await provider.purchaseData({
      network: 'MTN',
      phone: '08031234567',
      planId: '20001',
      planName: '1.5GB',
      amountKobo: 100_000,
      reference: 'KSH-DATA-2',
    });

    const vend = requests.find((request) => request.url.endsWith('/vend/data'));
    assert.deepEqual(vend?.body, {
      networkId: 1,
      planId: 20001,
      phoneNumber: '08031234567',
      reference: 'KSH-DATA-2',
    });
    assert.equal(result.providerReference, 'OGD-DATA-1');
  });

  it('treats a supplier rejection as a definitive failure', async () => {
    const { provider } = providerWith(() =>
      jsonResponse({
        status: false,
        code: 424,
        data: { msg: 'You are not sending to a valid MTN number.', ref: null },
      }),
    );

    await assert.rejects(
      provider.purchaseAirtime({
        network: 'MTN',
        phone: '08031234567',
        amountKobo: 5_000,
        reference: 'KSH-AIR-2',
      }),
      (error: unknown) =>
        error instanceof ProviderRejectedError &&
        /valid MTN number/.test(error.message),
    );
  });

  it('marks a 202 processing response as pending, not uncertain', async () => {
    const { provider } = providerWith(() =>
      jsonResponse({
        status: true,
        code: 202,
        data: { msg: 'Transaction is being processed', ref: 'OGD-PENDING-1' },
      }),
    );

    await assert.rejects(
      provider.purchaseAirtime({
        network: 'AIRTEL',
        phone: '09021234567',
        amountKobo: 5_000,
        reference: 'KSH-AIR-3',
      }),
      (error: unknown) =>
        error instanceof ProviderPendingError &&
        error.providerReference === 'OGD-PENDING-1',
    );
  });
});
