import { assertKobo } from './money';
import type { AirtimeFee } from './types';

/**
 * Default customer-facing charge on airtime, in percent of face value.
 *
 * Airtime supplier discounts are thinner than data margins, so the service fee
 * covers the payment-gateway cost and keeps every sale profitable.
 */
export const DEFAULT_AIRTIME_FEE: AirtimeFee = {
  percent: 2.5,
  minKobo: 100,
};

/**
 * Calculates the airtime service fee in kobo.
 *
 * The percentage is rounded up to the next whole Naira, then the configured
 * minimum (default ₦1) is applied. Integer basis points keep the result stable
 * across JavaScript engines. A zero amount has no fee.
 */
export function calculateAirtimeFeeKobo(
  amountKobo: number,
  fee: AirtimeFee = DEFAULT_AIRTIME_FEE,
): number {
  assertKobo(amountKobo, 'airtime amount');
  assertKobo(fee.minKobo, 'minimum airtime fee');
  if (!Number.isFinite(fee.percent) || fee.percent < 0) {
    throw new Error('airtime fee percent must be a non-negative number');
  }
  if (amountKobo === 0) return 0;

  const basisPoints = Math.round(fee.percent * 100);
  const rawKobo = (amountKobo * basisPoints) / 10_000;
  const roundedUpToNaira = Math.ceil(rawKobo / 100) * 100;
  return Math.max(fee.minKobo, roundedUpToNaira);
}
