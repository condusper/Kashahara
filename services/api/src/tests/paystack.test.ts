import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPaystackCallbackUrl,
  isAllowedCallbackUrl,
  PaystackClient,
  paystackKeyMode,
} from '../paystack';

type RecordedCall = { url: string; init: RequestInit };

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientWith(
  responses: Array<{ payload: unknown; status?: number }>,
  secretKey = 'sk_test_1234567890',
): { client: PaystackClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const client = new PaystackClient({
    secretKey,
    baseUrl: 'https://api.paystack.co/',
    fetchImpl: (async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      calls.push({ url: String(input), init: init ?? {} });
      const next = responses.shift();
      if (!next) throw new Error('Unexpected Paystack request');
      return jsonResponse(next.payload, next.status ?? 200);
    }) as typeof fetch,
  });
  return { client, calls };
}

describe('Paystack client', () => {
  it('derives the mode from the secret key prefix', () => {
    assert.equal(paystackKeyMode(null), null);
    assert.equal(paystackKeyMode('sk_test_abc'), 'test');
    assert.equal(paystackKeyMode('sk_live_abc'), 'live');
    assert.equal(paystackKeyMode('pk_live_abc'), 'unknown');
    assert.equal(paystackKeyMode('abc'), 'unknown');
  });

  it('initializes a transaction with kobo, currency, metadata and callback', async () => {
    const { client, calls } = clientWith([
      {
        payload: {
          status: true,
          data: {
            authorization_url: 'https://checkout.paystack.com/abc',
            access_code: 'abc',
            reference: 'KSH-FUND-1',
          },
        },
      },
    ]);

    const result = await client.initialize({
      email: 'ada@example.test',
      amountKobo: 250_000,
      reference: 'KSH-FUND-1',
      callbackUrl: 'https://kashahara.example/pay/callback',
      metadata: { userId: 'user-1', purpose: 'wallet_funding' },
    });

    assert.equal(result.authorizationUrl, 'https://checkout.paystack.com/abc');
    assert.equal(result.reference, 'KSH-FUND-1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, 'https://api.paystack.co/transaction/initialize');
    assert.equal(calls[0]?.init.method, 'POST');
    assert.equal(
      (calls[0]?.init.headers as Record<string, string>).Authorization,
      'Bearer sk_test_1234567890',
    );
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    assert.equal(body.amount, 250_000);
    assert.equal(body.currency, 'NGN');
    assert.equal(body.reference, 'KSH-FUND-1');
    assert.equal(body.callback_url, 'https://kashahara.example/pay/callback');
    assert.deepEqual(body.metadata, { userId: 'user-1', purpose: 'wallet_funding' });
  });

  it('omits callback_url when no callback is configured', async () => {
    const { client, calls } = clientWith([
      {
        payload: {
          status: true,
          data: {
            authorization_url: 'https://checkout.paystack.com/abc',
            access_code: 'abc',
            reference: 'KSH-FUND-2',
          },
        },
      },
    ]);

    await client.initialize({
      email: 'ada@example.test',
      amountKobo: 100_000,
      reference: 'KSH-FUND-2',
      callbackUrl: null,
    });

    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
    assert.equal('callback_url' in body, false);
  });

  it('maps Paystack states into the internal funding states', async () => {
    const { client } = clientWith([
      {
        payload: {
          status: true,
          data: { status: 'success', reference: 'A', amount: 1000, currency: 'NGN' },
        },
      },
      {
        payload: {
          status: true,
          data: { status: 'reversed', reference: 'B', amount: 1000, currency: 'NGN' },
        },
      },
      {
        payload: {
          status: true,
          data: { status: 'abandoned', reference: 'C', amount: 1000, currency: 'NGN' },
        },
      },
      {
        payload: {
          status: true,
          data: { status: 'ongoing', reference: 'D', amount: 1000, currency: 'NGN' },
        },
      },
    ]);

    assert.equal((await client.verify('A')).state, 'successful');
    assert.equal((await client.verify('B')).state, 'failed');
    assert.equal((await client.verify('C')).state, 'abandoned');
    assert.equal((await client.verify('D')).state, 'pending');
  });

  it('reads settlement balances without leaking account details', async () => {
    const { client, calls } = clientWith([
      {
        payload: {
          status: true,
          data: [
            { currency: 'NGN', balance: 5_000_000 },
            { currency: 'USD', balance: 100 },
            { currency: 'BAD', balance: 'not-a-number' },
          ],
        },
      },
    ]);

    const balances = await client.getBalances();
    assert.deepEqual(balances, [
      { currency: 'NGN', balance: 5_000_000 },
      { currency: 'USD', balance: 100 },
    ]);
    assert.equal(calls[0]?.url, 'https://api.paystack.co/balance');
  });

  it('surfaces the provider error code without exposing the key', async () => {
    const { client } = clientWith([
      {
        payload: { status: false, message: 'Invalid key', code: 'invalid_key' },
        status: 401,
      },
    ]);

    await assert.rejects(
      client.getBalances(),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Invalid key/);
        assert.equal((error as { providerCode?: string }).providerCode, 'invalid_key');
        assert.equal(error.message.includes('sk_test_'), false);
        return true;
      },
    );
  });
});

describe('Paystack callback URLs', () => {
  it('allows https and the app scheme everywhere', () => {
    assert.equal(isAllowedCallbackUrl('https://kashahara.example/funding'), true);
    assert.equal(isAllowedCallbackUrl('kashahara://funding/KSH-FUND-1'), true);
  });

  it('allows Expo and http links only when development is enabled', () => {
    assert.equal(isAllowedCallbackUrl('exp://192.168.1.2:8081/--/funding'), false);
    assert.equal(
      isAllowedCallbackUrl('exp://192.168.1.2:8081/--/funding', { allowExpo: true }),
      true,
    );
    assert.equal(isAllowedCallbackUrl('exps://example.test/funding', { allowExpo: true }), true);
    assert.equal(isAllowedCallbackUrl('http://localhost:8081/funding'), false);
    assert.equal(isAllowedCallbackUrl('http://localhost:8081/funding', { allowHttp: true }), true);
  });

  it('rejects malformed and unsupported schemes', () => {
    assert.equal(isAllowedCallbackUrl(''), false);
    assert.equal(isAllowedCallbackUrl('not a url'), false);
    assert.equal(isAllowedCallbackUrl('javascript:alert(1)'), false);
    assert.equal(isAllowedCallbackUrl('ftp://example.test/callback'), false);
  });

  it('returns null when no base URL is configured', () => {
    assert.equal(buildPaystackCallbackUrl(null, 'KSH-FUND-1'), null);
    assert.equal(buildPaystackCallbackUrl(undefined, 'KSH-FUND-1'), null);
    assert.equal(buildPaystackCallbackUrl('', 'KSH-FUND-1'), null);
  });

  it('replaces a reference placeholder', () => {
    assert.equal(
      buildPaystackCallbackUrl('kashahara://funding/{reference}', 'KSH-FUND-1'),
      'kashahara://funding/KSH-FUND-1',
    );
    assert.equal(
      buildPaystackCallbackUrl(
        'https://kashahara.example/pay?ref={reference}&source=app',
        'KSH FUND/1',
      ),
      'https://kashahara.example/pay?ref=KSH%20FUND%2F1&source=app',
    );
  });

  it('appends the reference as a path segment', () => {
    assert.equal(
      buildPaystackCallbackUrl('kashahara://funding', 'KSH-FUND-1'),
      'kashahara://funding/KSH-FUND-1',
    );
    assert.equal(
      buildPaystackCallbackUrl('https://kashahara.example/funding/', 'KSH-FUND-1'),
      'https://kashahara.example/funding/KSH-FUND-1',
    );
    assert.equal(
      buildPaystackCallbackUrl('https://kashahara.example/funding#done', 'KSH-FUND-1'),
      'https://kashahara.example/funding/KSH-FUND-1#done',
    );
  });

  it('appends the reference as a query parameter when the base has a query', () => {
    assert.equal(
      buildPaystackCallbackUrl('https://kashahara.example/pay?source=app', 'KSH-FUND-1'),
      'https://kashahara.example/pay?source=app&reference=KSH-FUND-1',
    );
    assert.equal(
      buildPaystackCallbackUrl('https://kashahara.example/pay?source=app#done', 'KSH-FUND-1'),
      'https://kashahara.example/pay?source=app&reference=KSH-FUND-1#done',
    );
  });
});
