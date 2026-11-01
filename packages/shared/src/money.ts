/**
 * Money is stored and transported as integer kobo. Never use floating point
 * arithmetic for wallet balances or prices.
 */

const MAX_SAFE_KOBO = Number.MAX_SAFE_INTEGER;

export function assertKobo(value: number, label = 'amount'): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_SAFE_KOBO) {
    throw new Error(`${label} must be a non-negative integer amount in kobo`);
  }
  return value;
}

/**
 * Parses user-entered naira into kobo.
 *
 * Accepts `1500`, `1,500`, `₦1,500.50`, `1500.5` and whitespace. Rejects
 * negative values and more than two decimal places.
 */
export function nairaToKobo(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) {
      throw new Error('Enter a valid amount');
    }
    const kobo = Math.round(input * 100);
    return assertKobo(kobo);
  }

  const cleaned = input
    .replace(/\u20a6/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();

  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error('Enter a valid amount with at most two decimal places');
  }

  const [whole = '0', fraction = ''] = cleaned.split('.');
  const paddedFraction = `${fraction}00`.slice(0, 2);
  const kobo = Number(whole) * 100 + Number(paddedFraction);

  if (!Number.isSafeInteger(kobo)) {
    throw new Error('Amount is too large');
  }
  return assertKobo(kobo);
}

export function koboToNaira(kobo: number): number {
  return assertKobo(kobo) / 100;
}

function groupDigits(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats kobo as `₦1,500.00` without relying on Intl being present in every
 * React Native engine.
 */
export function formatKobo(
  kobo: number,
  options: { symbol?: boolean; decimals?: boolean } = {},
): string {
  const { symbol = true, decimals = true } = options;
  const safe = assertKobo(kobo);
  const whole = Math.floor(safe / 100);
  const fraction = safe % 100;
  const body = decimals
    ? `${groupDigits(String(whole))}.${String(fraction).padStart(2, '0')}`
    : groupDigits(String(whole));
  return symbol ? `\u20a6${body}` : body;
}

/** Formats a naira input value (for example a form field) without a symbol. */
export function formatNairaInput(kobo: number): string {
  return formatKobo(kobo, { symbol: false, decimals: false });
}

export function formatNaira(valueInNaira: number): string {
  return formatKobo(nairaToKobo(valueInNaira));
}

export function sumKobo(values: readonly number[]): number {
  return values.reduce((total, value) => total + assertKobo(value), 0);
}

export function koboToPaystackAmount(kobo: number): number {
  // Paystack expects the smallest currency unit, which is kobo for NGN.
  return assertKobo(kobo);
}

export function paystackAmountToKobo(amount: number): number {
  return assertKobo(amount);
}
