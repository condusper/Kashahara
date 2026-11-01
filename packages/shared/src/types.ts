/**
 * Shared domain types for the Kashahara mobile app and API.
 *
 * These types are intentionally free of runtime dependencies so that they can
 * be consumed by React Native, the Express API, and tests.
 */

export const NETWORK_IDS = ['MTN', 'GLO', 'AIRTEL', '9MOBILE'] as const;
export type Network = (typeof NETWORK_IDS)[number];

export const SERVICE_TYPES = [
  'airtime',
  'data',
  'electricity',
  'cable',
  'exam',
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const TRANSACTION_TYPES = [...SERVICE_TYPES, 'wallet_funding'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/**
 * `uncertain` is used when a provider may have received a billable request but
 * did not return a definitive result. The wallet debit is intentionally kept in
 * place until reconciliation, and the UI must never describe it as successful.
 */
export const TRANSACTION_STATUSES = [
  'created',
  'awaiting_payment',
  'processing',
  'successful',
  'failed',
  'reversal_pending',
  'reversed',
  'refunded',
  'uncertain',
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const FINAL_TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  'successful',
  'failed',
  'reversed',
  'refunded',
];

export const LEDGER_DIRECTIONS = ['credit', 'debit'] as const;
export type LedgerDirection = (typeof LEDGER_DIRECTIONS)[number];

export type MeterType = 'prepaid' | 'postpaid';

export interface DemoMarker {
  /**
   * Development fixtures set this to `true`; supplier-backed catalogue data
   * sets it to `false` so the app can tell the two apart.
   */
  isDemo: boolean;
}

export interface NetworkOption extends DemoMarker {
  id: Network;
  name: string;
  shortName: string;
  color: string;
  prefixes: readonly string[];
}

export interface DataPlan extends DemoMarker {
  id: string;
  network: Network;
  name: string;
  allowance: string;
  validity: string;
  priceKobo: number;
  category: 'SME' | 'Corporate' | 'Direct' | 'Gifting';
}

export interface ElectricityBiller extends DemoMarker {
  id: string;
  name: string;
  shortName: string;
  state: string;
  meterTypes: readonly MeterType[];
}

export interface CablePackage extends DemoMarker {
  id: string;
  name: string;
  priceKobo: number;
  validity: string;
  description: string;
}

export interface CableProvider extends DemoMarker {
  id: string;
  name: string;
  shortName: string;
  packages: readonly CablePackage[];
}

export interface ExamProduct extends DemoMarker {
  id: string;
  name: string;
  provider: string;
  description: string;
  priceKobo: number;
}

export interface AirtimeFee {
  /** Percentage of face value charged as a service fee. */
  percent: number;
  /** Lowest fee in kobo, so very small top-ups still cover gateway costs. */
  minKobo: number;
}

export interface Catalog extends DemoMarker {
  version: string;
  notice: string;
  networks: readonly NetworkOption[];
  dataPlans: readonly DataPlan[];
  electricityBillers: readonly ElectricityBiller[];
  cableProviders: readonly CableProvider[];
  examProducts: readonly ExamProduct[];
  /** The platform fee the API applies to airtime purchases. */
  airtimeFee: AirtimeFee;
}

export interface Money {
  amountKobo: number;
  currency: 'NGN';
}

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  hasTransactionPin: boolean;
  createdAt: string;
}

export interface WalletSummary {
  id: string;
  balanceKobo: number;
  currency: 'NGN';
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  direction: LedgerDirection;
  amountKobo: number;
  balanceAfterKobo: number;
  reference: string;
  kind: string;
  createdAt: string;
}

export interface Recipient {
  name?: string;
  phone?: string;
  network?: string;
  meterNumber?: string;
  smartcardNumber?: string;
  billerId?: string;
  providerId?: string;
}

export interface Transaction {
  id: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amountKobo: number;
  feeKobo: number;
  totalKobo: number;
  currency: 'NGN';
  recipient: Recipient;
  details: Record<string, unknown>;
  providerReference: string | null;
  failureReason: string | null;
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface FundingAttempt {
  id: string;
  reference: string;
  amountKobo: number;
  status: 'awaiting_payment' | 'successful' | 'failed' | 'abandoned';
  provider: 'paystack' | 'simulated';
  providerReference: string | null;
  authorizationUrl: string | null;
  /**
   * Deep link Paystack redirects to after checkout. Present for Paystack
   * attempts so the app can close the browser and show the funding result.
   */
  callbackUrl?: string | null;
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export interface AuthSessionResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  user: UserProfile;
  wallet: WalletSummary;
}

export const NETWORK_LABELS: Record<Network, string> = {
  MTN: 'MTN',
  GLO: 'Glo',
  AIRTEL: 'Airtel',
  '9MOBILE': '9mobile',
};

export const SERVICE_LABELS: Record<ServiceType, string> = {
  airtime: 'Airtime',
  data: 'Mobile data',
  electricity: 'Electricity',
  cable: 'Cable TV',
  exam: 'Exam PINs',
};

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  created: 'Created',
  awaiting_payment: 'Awaiting payment',
  processing: 'Processing',
  successful: 'Successful',
  failed: 'Failed',
  reversal_pending: 'Reversal pending',
  reversed: 'Reversed',
  refunded: 'Refunded',
  uncertain: 'Status uncertain',
};

export const TRANSACTION_STATUS_EXPLANATIONS: Record<TransactionStatus, string> = {
  created: 'The order has been created but has not been sent yet.',
  awaiting_payment: 'We are waiting for the payment provider to confirm your payment.',
  processing: 'The provider is processing this order. Do not retry yet.',
  successful: 'The provider confirmed this order was completed.',
  failed: 'The provider declined this order. Any wallet debit is being reversed.',
  reversal_pending: 'A reversal has been requested and is waiting to complete.',
  reversed: 'The wallet debit was reversed. The order did not complete.',
  refunded: 'The order did not complete and your wallet has been refunded.',
  uncertain:
    'The provider did not return a definitive result. We have kept the debit in place to prevent a double charge. Refresh the status or contact support.',
};
