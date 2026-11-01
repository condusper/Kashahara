import { Router } from 'express';
import { z } from 'zod';
import type { Config } from '../config';
import { newId } from '../crypto';
import { createRequireAuth, currentUserId } from '../middleware/auth';
import type { Store } from '../types';
import { parseBody } from '../validation';

const ticketSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(4000),
});

export const SUPPORT_FAQ = [
  {
    id: 'funding',
    question: 'How long does wallet funding take?',
    answer:
      'Paystack normally confirms a successful card or bank transfer within a few seconds. If the payment succeeds but your balance does not update, open the funding attempt and check its status before paying again.',
  },
  {
    id: 'uncertain',
    question: 'What does “Status uncertain” mean?',
    answer:
      'The supplier may have received your order but did not return a final result. We keep the wallet debit in place to prevent a double charge. Do not retry immediately. Refresh the transaction or contact support so we can reconcile it with the supplier.',
  },
  {
    id: 'receipts',
    question: 'Where can I find my receipts?',
    answer:
      'Every successful transaction has a receipt. Open the transaction from Activity and tap Download receipt to save a PNG image for your records.',
  },
  {
    id: 'refund',
    question: 'When will a failed purchase be refunded?',
    answer:
      'A confirmed supplier decline is reversed to your wallet automatically. A reversal appears as a separate credit in your wallet ledger. Contact support if a failed order has not been reversed.',
  },
  {
    id: 'pin',
    question: 'Why do I need a transaction PIN?',
    answer:
      'The PIN protects purchases if your phone is unlocked and left unattended. Set it under Account → Security. Your PIN is stored as a one-way hash and is never sent back to the app.',
  },
];

export function createSupportRouter(store: Store, config: Config): Router {
  const router = Router();
  const requireAuth = createRequireAuth(store, config);

  router.get('/faq', (_req, res) => {
    res.json({ items: SUPPORT_FAQ });
  });

  router.get('/tickets', requireAuth, async (_req, res, next) => {
    try {
      res.json({ items: await store.listSupportTickets(currentUserId(res)) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/tickets', requireAuth, async (req, res, next) => {
    try {
      const body = parseBody(ticketSchema, req.body);
      const ticket = await store.createSupportTicket({
        id: newId(),
        userId: currentUserId(res),
        subject: body.subject,
        message: body.message,
        status: 'open',
        createdAt: new Date(),
      });
      res.status(201).json({ ticket });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
