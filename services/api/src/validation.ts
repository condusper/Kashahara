import { z } from 'zod';
import { Errors } from './errors';

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw Errors.validation(
      'Some of the information you entered is not valid.',
      result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

export function parseQuery<T>(schema: z.ZodType<T>, query: unknown): T {
  return parseBody(schema, query);
}

export const emailSchema = z
  .string()
  .trim()
  .min(5)
  .max(254)
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

export const phoneSchema = z.string().trim().min(10).max(20);
export const nameSchema = z.string().trim().min(2).max(120);
export const pinSchema = z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits');
export const networkSchema = z.enum(['MTN', 'GLO', 'AIRTEL', '9MOBILE']);
export const meterTypeSchema = z.enum(['prepaid', 'postpaid']);
export const amountKoboSchema = z
  .number()
  .int('Amount must be in whole kobo')
  .positive('Enter an amount')
  .max(50_000_000, 'Amount is above the allowed limit');

export const FUNDING_MIN_KOBO = 10_000;
export const FUNDING_MAX_KOBO = 10_000_000;

export const fundingAmountKoboSchema = z
  .number()
  .int('Amount must be in whole kobo')
  .min(FUNDING_MIN_KOBO, 'Minimum wallet funding is ₦100')
  .max(FUNDING_MAX_KOBO, 'Maximum wallet funding is ₦100,000');
export const transactionTypeSchema = z.enum([
  'airtime',
  'data',
  'electricity',
  'cable',
  'exam',
  'wallet_funding',
]);
export const transactionStatusSchema = z.enum([
  'created',
  'awaiting_payment',
  'processing',
  'successful',
  'failed',
  'reversal_pending',
  'reversed',
  'refunded',
  'uncertain',
]);

export const idempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export function newIdempotencyKey(): string {
  return `mob-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
