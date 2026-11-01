import type {
  AuthSessionResponse,
  UserProfile,
  WalletSummary,
} from '@kashahara/shared';
import { isValidNigerianPhone, normalizeNigerianPhone } from '@kashahara/shared';
import type { Config } from '../config';
import { AppError, Errors } from '../errors';
import {
  hashSecret,
  newId,
  randomDigits,
  randomToken,
  sha256Hex,
  signAccessToken,
  verifySecret,
} from '../crypto';
import type { Store, UserRecord } from '../types';
import { toUserProfile, toWalletSummary } from '../types';

export interface AuthContext {
  userAgent: string | null;
  ip: string | null;
}

export interface RegisterInput extends AuthContext {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginInput extends AuthContext {
  identifier: string;
  password: string;
}

export class AuthService {
  constructor(
    private readonly store: Store,
    private readonly config: Config,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private async createSession(
    store: Store,
    user: UserRecord,
    context: AuthContext,
  ): Promise<{ refreshToken: string; sessionId: string }> {
    const at = this.now();
    const refreshToken = randomToken(32);
    const sessionId = newId();
    await store.createSession({
      id: sessionId,
      userId: user.id,
      tokenHash: sha256Hex(refreshToken),
      expiresAt: new Date(
        at.getTime() + this.config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
      ),
      revokedAt: null,
      userAgent: context.userAgent,
      ip: context.ip,
      createdAt: at,
    });
    return { refreshToken, sessionId };
  }

  private async sessionResponse(
    store: Store,
    user: UserRecord,
    refreshToken: string,
  ): Promise<AuthSessionResponse> {
    const wallet = await store.getWalletByUserId(user.id);
    if (!wallet) {
      throw Errors.internal('Wallet is missing for this account');
    }
    const access = signAccessToken(
      user.id,
      this.config.jwtSecret,
      this.config.accessTokenTtlSeconds,
      this.now(),
    );
    return {
      accessToken: access.token,
      refreshToken,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      user: toUserProfile(user),
      wallet: toWalletSummary(wallet),
    };
  }

  async register(input: RegisterInput): Promise<AuthSessionResponse> {
    const email = input.email.trim().toLowerCase();
    const phone = normalizeNigerianPhone(input.phone);
    if (!isValidNigerianPhone(phone)) {
      throw Errors.validation('Enter a valid Nigerian phone number');
    }

    const passwordHash = await hashSecret(input.password);
    const at = this.now();

    return this.store.transaction(async (tx) => {
      const existingEmail = await tx.findUserByEmail(email);
      if (existingEmail) {
        throw Errors.conflict('An account with this email already exists');
      }
      const existingPhone = await tx.findUserByPhone(phone);
      if (existingPhone) {
        throw Errors.conflict('An account with this phone number already exists');
      }

      const user = await tx.createUser({
        id: newId(),
        fullName: input.fullName.trim(),
        email,
        phone,
        passwordHash,
        transactionPinHash: null,
        emailVerified: false,
        phoneVerified: false,
        createdAt: at,
        updatedAt: at,
      });
      await tx.createWallet({
        id: newId(),
        userId: user.id,
        balanceKobo: 0,
        currency: 'NGN',
        updatedAt: at,
      });
      const session = await this.createSession(tx, user, input);
      await tx.recordAudit({
        id: newId(),
        userId: user.id,
        action: 'auth.register',
        metadata: { email, phone },
        ip: input.ip,
        createdAt: at,
      });
      return this.sessionResponse(tx, user, session.refreshToken);
    });
  }

  async login(input: LoginInput): Promise<AuthSessionResponse> {
    const identifier = input.identifier.trim();
    const user = identifier.includes('@')
      ? await this.store.findUserByEmail(identifier)
      : await this.store.findUserByPhone(normalizeNigerianPhone(identifier));

    // Use the same error for an unknown account and a wrong password so the
    // endpoint does not disclose whether an account exists.
    if (!user || !(await verifySecret(input.password, user.passwordHash))) {
      throw Errors.unauthorized('Email/phone or password is incorrect');
    }

    return this.store.transaction(async (tx) => {
      const session = await this.createSession(tx, user, input);
      await tx.recordAudit({
        id: newId(),
        userId: user.id,
        action: 'auth.login',
        metadata: {},
        ip: input.ip,
        createdAt: this.now(),
      });
      return this.sessionResponse(tx, user, session.refreshToken);
    });
  }

  async refresh(refreshToken: string, context: AuthContext): Promise<AuthSessionResponse> {
    const session = await this.store.findSessionByTokenHash(sha256Hex(refreshToken));
    if (!session) throw Errors.unauthorized('Session is no longer valid');
    const at = this.now();
    if (session.revokedAt || session.expiresAt.getTime() <= at.getTime()) {
      throw Errors.unauthorized('Session has expired. Please sign in again.');
    }
    const user = await this.store.findUserById(session.userId);
    if (!user) throw Errors.unauthorized('Account is no longer available');

    return this.store.transaction(async (tx) => {
      await tx.revokeSession(session.id, at);
      const next = await this.createSession(tx, user, context);
      return this.sessionResponse(tx, user, next.refreshToken);
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.store.findSessionByTokenHash(sha256Hex(refreshToken));
    if (session) {
      await this.store.revokeSession(session.id, this.now());
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.store.revokeAllSessionsForUser(userId, this.now());
  }

  async me(userId: string): Promise<{ user: UserProfile; wallet: WalletSummary }> {
    const user = await this.store.findUserById(userId);
    if (!user) throw Errors.unauthorized('Account is no longer available');
    const wallet = await this.store.getWalletByUserId(userId);
    if (!wallet) throw Errors.internal('Wallet is missing for this account');
    return { user: toUserProfile(user), wallet: toWalletSummary(wallet) };
  }

  async updateProfile(
    userId: string,
    input: { fullName?: string; email?: string; phone?: string },
  ): Promise<UserProfile> {
    const current = await this.store.findUserById(userId);
    if (!current) throw Errors.unauthorized();

    const patch: {
      fullName?: string;
      email?: string;
      phone?: string;
      emailVerified?: boolean;
      phoneVerified?: boolean;
      updatedAt: Date;
    } = { updatedAt: this.now() };
    if (input.fullName !== undefined) patch.fullName = input.fullName.trim();
    if (input.email !== undefined) {
      const email = input.email.trim().toLowerCase();
      const owner = await this.store.findUserByEmail(email);
      if (owner && owner.id !== userId) {
        throw Errors.conflict('An account with this email already exists');
      }
      patch.email = email;
      // A new address has not been proven yet, even if the old one was verified.
      if (email !== current.email) patch.emailVerified = false;
    }
    if (input.phone !== undefined) {
      const phone = normalizeNigerianPhone(input.phone);
      if (!isValidNigerianPhone(phone)) {
        throw Errors.validation('Enter a valid Nigerian phone number');
      }
      const owner = await this.store.findUserByPhone(phone);
      if (owner && owner.id !== userId) {
        throw Errors.conflict('An account with this phone number already exists');
      }
      patch.phone = phone;
      if (phone !== current.phone) patch.phoneVerified = false;
    }
    const updated = await this.store.updateUser(userId, patch);
    return toUserProfile(updated);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.store.findUserById(userId);
    if (!user) throw Errors.unauthorized();
    if (!(await verifySecret(currentPassword, user.passwordHash))) {
      throw Errors.unauthorized('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw Errors.validation('Choose a password that is different from the current one');
    }
    await this.store.updateUser(userId, {
      passwordHash: await hashSecret(newPassword),
      updatedAt: this.now(),
    });
    await this.store.revokeAllSessionsForUser(userId, this.now());
    await this.store.recordAudit({
      id: newId(),
      userId,
      action: 'auth.password_changed',
      metadata: {},
      ip: null,
      createdAt: this.now(),
    });
  }

  async setTransactionPin(userId: string, password: string, pin: string): Promise<UserProfile> {
    if (!/^\d{4,6}$/.test(pin)) {
      throw Errors.validation('Transaction PIN must be 4 to 6 digits');
    }
    const user = await this.store.findUserById(userId);
    if (!user) throw Errors.unauthorized();
    if (!(await verifySecret(password, user.passwordHash))) {
      throw Errors.unauthorized('Password is incorrect');
    }
    const updated = await this.store.updateUser(userId, {
      transactionPinHash: await hashSecret(pin),
      updatedAt: this.now(),
    });
    await this.store.recordAudit({
      id: newId(),
      userId,
      action: 'auth.pin_set',
      metadata: {},
      ip: null,
      createdAt: this.now(),
    });
    return toUserProfile(updated);
  }

  async verifyTransactionPin(user: UserRecord, pin: string): Promise<void> {
    if (!user.transactionPinHash) {
      throw new AppError(
        409,
        'PIN_REQUIRED',
        'Set a transaction PIN in Account → Security before making a purchase.',
      );
    }
    if (!(await verifySecret(pin, user.transactionPinHash))) {
      throw new AppError(401, 'INVALID_PIN', 'Incorrect transaction PIN');
    }
  }

  async requestPasswordReset(
    identifier: string,
  ): Promise<{ message: string; devToken?: string }> {
    const trimmed = identifier.trim();
    const user = trimmed.includes('@')
      ? await this.store.findUserByEmail(trimmed)
      : await this.store.findUserByPhone(normalizeNigerianPhone(trimmed));

    const message =
      'If an account exists for that email or phone, a password reset instruction has been created.';
    if (!user) return { message };

    const at = this.now();
    const token = randomToken(32);
    await this.store.invalidateOneTimeTokens(user.id, 'password_reset', at);
    await this.store.createOneTimeToken({
      id: newId(),
      userId: user.id,
      kind: 'password_reset',
      tokenHash: sha256Hex(token),
      expiresAt: new Date(at.getTime() + 30 * 60 * 1000),
      usedAt: null,
      createdAt: at,
    });
    await this.store.recordAudit({
      id: newId(),
      userId: user.id,
      action: 'auth.password_reset_requested',
      metadata: {},
      ip: null,
      createdAt: at,
    });
    return this.config.allowDevCodes ? { message, devToken: token } : { message };
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const record = await this.store.findOneTimeTokenByHash(
      'password_reset',
      sha256Hex(token),
    );
    const at = this.now();
    if (!record || record.usedAt || record.expiresAt.getTime() <= at.getTime()) {
      throw Errors.validation('This reset link is invalid or has expired');
    }
    const user = await this.store.findUserById(record.userId);
    if (!user) throw Errors.validation('This reset link is no longer valid');
    await this.store.transaction(async (tx) => {
      await tx.updateUser(user.id, {
        passwordHash: await hashSecret(newPassword),
        updatedAt: at,
      });
      await tx.consumeOneTimeToken(record.id, at);
      await tx.revokeAllSessionsForUser(user.id, at);
      await tx.recordAudit({
        id: newId(),
        userId: user.id,
        action: 'auth.password_reset_completed',
        metadata: {},
        ip: null,
        createdAt: at,
      });
    });
  }

  async requestVerification(
    userId: string,
    channel: 'email' | 'phone',
  ): Promise<{ message: string; devCode?: string }> {
    const user = await this.store.findUserById(userId);
    if (!user) throw Errors.unauthorized();
    if (channel === 'email' && user.emailVerified) {
      return { message: 'Your email is already verified.' };
    }
    if (channel === 'phone' && user.phoneVerified) {
      return { message: 'Your phone number is already verified.' };
    }
    const at = this.now();
    const kind = channel === 'email' ? 'email_verify' : 'phone_verify';
    const code = randomDigits(6);
    await this.store.invalidateOneTimeTokens(user.id, kind, at);
    await this.store.createOneTimeToken({
      id: newId(),
      userId: user.id,
      kind,
      tokenHash: sha256Hex(code),
      expiresAt: new Date(at.getTime() + 15 * 60 * 1000),
      usedAt: null,
      createdAt: at,
    });
    await this.store.recordAudit({
      id: newId(),
      userId: user.id,
      action: `auth.verification_requested.${channel}`,
      metadata: {},
      ip: null,
      createdAt: at,
    });
    const message = this.config.allowDevCodes
      ? `Development mode: use the code shown below to verify your ${channel}. In production this is delivered by an email/SMS provider.`
      : `A verification code has been sent to your ${channel}.`;
    return this.config.allowDevCodes ? { message, devCode: code } : { message };
  }

  async confirmVerification(
    userId: string,
    channel: 'email' | 'phone',
    code: string,
  ): Promise<UserProfile> {
    const kind = channel === 'email' ? 'email_verify' : 'phone_verify';
    const record = await this.store.findOneTimeTokenByHash(kind, sha256Hex(code));
    const at = this.now();
    if (
      !record ||
      record.userId !== userId ||
      record.usedAt ||
      record.expiresAt.getTime() <= at.getTime()
    ) {
      throw Errors.validation('The verification code is invalid or has expired');
    }
    const updated = await this.store.transaction(async (tx) => {
      const user = await tx.updateUser(userId, {
        ...(channel === 'email' ? { emailVerified: true } : { phoneVerified: true }),
        updatedAt: at,
      });
      await tx.consumeOneTimeToken(record.id, at);
      await tx.recordAudit({
        id: newId(),
        userId,
        action: `auth.verification_completed.${channel}`,
        metadata: {},
        ip: null,
        createdAt: at,
      });
      return user;
    });
    return toUserProfile(updated);
  }
}
