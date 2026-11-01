import type { FundingAttempt, Transaction } from '@kashahara/shared';
import { TRANSACTION_STATUS_LABELS, formatKobo } from '@kashahara/shared';
import { formatDateTime } from './format';

export interface ReceiptIdentity {
  name?: string;
  email?: string;
  phone?: string;
}

export type ReceiptTone = 'success' | 'failed' | 'info' | 'pending';

export interface ReceiptRow {
  label: string;
  value: string;
  mono?: boolean;
}

export interface ReceiptSecret {
  label: string;
  value: string;
}

/**
 * Everything the PNG renderer needs. Kept framework-free so the model can be
 * built (and unit-tested) without a React tree.
 */
export interface ReceiptModel {
  documentLabel: string;
  headline: string;
  /** Total paid or total credited, already formatted. */
  amount: string;
  /** Amount before fees, only set when a fee was charged. */
  subtotal?: string;
  /** Formatted fee, only set when a fee was charged. */
  fee?: string;
  /** Total paid, only set when a fee was charged. */
  total?: string;
  /** Contextual labels, e.g. airtime amount and service fee. */
  subtotalLabel?: string;
  feeLabel?: string;
  totalLabel?: string;
  status: string;
  tone: ReceiptTone;
  note: string;
  rows: ReceiptRow[];
  reference: string;
  issuedAt: string;
  preparedFor?: string;
  secrets: ReceiptSecret[];
  secretsTitle?: string;
  secretsHint?: string;
  filename: string;
}

export interface ReceiptFile {
  uri: string;
  /** True when the system share sheet was opened so the user can save it. */
  shared: boolean;
  /** The PNG is always written to the app's document directory. */
  saved: boolean;
}

const SUPPORT_EMAIL = 'support@kashahara.com';

function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 40) || 'receipt';
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function transactionTone(status: Transaction['status']): ReceiptTone {
  switch (status) {
    case 'successful':
      return 'success';
    case 'failed':
      return 'failed';
    case 'refunded':
    case 'reversed':
      return 'info';
    case 'uncertain':
    case 'reversal_pending':
      return 'pending';
    case 'processing':
    case 'awaiting_payment':
      return 'info';
    default:
      return 'pending';
  }
}

function transactionNote(status: Transaction['status']): string {
  switch (status) {
    case 'successful':
      return 'Payment completed successfully.';
    case 'failed':
      return 'This transaction did not go through.';
    case 'refunded':
      return 'Refunded to your wallet.';
    case 'reversed':
      return 'Reversed and returned to your wallet.';
    case 'uncertain':
      return 'Awaiting confirmation from the provider.';
    case 'processing':
      return 'Your payment is being processed.';
    case 'reversal_pending':
      return 'A reversal is being processed.';
    case 'created':
      return 'Waiting for payment.';
    case 'awaiting_payment':
      return 'Waiting for payment confirmation.';
    default:
      return 'Keep this receipt for your records.';
  }
}

function transactionHeadline(transaction: Transaction): string {
  const details = transaction.details ?? {};
  switch (transaction.type) {
    case 'airtime':
      return `${transaction.recipient.network ?? 'Airtime'} airtime`;
    case 'data':
      return `${transaction.recipient.network ?? 'Data'} ${text(details.allowance) || 'data'}`;
    case 'electricity':
      return 'Electricity payment';
    case 'cable':
      return text(details.packageName) || 'Cable subscription';
    case 'exam':
      return text(details.productName) || 'Exam voucher';
    case 'wallet_funding':
      return 'Wallet top-up';
    default:
      return 'Transaction';
  }
}

function transactionRows(transaction: Transaction): ReceiptRow[] {
  const details = transaction.details ?? {};
  const rows: ReceiptRow[] = [];
  const push = (label: string, value: unknown, mono = false) => {
    const formatted = text(value);
    if (formatted) rows.push({ label, value: formatted, mono });
  };

  switch (transaction.type) {
    case 'airtime':
      push('Service', `Airtime · ${transaction.recipient.network ?? '—'}`);
      push('Recipient', transaction.recipient.phone);
      break;
    case 'data':
      push('Service', `Data · ${transaction.recipient.network ?? '—'}`);
      push('Recipient', transaction.recipient.phone);
      push('Plan', details.allowance ?? details.planName);
      break;
    case 'electricity':
      push('Service', 'Electricity');
      push('Provider', details.billerName ?? details.billerId);
      push('Meter', details.meterNumber ?? transaction.recipient.meterNumber, true);
      push('Customer', details.customerName);
      break;
    case 'cable':
      push('Service', 'Cable TV');
      push('Provider', details.providerName);
      push('Package', details.packageName);
      push('Smartcard', details.smartcardNumber ?? transaction.recipient.smartcardNumber, true);
      break;
    case 'exam':
      push('Service', 'Exam PINs');
      push('Product', details.productName);
      push('Quantity', details.quantity);
      break;
    case 'wallet_funding':
      push('Service', 'Wallet top-up');
      push('Method', 'Paystack');
      break;
    default:
      break;
  }

  push('Reference', transaction.reference, true);
  push('Provider ref', transaction.providerReference, true);
  if (transaction.failureReason) push('Reason', transaction.failureReason);

  return rows;
}

function readVouchers(value: unknown): { pin: string; serial: string }[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    return {
      pin: text(record.pin),
      serial: text(record.serial),
    };
  });
}

function transactionSecrets(transaction: Transaction): {
  secrets: ReceiptSecret[];
  title?: string;
  hint?: string;
} {
  const token = text(transaction.details?.token);
  if (token) {
    return {
      secrets: [{ label: 'Prepaid token', value: token }],
      title: 'Meter token',
      hint: 'Load this token on your meter to get the units.',
    };
  }

  const vouchers = readVouchers(transaction.details?.vouchers);
  if (vouchers.length > 0) {
    return {
      secrets: vouchers.map((voucher, index) => ({
        label: voucher.serial ? `Serial ${voucher.serial}` : `PIN ${index + 1}`,
        value: voucher.pin || '—',
      })),
      title: `Exam PINs · ${vouchers.length}`,
      hint: 'Each PIN can only be used once. Keep this receipt private.',
    };
  }

  return { secrets: [] };
}

export function transactionReceipt(
  transaction: Transaction,
  identity?: ReceiptIdentity,
): ReceiptModel {
  const feeKobo = Math.max(0, transaction.feeKobo);
  const secrets = transactionSecrets(transaction);
  const airtimeFee = transaction.type === 'airtime' && feeKobo > 0;

  return {
    documentLabel: 'Payment receipt',
    headline: transactionHeadline(transaction),
    amount: formatKobo(transaction.totalKobo || transaction.amountKobo),
    ...(feeKobo > 0
      ? {
          subtotal: formatKobo(transaction.amountKobo),
          fee: formatKobo(feeKobo),
          total: formatKobo(transaction.amountKobo + feeKobo),
          subtotalLabel: airtimeFee ? 'Airtime amount' : undefined,
          feeLabel: airtimeFee ? 'Service fee' : undefined,
          totalLabel: airtimeFee ? 'Total debit' : undefined,
        }
      : {}),
    status: TRANSACTION_STATUS_LABELS[transaction.status] ?? transaction.status,
    tone: transactionTone(transaction.status),
    note: transactionNote(transaction.status),
    rows: transactionRows(transaction),
    reference: transaction.reference,
    issuedAt: formatDateTime(transaction.completedAt ?? transaction.createdAt),
    preparedFor: text(identity?.name) || undefined,
    secrets: secrets.secrets,
    secretsTitle: secrets.title,
    secretsHint: secrets.hint,
    filename: `kashahara-receipt-${safeFilePart(transaction.reference)}.png`,
  };
}

function fundingStatus(attempt: FundingAttempt): {
  label: string;
  tone: ReceiptTone;
  note: string;
} {
  switch (attempt.status) {
    case 'successful':
      return {
        label: 'Successful',
        tone: 'success',
        note: 'Your wallet was credited successfully.',
      };
    case 'failed':
      return {
        label: 'Failed',
        tone: 'failed',
        note: 'This top-up did not complete.',
      };
    case 'abandoned':
      return {
        label: 'Cancelled',
        tone: 'info',
        note: 'Cancelled before payment was confirmed.',
      };
    default:
      return {
        label: 'Awaiting payment',
        tone: 'pending',
        note: 'Waiting for payment confirmation.',
      };
  }
}

export function fundingReceipt(
  attempt: FundingAttempt,
  identity?: ReceiptIdentity,
): ReceiptModel {
  const status = fundingStatus(attempt);
  const rows: ReceiptRow[] = [
    { label: 'Service', value: 'Wallet top-up' },
    { label: 'Method', value: 'Paystack' },
    { label: 'Reference', value: attempt.reference, mono: true },
  ];
  if (attempt.providerReference) {
    rows.push({ label: 'Provider ref', value: attempt.providerReference, mono: true });
  }

  return {
    documentLabel: 'Wallet receipt',
    headline: 'Wallet top-up',
    amount: formatKobo(attempt.amountKobo),
    status: status.label,
    tone: status.tone,
    note: status.note,
    rows,
    reference: attempt.reference,
    issuedAt: formatDateTime(attempt.completedAt ?? attempt.createdAt),
    preparedFor: text(identity?.name) || undefined,
    secrets: [],
    filename: `kashahara-topup-${safeFilePart(attempt.reference)}.png`,
  };
}

export { SUPPORT_EMAIL };
