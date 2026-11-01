import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../errors';
import { makeHarness, registerUser, setPin, TEST_EMAIL, TEST_PASSWORD, TEST_PIN } from './helpers';

describe('authentication', () => {
  it('registers a user, creates a zero wallet, and returns a session', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);

    assert.ok(session.accessToken.split('.').length === 3);
    assert.ok(session.refreshToken.length > 20);
    assert.equal(session.user.email, TEST_EMAIL);
    assert.equal(session.user.emailVerified, false);
    assert.equal(session.wallet.balanceKobo, 0);
    assert.equal(session.user.hasTransactionPin, false);

    const me = await harness.services.auth.me(session.user.id);
    assert.equal(me.wallet.balanceKobo, 0);
    assert.equal(me.user.fullName, 'Ada Okafor');
  });

  it('rejects duplicate email and phone numbers', async () => {
    const harness = makeHarness();
    await registerUser(harness);

    await assert.rejects(
      harness.services.auth.register({
        fullName: 'Another Person',
        email: TEST_EMAIL,
        phone: '08051234567',
        password: TEST_PASSWORD,
        userAgent: null,
        ip: null,
      }),
      (error: unknown) => error instanceof AppError && error.code === 'CONFLICT',
    );

    await assert.rejects(
      harness.services.auth.register({
        fullName: 'Another Person',
        email: 'another@example.test',
        phone: '08031234567',
        password: TEST_PASSWORD,
        userAgent: null,
        ip: null,
      }),
      (error: unknown) => error instanceof AppError && error.code === 'CONFLICT',
    );
  });

  it('signs in with email or phone and rejects a wrong password', async () => {
    const harness = makeHarness();
    await registerUser(harness);

    const byEmail = await harness.services.auth.login({
      identifier: TEST_EMAIL,
      password: TEST_PASSWORD,
      userAgent: null,
      ip: null,
    });
    assert.equal(byEmail.user.email, TEST_EMAIL);

    const byPhone = await harness.services.auth.login({
      identifier: '08031234567',
      password: TEST_PASSWORD,
      userAgent: null,
      ip: null,
    });
    assert.equal(byPhone.user.phone, '08031234567');

    await assert.rejects(
      harness.services.auth.login({
        identifier: TEST_EMAIL,
        password: 'WrongPass123',
        userAgent: null,
        ip: null,
      }),
      (error: unknown) => error instanceof AppError && error.status === 401,
    );
  });

  it('rotates refresh tokens and invalidates the previous token', async () => {
    const harness = makeHarness();
    const first = await registerUser(harness);

    const second = await harness.services.auth.refresh(first.refreshToken, {
      userAgent: null,
      ip: null,
    });
    assert.notEqual(second.refreshToken, first.refreshToken);

    await assert.rejects(
      harness.services.auth.refresh(first.refreshToken, { userAgent: null, ip: null }),
      (error: unknown) => error instanceof AppError && error.status === 401,
    );

    const third = await harness.services.auth.refresh(second.refreshToken, {
      userAgent: null,
      ip: null,
    });
    assert.notEqual(third.refreshToken, second.refreshToken);
  });

  it('sets a transaction PIN and verifies it', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);
    const user = await harness.store.findUserById(session.user.id);
    assert.ok(user);

    await assert.rejects(
      harness.services.auth.verifyTransactionPin(user, TEST_PIN),
      (error: unknown) => error instanceof AppError && error.code === 'PIN_REQUIRED',
    );

    await setPin(harness, user.id);
    const updated = await harness.store.findUserById(user.id);
    assert.ok(updated);
    await harness.services.auth.verifyTransactionPin(updated, TEST_PIN);

    await assert.rejects(
      harness.services.auth.verifyTransactionPin(updated, '9999'),
      (error: unknown) => error instanceof AppError && error.code === 'INVALID_PIN',
    );
  });

  it('completes a password reset with a one-time token', async () => {
    const harness = makeHarness();
    await registerUser(harness);

    const requested = await harness.services.auth.requestPasswordReset(TEST_EMAIL);
    assert.ok(requested.devToken);

    await harness.services.auth.resetPassword(requested.devToken, 'NewPass456!');
    const session = await harness.services.auth.login({
      identifier: TEST_EMAIL,
      password: 'NewPass456!',
      userAgent: null,
      ip: null,
    });
    assert.equal(session.user.email, TEST_EMAIL);

    await assert.rejects(
      harness.services.auth.resetPassword(requested.devToken, 'AnotherPass789!'),
      (error: unknown) => error instanceof AppError && error.status === 422,
    );
  });

  it('verifies an email address with a development code', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);
    const requested = await harness.services.auth.requestVerification(
      session.user.id,
      'email',
    );
    assert.ok(requested.devCode);

    const profile = await harness.services.auth.confirmVerification(
      session.user.id,
      'email',
      requested.devCode,
    );
    assert.equal(profile.emailVerified, true);
  });

  it('resets verification when the email or phone number changes', async () => {
    const harness = makeHarness();
    const session = await registerUser(harness);

    const emailCode = await harness.services.auth.requestVerification(session.user.id, 'email');
    await harness.services.auth.confirmVerification(session.user.id, 'email', emailCode.devCode!);
    const phoneCode = await harness.services.auth.requestVerification(session.user.id, 'phone');
    await harness.services.auth.confirmVerification(session.user.id, 'phone', phoneCode.devCode!);

    const afterEmail = await harness.services.auth.updateProfile(session.user.id, {
      email: 'new-address@example.test',
    });
    assert.equal(afterEmail.email, 'new-address@example.test');
    assert.equal(afterEmail.emailVerified, false);
    assert.equal(afterEmail.phoneVerified, true);

    const afterPhone = await harness.services.auth.updateProfile(session.user.id, {
      phone: '08051234567',
    });
    assert.equal(afterPhone.phone, '08051234567');
    assert.equal(afterPhone.phoneVerified, false);
  });
});
