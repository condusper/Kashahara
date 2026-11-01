/**
 * Read-only Bigisub credential check.
 *
 *   npm run bigisub:check --workspace @kashahara/api
 *   npm run bigisub:check --workspace @kashahara/api -- <transaction_id>
 *
 * It reads the wallet balance and live data catalogue. Neither call moves
 * money. With a transaction id it also prints that order's current status.
 * The API token is never printed.
 */
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const baseUrl = (process.env.BIGISUB_BASE_URL?.trim() || 'https://api.bigisub.ng').replace(
  /\/$/,
  '',
);
const token = process.env.BIGISUB_API_TOKEN?.trim();
const transactionId = process.argv[2];

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Token ${token}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Keep the raw text for the error message.
  }
  return { status: response.status, body };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function main(): Promise<void> {
  if (!token) {
    console.error('BIGISUB_API_TOKEN is not set.');
    console.error('Reveal it in the Bigisub dashboard with your transaction PIN,');
    console.error('add it to services/api/.env, then run this check again.');
    process.exitCode = 1;
    return;
  }

  console.log(`Bigisub base:  ${baseUrl}`);
  console.log('No PIN is sent: wallet and catalogue reads do not move money.');

  const wallet = await get('/api/v2/financial/wallet/balance/');
  if (wallet.status !== 200) {
    console.error(`Wallet check failed with HTTP ${wallet.status}.`);
    console.error(JSON.stringify(wallet.body).slice(0, 500));
    process.exitCode = 1;
    return;
  }
  const walletData = record(record(wallet.body)?.data);
  const balance = walletData?.balance;
  console.log(`Wallet:        ₦${Number(balance ?? 0).toLocaleString('en-NG')}`);
  if (walletData?.user_type) console.log(`Account type:  ${String(walletData.user_type)}`);

  const plans = await get('/api/v2/vtu/data/plans/');
  if (plans.status !== 200) {
    console.error(`Catalogue check failed with HTTP ${plans.status}.`);
    console.error(JSON.stringify(plans.body).slice(0, 500));
    process.exitCode = 1;
    return;
  }
  const planList = record(plans.body)?.data;
  console.log(`Data plans:    ${Array.isArray(planList) ? planList.length : 0} live`);

  if (transactionId) {
    const status = await get(
      `/api/v2/anubis/transactions/${encodeURIComponent(transactionId)}/`,
    );
    console.log('');
    console.log(`Transaction:   ${transactionId}`);
    console.log(`HTTP:          ${status.status}`);
    console.log(JSON.stringify(status.body, null, 2).slice(0, 2_000));
  }

  console.log('');
  console.log('Credential check passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
