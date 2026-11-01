/**
 * Read-only Paystack credential check.
 *
 *   npm run paystack:check --workspace @kashahara/api
 *   npm run paystack:check --workspace @kashahara/api -- KSH-FUND-XXXX
 *
 * With no argument it calls GET /balance, which proves the key is valid
 * without moving money. With a funding reference it also verifies that
 * transaction and prints its state. The key is never printed.
 */
import { loadConfig } from '../config';
import { PaystackClient, PaystackError } from '../paystack';

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const paystack = new PaystackClient({
    secretKey: config.paystackSecretKey,
    baseUrl: config.paystackBaseUrl,
  });

  if (!paystack.isConfigured) {
    console.error('PAYSTACK_SECRET_KEY is not set.');
    console.error('Add it to services/api/.env, then run this check again.');
    process.exitCode = 1;
    return;
  }

  const mode = paystack.mode ?? 'unknown';
  console.log(`Paystack mode: ${mode.toUpperCase()}`);
  console.log(`API base:      ${config.paystackBaseUrl}`);
  console.log(`Callback URL:  ${config.paystackCallbackUrl ?? '(not set)'}`);
  console.log(`Webhook URL:   ${config.appUrl.replace(/\/$/, '')}/api/v1/webhooks/paystack`);

  if (mode === 'live') {
    console.log('This key moves REAL money. A live charge cannot be undone from the API.');
  }
  if (mode === 'unknown') {
    console.log('Warning: the key prefix is not sk_test_ or sk_live_. Make sure it is a secret key.');
  }
  if (/localhost|127\.0\.0\.1/.test(config.appUrl)) {
    console.log(
      'Warning: APP_URL points at localhost. Paystack cannot deliver webhooks there; use a public HTTPS URL or a tunnel.',
    );
  }

  const balances = await paystack.getBalances();
  if (balances.length === 0) {
    console.log('Balance:       (Paystack returned no balances for this account)');
  } else {
    for (const balance of balances) {
      console.log(`Balance:       ${balance.currency} ${naira(balance.balance)}`);
    }
  }

  const reference = process.argv[2];
  if (reference) {
    const verification = await paystack.verify(reference);
    console.log('');
    console.log(`Transaction:   ${verification.reference}`);
    console.log(`State:         ${verification.state}`);
    console.log(`Amount:        ${naira(verification.amountKobo)}`);
    console.log(`Currency:      ${verification.currency || '(unknown)'}`);
    console.log(`Gateway:       ${verification.gatewayResponse ?? '(none)'}`);
    console.log(`Paid at:       ${verification.paidAt ?? '(not paid)'}`);
  }

  console.log('');
  console.log('Credential check passed.');
}

main().catch((error) => {
  if (error instanceof PaystackError) {
    console.error(`Paystack rejected the check: ${error.message}`);
    if (error.status) console.error(`HTTP status: ${error.status}`);
    if (error.providerCode) console.error(`Provider code: ${error.providerCode}`);
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
});
