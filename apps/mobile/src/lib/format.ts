import type { Transaction, TransactionStatus, TransactionType } from '@kashahara/shared';
import { TRANSACTION_STATUS_LABELS, formatKobo, maskPhone } from '@kashahara/shared';

export { formatKobo, maskPhone };
export { nairaToKobo } from '@kashahara/shared';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'K';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}

export function formatNairaInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const [whole = '', fraction = ''] = cleaned.split('.');
  const normalizedWhole = whole.replace(/^0+(?=\d)/, '');
  if (fraction.length > 0) {
    return `${normalizedWhole || '0'}.${fraction.slice(0, 2)}`;
  }
  return normalizedWhole;
}

export function formatAmountInput(kobo: number): string {
  if (kobo <= 0) return '';
  return (kobo / 100).toFixed(kobo % 100 === 0 ? 0 : 2);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-NG', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  if (days === 0) return `Today · ${formatTime(iso)}`;
  if (days === 1) return `Yesterday · ${formatTime(iso)}`;
  if (days > 1 && days < 7) {
    return `${date.toLocaleDateString('en-NG', { weekday: 'long' })} · ${formatTime(iso)}`;
  }
  return formatDate(iso);
}

export function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function transactionTitle(transaction: Transaction): string {
  const details = transaction.details ?? {};
  switch (transaction.type) {
    case 'airtime':
      return `${transaction.recipient.network ?? 'Airtime'} airtime`;
    case 'data':
      return `${transaction.recipient.network ?? 'Data'} ${String(details.allowance ?? 'data')}`;
    case 'electricity':
      return String(details.customerName ?? details.billerId ?? 'Electricity');
    case 'cable':
      return String(details.packageName ?? 'Cable subscription');
    case 'exam':
      return String(details.productName ?? 'Exam voucher');
    case 'wallet_funding':
      return 'Wallet funding';
    default:
      return 'Transaction';
  }
}

export function transactionSubtitle(transaction: Transaction): string {
  switch (transaction.type) {
    case 'airtime':
    case 'data':
      return maskPhone(String(transaction.recipient.phone ?? ''));
    case 'electricity':
      return `Meter ${String(transaction.details.meterNumber ?? '')}`;
    case 'cable':
      return `Smartcard ${String(transaction.details.smartcardNumber ?? '')}`;
    case 'exam':
      return `${String(transaction.details.quantity ?? 1)} × ${String(
        transaction.details.provider ?? 'voucher',
      )}`;
    case 'wallet_funding':
      return 'Paystack';
    default:
      return '';
  }
}

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

export function statusTone(status: TransactionStatus): Tone {
  switch (status) {
    case 'successful':
      return 'success';
    case 'failed':
      return 'danger';
    case 'refunded':
    case 'reversed':
      return 'info';
    case 'uncertain':
    case 'reversal_pending':
      return 'warning';
    case 'processing':
    case 'awaiting_payment':
      return 'info';
    default:
      return 'neutral';
  }
}

export function statusLabel(status: TransactionStatus): string {
  return TRANSACTION_STATUS_LABELS[status] ?? status;
}

export function serviceLabel(type: TransactionType): string {
  switch (type) {
    case 'airtime':
      return 'Airtime';
    case 'data':
      return 'Data';
    case 'electricity':
      return 'Electricity';
    case 'cable':
      return 'Cable TV';
    case 'exam':
      return 'Exam PINs';
    case 'wallet_funding':
      return 'Wallet';
    default:
      return 'Transaction';
  }
}

export function truncate(value: string, length = 18): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}
