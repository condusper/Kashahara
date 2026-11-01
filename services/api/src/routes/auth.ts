import { Router } from 'express';
import { z } from 'zod';
import type { Config } from '../config';
import type { AuthService } from '../services/auth';
import type { Store } from '../types';
import { createRequireAuth, currentUserId } from '../middleware/auth';
import { rateLimit, type RateLimitStore } from '../middleware/rateLimit';
import {
  emailSchema,
  nameSchema,
  parseBody,
  passwordSchema,
  phoneSchema,
  pinSchema,
} from '../validation';

const registerSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({ refreshToken: z.string().min(20).max(500) });
const profileSchema = z
  .object({
    fullName: nameSchema.optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

const setPinSchema = z.object({
  password: z.string().min(1).max(128),
  pin: pinSchema,
});

const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
});

const resetPasswordSchema = z.object({
  token: z.string().min(20).max(500),
  newPassword: passwordSchema,
});

const verificationRequestSchema = z.object({ channel: z.enum(['email', 'phone']) });
const verificationConfirmSchema = z.object({
  channel: z.enum(['email', 'phone']),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export function createAuthRouter(
  auth: AuthService,
  store: Store,
  config: Config,
  rateLimitStore: RateLimitStore,
): Router {
  const router = Router();
  const requireAuth = createRequireAuth(store, config);
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: config.authRateLimitMaxAttempts,
    message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
    prefix: 'auth',
    store: rateLimitStore,
    key: (req) =>
      `${req.ip ?? 'unknown'}:${String(req.body?.identifier ?? req.body?.email ?? req.body?.phone ?? '')}`,
  });
  const pinLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many PIN attempts. Please wait and try again.',
    prefix: 'pin',
    store: rateLimitStore,
    key: (_req, res) => String(res.locals.userId ?? 'anonymous'),
  });

  router.post('/register', authLimiter, async (req, res, next) => {
    try {
      const body = parseBody(registerSchema, req.body);
      const session = await auth.register({
        ...body,
        userAgent: req.get('user-agent') ?? null,
        ip: req.ip ?? null,
      });
      res.status(201).json(session);
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', authLimiter, async (req, res, next) => {
    try {
      const body = parseBody(loginSchema, req.body);
      const session = await auth.login({
        ...body,
        userAgent: req.get('user-agent') ?? null,
        ip: req.ip ?? null,
      });
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      const body = parseBody(refreshSchema, req.body);
      const session = await auth.refresh(body.refreshToken, {
        userAgent: req.get('user-agent') ?? null,
        ip: req.ip ?? null,
      });
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      const body = parseBody(refreshSchema, req.body);
      await auth.logout(body.refreshToken);
      res.json({ message: 'Signed out.' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout-all', requireAuth, async (_req, res, next) => {
    try {
      await auth.logoutAll(currentUserId(res));
      res.json({ message: 'All sessions have been signed out.' });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', requireAuth, async (_req, res, next) => {
    try {
      res.json(await auth.me(currentUserId(res)));
    } catch (error) {
      next(error);
    }
  });

  router.patch('/me', requireAuth, async (req, res, next) => {
    try {
      const body = parseBody(profileSchema, req.body);
      const profile = await auth.updateProfile(currentUserId(res), body);
      res.json({ user: profile });
    } catch (error) {
      next(error);
    }
  });

  router.post('/change-password', requireAuth, authLimiter, async (req, res, next) => {
    try {
      const body = parseBody(changePasswordSchema, req.body);
      await auth.changePassword(
        currentUserId(res),
        body.currentPassword,
        body.newPassword,
      );
      res.json({
        message:
          'Password changed. For your security, all other sessions have been signed out.',
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/transaction-pin', requireAuth, pinLimiter, async (req, res, next) => {
    try {
      const body = parseBody(setPinSchema, req.body);
      const profile = await auth.setTransactionPin(
        currentUserId(res),
        body.password,
        body.pin,
      );
      res.json({ user: profile, message: 'Transaction PIN saved.' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/forgot-password', authLimiter, async (req, res, next) => {
    try {
      const body = parseBody(forgotPasswordSchema, req.body);
      res.json(await auth.requestPasswordReset(body.identifier));
    } catch (error) {
      next(error);
    }
  });

  router.post('/reset-password', authLimiter, async (req, res, next) => {
    try {
      const body = parseBody(resetPasswordSchema, req.body);
      await auth.resetPassword(body.token, body.newPassword);
      res.json({ message: 'Password reset. Sign in with your new password.' });
    } catch (error) {
      next(error);
    }
  });

  router.post('/verify/request', requireAuth, authLimiter, async (req, res, next) => {
    try {
      const body = parseBody(verificationRequestSchema, req.body);
      res.json(await auth.requestVerification(currentUserId(res), body.channel));
    } catch (error) {
      next(error);
    }
  });

  router.post('/verify/confirm', requireAuth, authLimiter, async (req, res, next) => {
    try {
      const body = parseBody(verificationConfirmSchema, req.body);
      const profile = await auth.confirmVerification(
        currentUserId(res),
        body.channel,
        body.code,
      );
      res.json({ user: profile, message: 'Verification complete.' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
