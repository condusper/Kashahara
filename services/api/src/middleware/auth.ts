import type { RequestHandler } from 'express';
import type { Config } from '../config';
import { Errors } from '../errors';
import { verifyAccessToken } from '../crypto';
import type { Store, UserRecord } from '../types';

export function createRequireAuth(store: Store, config: Config): RequestHandler {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw Errors.unauthorized('Sign in to continue');
      }
      const token = header.slice('Bearer '.length).trim();
      const payload = verifyAccessToken(token, config.jwtSecret);
      if (!payload) {
        throw Errors.unauthorized('Your session has expired. Please sign in again.');
      }
      const user = await store.findUserById(payload.sub);
      if (!user) {
        throw Errors.unauthorized('Account is no longer available');
      }
      res.locals.user = user;
      res.locals.userId = user.id;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function currentUser(res: {
  locals: Record<string, unknown>;
}): UserRecord {
  const user = res.locals.user as UserRecord | undefined;
  if (!user) throw Errors.unauthorized();
  return user;
}

export function currentUserId(res: {
  locals: Record<string, unknown>;
}): string {
  const userId = res.locals.userId as string | undefined;
  if (!userId) throw Errors.unauthorized();
  return userId;
}
