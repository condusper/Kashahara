import { describe, expect, it } from 'vitest';
import {
  formatNaira,
  isValidNigerianPhone,
  normalizeNigerianPhone,
  parseNairaToKobo,
  suggestNetwork,
  toLocalPhone,
} from '../src/index';

describe('Nigerian phone validation', () => {
  it.each([
    ['08031234567', '+2348031234567'],
    ['0803 123 4567', '+2348031234567'],
    ['+2348031234567', '+2348031234567'],
    ['2348031234567', '+2348031234567'],
    ['09091234567', '+2349091234567'],
    ['07051234567', '+2347051234567'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeNigerianPhone(input)).toBe(expected);
  });

  it.each(['0812345678', '12345', '0703123456a', '06031234567', '', '+234 0803 123'])(
    'rejects %s',
    (input) => {
      expect(isValidNigerianPhone(input)).toBe(false);
    },
  );

  it('round-trips to local format', () => {
    expect(toLocalPhone('+2348031234567')).toBe('08031234567');
  });

  it('suggests but does not decide a network', () => {
    expect(suggestNetwork('08031234567')).toBe('MTN');
    expect(suggestNetwork('09091234567')).toBe('9MOBILE');
    expect(suggestNetwork('123')).toBeNull();
  });
});

describe('money helpers', () => {
  it('formats integer kobo as naira', () => {
    expect(formatNaira(150_000)).toBe('₦1,500.00');
    expect(formatNaira(0)).toBe('₦0.00');
  });

  it('parses naira input without floating point drift', () => {
    expect(parseNairaToKobo('1,500')).toBe(150_000);
    expect(parseNairaToKobo('₦ 50.50')).toBe(5_050);
    expect(parseNairaToKobo('10.999')).toBeNull();
    expect(parseNairaToKobo('abc')).toBeNull();
    expect(parseNairaToKobo('')).toBeNull();
  });
});
