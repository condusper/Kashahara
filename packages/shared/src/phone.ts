import type { Network } from './types';

/**
 * Nigerian mobile numbering prefixes.
 *
 * Number portability means a prefix is a hint, not proof of the current
 * operator. The API uses this for validation and for warning about mismatches;
 * a production supplier lookup should remain authoritative.
 */
export const NETWORK_PREFIXES: Record<Network, readonly string[]> = {
  MTN: [
    '0803',
    '0806',
    '0703',
    '0706',
    '0813',
    '0816',
    '0810',
    '0814',
    '0903',
    '0906',
    '0913',
    '0916',
    '0704',
  ],
  GLO: ['0805', '0807', '0705', '0815', '0811', '0905', '0915'],
  AIRTEL: [
    '0802',
    '0808',
    '0708',
    '0812',
    '0701',
    '0902',
    '0901',
    '0904',
    '0907',
    '0912',
  ],
  '9MOBILE': ['0809', '0817', '0818', '0908', '0909'],
};

export function normalizeNigerianPhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+234')) {
    return `0${digits.slice(4)}`;
  }
  if (digits.startsWith('234') && digits.length === 13) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith('0')) {
    return digits;
  }
  if (digits.length === 10) {
    return `0${digits}`;
  }
  return digits;
}

export function isValidNigerianPhone(input: string): boolean {
  return /^0[789][01]\d{8}$/.test(normalizeNigerianPhone(input));
}

export function detectNetwork(input: string): Network | null {
  const phone = normalizeNigerianPhone(input);
  if (!isValidNigerianPhone(phone)) {
    return null;
  }
  const prefix = phone.slice(0, 4);
  for (const [network, prefixes] of Object.entries(NETWORK_PREFIXES) as [
    Network,
    readonly string[],
  ][]) {
    if (prefixes.includes(prefix)) {
      return network;
    }
  }
  return null;
}

export function maskPhone(input: string): string {
  const phone = normalizeNigerianPhone(input);
  if (phone.length < 7) {
    return phone;
  }
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

export function maskIdentifier(input: string): string {
  if (input.length <= 4) {
    return '*'.repeat(input.length);
  }
  return `${'*'.repeat(Math.max(0, input.length - 4))}${input.slice(-4)}`;
}
