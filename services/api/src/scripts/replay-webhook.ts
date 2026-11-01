/**
 * Replays a successful Paystack transaction as a signed `charge.success`
 * webhook. Use this when a real payment succeeded but the webhook could not
 * reach the local API (Paystack cannot deliver to localhost).
 *
 *   npm run paystack:replay --workspace @kashahara/api -- KSHFUND-XXXX
 *
 * Set PAYSTACK_WEBHOOK_URL to override the default local receiver. The
 * transaction is re-verified with Paystack first, so only a genuinely
 * successful payment is replayed. The wallet credit itself is idempotent.
 */
import { hmacSha512Hex } from '../crypto';
import { loadConfig } from '../config';
import { PaystackClient, PaystackError } from '../paystack';

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function main(): Promise<void> {
  const reference = process.argv[2]?.trim();
  if (!reference) {
    console.error('Usage: npm run paystack:replay --workspace @kashahara/api -- <reference>');
    process.exitCode = 1;
    return;
  }

  const config = loadConfig();
  if (!config.paystackSecretKey) {
    console.error('PAYSTACK_SECRET_KEY is not set.');
    process.exitCode = 1;
    return;
  }
  const paystack = new PaystackClient({
    secretKey: config.paystackSecretKey,
    baseUrl: config.paystackBaseUrl,
  });

  const verification = await paystack.verify(reference);
  console.log(`Transaction: ${verification.reference}`);
  console.log(`State:       ${verification.state}`);
  console.log(`Amount:      ${naira(verification.amountKobo)}`);
  if (verification.state !== 'successful') {
    console.error('Refusing to replay a transaction that Paystack does not report as successful.');
    process.exitCode = 1;
    return;
  }

  const payload = {
    event: 'charge.success',
    data: verification.raw.data,
  };
  const raw = JSON.stringify(payload);
  const signature = hmacSha512Hex(config.paystackSecretKey, raw);
  const url =
    process.env.PAYSTACK_WEBHOOK_URL?.trim() ||
    'http://127.0.0.1:4000/api/v1/webhooks/paystack';

  console.log(`Posting to:  ${url}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-paystack-signature': signature,
    },
    body: raw,
  });
  const text = await response.text();
  console.log(`HTTP ${response.status}: ${text}`);
  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  if (error instanceof PaystackError) {
    console.error(`Paystack rejected the request: ${error.message}`);
    if (error.status) console.error(`HTTP status: ${error.status}`);
    if (error.providerCode) console.error(`Provider code: ${error.providerCode}`);
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
});
