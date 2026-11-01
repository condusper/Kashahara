import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BigisubVtuProvider } from '../providers/bigisub';
import {
  ProviderNotConfiguredError,
  ProviderPendingError,
  ProviderRejectedError,
} from '../providers/types';

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

const PLANS = {
  success: true,
  data: [
    {
      id: 135,
      network: 1,
      network_name: 'MTN',
      plantype: 'SME',
      size: 1.5,
      plan_volume: 'GB',
      validity: '30 days',
      amount: 465,
      plan_amount: 480,
      plan_disabled: false,
    },
    {
      id: 301,
      network: 2,
      network_name: 'Glo',
      plantype: 'GIFTING',
      size: '3GB',
      plan_volume: '3072MB',
      validity: '30 days',
      amount: 980,
      plan_amount: 1000,
      plan_disabled: false,
    },
    {
      id: 502,
      network: 3,
      network_name: 'Airtel',
      plantype: 'CGIFTING',
      size: 500,
      plan_volume: 'MB',
      validity: '30 days',
      amount: 300,
      plan_amount: 320,
      plan_disabled: false,
    },
    {
      id: 900,
      network: 4,
      network_name: '9mobile',
      plantype: 'SME',
      size: '1GB',
      plan_volume: '1024MB',
      validity: '30 days',
      amount: 250,
      plan_amount: 270,
      plan_disabled: true,
    },
    {
      id: 901,
      network: 1,
      network_name: 'MTN',
      plantype: 'SME',
      size: '2GB',
      plan_volume: '2048MB',
      validity: '30 days',
      amount: 0,
      plan_amount: 0,
      plan_disabled: false,
    },
  ],
  message: 'Data plans retrieved successfully',
};

function providerWith(
  handler: (request: RecordedRequest) => Response,
  markupPercent = 0,
): { provider: BigisubVtuProvider; requests: RecordedRequest[] } {
  const { fetchImpl, requests } = mockFetch(handler);
  const provider = new BigisubVtuProvider({
    baseUrl: 'https://supplier.test',
    apiToken: 'live-token',
    pin: '1234',
    fetchImpl,
    planTtlMs: 60_000,
    markupPercent,
  });
  return { provider, requests };
}

function successfulAirtime(transactionId = 'AirSuccess1'): Response {
  return jsonResponse({
    success: true,
    data: {
      transaction_id: transactionId,
      reference: '202604101309hlpS',
      status: 'successful',
      amount: '50',
      phone_number: '07018014056',
      network: 'airtel',
    },
    message: 'Airtime purchase successful',
  });
}

describe('Bigisub provider', () => {
  it('parses the live catalogue and skips disabled, unpriced, and unknown plans', async () => {
    const { provider, requests } = providerWith(() => jsonResponse(PLANS));

    const plans = await provider.listDataPlans();

    assert.equal(requests[0]?.url, 'https://supplier.test/api/v2/vtu/data/plans/');
    assert.equal(requests[0]?.method, 'GET');
    assert.equal(requests[0]?.headers.Authorization, 'Token live-token');
    assert.deepEqual(
      plans.map((plan) => [plan.network, plan.id, plan.allowance, plan.priceKobo, plan.category]),
      [
        ['MTN', '135', '1.5GB', 46_500, 'SME'],
        ['GLO', '301', '3GB', 98_000, 'Gifting'],
        ['AIRTEL', '502', '500MB', 30_000, 'Corporate'],
      ],
    );
    assert.equal(plans[0]?.isDemo, false);
    assert.equal(plans[0]?.name, '1.5GB SME');
  });

  it('caches the catalogue between lookups', async () => {
    const { provider, requests } = providerWith(() => jsonResponse(PLANS));
    await provider.listDataPlans();
    await provider.listDataPlans();
    assert.equal(requests.length, 1);
  });

  it('applies the configured margin and rounds up to whole Naira', async () => {
    const { provider } = providerWith(() => jsonResponse(PLANS), 3);

    const plans = await provider.listDataPlans();

    assert.deepEqual(
      plans.map((plan) => plan.priceKobo),
      [47_900, 101_000, 30_900],
    );
  });

  it('accepts the marked-up price when purchasing data', async () => {
    const { provider, requests } = providerWith((request) => {
      if (request.url.endsWith('/data/plans/')) return jsonResponse(PLANS);
      return jsonResponse({
        success: true,
        data: {
          transaction_id: 'DataMarkedUp1',
          status: 'successful',
        },
        message: 'Data purchase successful',
      });
    }, 3);

    const result = await provider.purchaseData({
      network: 'MTN',
      phone: '08031234567',
      planId: '135',
      planName: '1.5GB SME',
      amountKobo: 47_900,
      reference: 'KSH-DATA-MARKUP',
    });

    const vend = requests.find((request) => request.url.endsWith('/data/purchase/'));
    assert.equal((vend?.body as { plan: number }).plan, 135);
    assert.equal(result.providerReference, 'DataMarkedUp1');
  });

  it('uses the Bigisub network ids for airtime, with Naira amount and PIN', async () => {
    const { provider, requests } = providerWith(() => successfulAirtime());

    const result = await provider.purchaseAirtime({
      network: 'AIRTEL',
      phone: '07018014056',
      amountKobo: 5_000,
      reference: 'KSH-AIR-1',
    });

    assert.deepEqual(requests[0]?.body, {
      network: 3,
      phone_number: '07018014056',
      amount: '50',
      airtime_type: 'vtu',
      pin: '1234',
    });
    assert.equal(result.providerReference, 'AirSuccess1');
    assert.equal(result.simulated, false);
  });

  it('maps Glo and 9mobile without reusing the Ogdams ids', async () => {
    const { provider, requests } = providerWith(() => successfulAirtime());

    await provider.purchaseAirtime({
      network: 'GLO',
      phone: '08051234567',
      amountKobo: 2_500,
      reference: 'KSH-AIR-GLO',
    });
    await provider.purchaseAirtime({
      network: '9MOBILE',
      phone: '08091234567',
      amountKobo: 2_500,
      reference: 'KSH-AIR-9M',
    });

    assert.equal((requests[0]?.body as { network: number }).network, 2);
    assert.equal((requests[1]?.body as { network: number }).network, 4);
  });

  it('rejects airtime below N25 or not in whole Naira', async () => {
    const { provider, requests } = providerWith(() => successfulAirtime());

    await assert.rejects(
      provider.purchaseAirtime({
        network: 'MTN',
        phone: '08031234567',
        amountKobo: 2_400,
        reference: 'KSH-AIR-LOW',
      }),
      (error: unknown) =>
        error instanceof ProviderRejectedError && /at least ₦25/.test(error.message),
    );
    await assert.rejects(
      provider.purchaseAirtime({
        network: 'MTN',
        phone: '08031234567',
        amountKobo: 2_550,
        reference: 'KSH-AIR-FRACTION',
      }),
      (error: unknown) =>
        error instanceof ProviderRejectedError && /whole Naira/.test(error.message),
    );
    assert.equal(requests.length, 0);
  });

  it('rechecks the catalogue price before buying data', async () => {
    const { provider, requests } = providerWith(() => jsonResponse(PLANS));
    await provider.listDataPlans();

    await assert.rejects(
      provider.purchaseData({
        network: 'MTN',
        phone: '08031234567',
        planId: '135',
        planName: '1.5GB',
        amountKobo: 40_000,
        reference: 'KSH-DATA-STALE',
      }),
      (error: unknown) =>
        error instanceof ProviderRejectedError && /price changed/i.test(error.message),
    );
    assert.equal(requests.length, 1);
  });

  it('sends the numeric catalogue plan id when buying data', async () => {
    const { provider, requests } = providerWith((request) => {
      if (request.url.endsWith('/data/plans/')) return jsonResponse(PLANS);
      return jsonResponse({
        success: true,
        data: {
          transaction_id: 'DataDelivered1',
          reference: '202604101309dat1',
          status: 'successful',
          amount: '465',
          phone_number: '08031234567',
          network: 'mtn',
        },
        message: 'Data purchase successful',
      });
    });

    const result = await provider.purchaseData({
      network: 'MTN',
      phone: '08031234567',
      planId: '135',
      planName: '1.5GB SME',
      amountKobo: 46_500,
      reference: 'KSH-DATA-1',
    });

    const vend = requests.find((request) => request.url.endsWith('/data/purchase/'));
    assert.deepEqual(vend?.body, {
      network: 1,
      plan: 135,
      phone_number: '08031234567',
      pin: '1234',
    });
    assert.equal(result.providerReference, 'DataDelivered1');
  });

  it('keeps a processing order pending with its supplier reference', async () => {
    const { provider } = providerWith(() =>
      jsonResponse(
        {
          success: true,
          data: {
            transaction_id: 'AirPending1',
            reference: '202604101309pend',
            status: 'processing',
          },
          message: 'Airtime purchase is being processed',
        },
        201,
      ),
    );

    await assert.rejects(
      provider.purchaseAirtime({
        network: 'AIRTEL',
        phone: '07018014056',
        amountKobo: 5_000,
        reference: 'KSH-AIR-2',
      }),
      (error: unknown) =>
        error instanceof ProviderPendingError &&
        error.providerReference === 'AirPending1',
    );
  });

  it('treats an unsuccessful response as a definitive rejection', async () => {
    const { provider } = providerWith(() =>
      jsonResponse(
        {
          success: false,
          data: { transaction_id: null },
          message: 'Insufficient wallet balance',
        },
        402,
      ),
    );

    await assert.rejects(
      provider.purchaseAirtime({
        network: 'MTN',
        phone: '08031234567',
        amountKobo: 5_000,
        reference: 'KSH-AIR-3',
      }),
      (error: unknown) =>
        error instanceof ProviderRejectedError && /Insufficient wallet balance/.test(error.message),
    );
  });

  it('surfaces the field errors behind a generic validation failure', async () => {
    const { provider } = providerWith(() =>
      jsonResponse(
        {
          success: false,
          message: 'Validation failed',
          data: null,
          errors: { non_field_errors: ['Incorrect PIN'] },
        },
        400,
      ),
    );

    await assert.rejects(
      provider.purchaseAirtime({
        network: 'AIRTEL',
        phone: '07018014056',
        amountKobo: 5_000,
        reference: 'KSH-AIR-4',
      }),
      (error: unknown) =>
        error instanceof ProviderRejectedError && error.message === 'Incorrect PIN',
    );
  });

  it('rejects a missing or malformed transaction PIN at construction', () => {
    assert.throws(
      () =>
        new BigisubVtuProvider({
          baseUrl: 'https://supplier.test',
          apiToken: 'live-token',
          pin: '12',
        }),
      (error: unknown) =>
        error instanceof ProviderNotConfiguredError && /four digits/.test(error.message),
    );
  });

  it('maps supplier statuses from the anubis detail endpoint', async () => {
    const { provider, requests } = providerWith((request) => {
      if (request.url.includes('/successful/')) {
        return jsonResponse({
          success: true,
          data: { tranx_id: 'successful', status: 'successful' },
          message: 'Transaction details retrieved',
        });
      }
      if (request.url.includes('/failed/')) {
        return jsonResponse({
          success: true,
          data: { tranx_id: 'failed', status: 'failed' },
          message: 'Transaction details retrieved',
        });
      }
      if (request.url.includes('/missing/')) {
        return jsonResponse({ success: false, message: 'Transaction not found' }, 404);
      }
      return jsonResponse({
        success: true,
        data: { tranx_id: 'pending', status: 'processing' },
        message: 'Transaction details retrieved',
      });
    });

    assert.equal((await provider.getStatus('successful')).state, 'successful');
    assert.equal((await provider.getStatus('failed')).state, 'failed');
    assert.equal((await provider.getStatus('pending')).state, 'pending');
    assert.equal((await provider.getStatus('missing')).state, 'pending');
    assert.equal(
      requests[0]?.url,
      'https://supplier.test/api/v2/anubis/transactions/successful/',
    );
    assert.equal(requests[0]?.headers.Authorization, 'Token live-token');
    assert.equal(
      requests.filter((request) => request.url.endsWith('/pending/requery/')).length,
      1,
    );
  });
});
