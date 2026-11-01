import type { UserRecord } from '../types';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      rawBody?: Buffer;
      userRecord?: UserRecord;
    }
  }
}

export {};
