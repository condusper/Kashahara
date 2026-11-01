import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateAirtimeFeeKobo,
  detectNetwork,
  formatKobo,
  isValidNigerianPhone,
  maskPhone,
  nairaToKobo,
  normalizeNigerianPhone,
} from '@kashahara/shared';

describe('Nigerian phone helpers', () => {
  it('normalises local, international, and spaced formats', () => {
    assert.equal(normalizeNigerianPhone('08031234567'), '08031234567');
    assert.equal(normalizeNigerianPhone('+2348031234567'), '08031234567');
    assert.equal(normalizeNigerianPhone('2348031234567'), '08031234567');
    assert.equal(normalizeNigerianPhone('0803 123 4567'), '08031234567');
    assert.equal(normalizeNigerianPhone('8031234567'), '08031234567');
  });

  it('accepts valid Nigerian mobile numbers and rejects invalid ones', () => {
    assert.equal(isValidNigerianPhone('08031234567'), true);
    assert.equal(isValidNigerianPhone('09091234567'), true);
    assert.equal(isValidNigerianPhone('07051234567'), true);
    assert.equal(isValidNigerianPhone('0812345678'), false);
    assert.equal(isValidNigerianPhone('06031234567'), false);
    assert.equal(isValidNigerianPhone(''), false);
  });

  it('detects a network as a hint, not a guarantee', () => {
    assert.equal(detectNetwork('08031234567'), 'MTN');
    assert.equal(detectNetwork('09091234567'), '9MOBILE');
    assert.equal(detectNetwork('123'), null);
  });

  it('masks a phone number for display', () => {
    assert.equal(maskPhone('08031234567'), '0803***567');
  });
});

describe('money helpers', () => {
  it('formats integer kobo without floating point drift', () => {
    assert.equal(formatKobo(150_000), '₦1,500.00');
    assert.equal(formatKobo(0), '₦0.00');
    assert.equal(formatKobo(5_050), '₦50.50');
    assert.equal(formatKobo(150_000, { symbol: false, decimals: false }), '1,500');
  });

  it('parses naira input into integer kobo', () => {
    assert.equal(nairaToKobo('1,500'), 150_000);
    assert.equal(nairaToKobo('₦ 50.50'), 5_050);
    assert.equal(nairaToKobo('1500.5'), 150_050);
    assert.equal(nairaToKobo(12.34), 1_234);
  });

  it('rejects invalid amounts', () => {
    assert.throws(() => nairaToKobo('10.999'));
    assert.throws(() => nairaToKobo('abc'));
    assert.throws(() => nairaToKobo(''));
    assert.throws(() => nairaToKobo(-1));
  });

  it('rejects unsafe or negative kobo values', () => {
    assert.throws(() => formatKobo(-1));
    assert.throws(() => formatKobo(1.5));
  });
});

describe('airtime fee', () => {
  it('charges 2.5%, rounded up to the next whole Naira', () => {
    // ₦50 * 2.5% = ₦1.25, so the fee rounds up to ₦2.
    assert.equal(calculateAirtimeFeeKobo(5_000), 200);
    // ₦100 * 2.5% = ₦2.50, so the fee rounds up to ₦3.
    assert.equal(calculateAirtimeFeeKobo(10_000), 300);
    // ₦1,000 * 2.5% = exactly ₦25.
    assert.equal(calculateAirtimeFeeKobo(100_000), 2_500);
  });

  it('applies the ₦1 minimum to small top-ups', () => {
    assert.equal(calculateAirtimeFeeKobo(2_000), 100);
    assert.equal(
      calculateAirtimeFeeKobo(2_000, { percent: 0, minKobo: 100 }),
      100,
    );
    assert.equal(calculateAirtimeFeeKobo(0), 0);
  });

  it('honours a custom percentage and minimum', () => {
    assert.equal(
      calculateAirtimeFeeKobo(10_000, { percent: 5, minKobo: 0 }),
      500,
    );
    assert.equal(
      calculateAirtimeFeeKobo(10_000, { percent: 0, minKobo: 0 }),
      0,
    );
  });
});
