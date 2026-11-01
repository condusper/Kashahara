import type {
  LedgerDirection,
  MeterType,
  TransactionStatus,
  TransactionType,
  UserProfile,
  WalletSummary,
} from '@kashahara/shared';

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  transactionPinHash: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UserPatch = Partial<
  Pick<
    UserRecord,
    | 'fullName'
    | 'email'
    | 'phone'
    | 'passwordHash'
    | 'transactionPinHash'
    | 'emailVerified'
    | 'phoneVerified'
    | 'updatedAt'
  >
>;

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
  createdAt: Date;
}

export interface WalletRecord {
  id: string;
  userId: string;
  balanceKobo: number;
  currency: 'NGN';
  updatedAt: Date;
}

export interface LedgerRecord {
  id: string;
  walletId: string;
  userId: string;
  direction: LedgerDirection;
  amountKobo: number;
  balanceAfterKobo: number;
  reference: string;
  kind: string;
  transactionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface TransactionRecord {
  id: string;
  userId: string;
  reference: string;
  type: TransactionType;
  status: TransactionStatus;
  amountKobo: number;
  feeKobo: number;
  currency: 'NGN';
  recipient: Record<string, unknown>;
  details: Record<string, unknown>;
  providerReference: string | null;
  failureReason: string | null;
  simulated: boolean;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export type TransactionPatch = Partial<
  Pick<
    TransactionRecord,
    | 'status'
    | 'details'
    | 'providerReference'
    | 'failureReason'
    | 'simulated'
    | 'completedAt'
    | 'updatedAt'
  >
>;

export interface FundingRecord {
  id: string;
  userId: string;
  reference: string;
  amountKobo: number;
  status: 'awaiting_payment' | 'successful' | 'failed' | 'abandoned';
  provider: 'paystack' | 'simulated';
  providerReference: string | null;
  authorizationUrl: string | null;
  simulated: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export type FundingPatch = Partial<
  Pick<
    FundingRecord,
    | 'status'
    | 'providerReference'
    | 'authorizationUrl'
    | 'simulated'
    | 'metadata'
    | 'completedAt'
    | 'updatedAt'
  >
>;

export interface IdempotencyRecord {
  id: string;
  userId: string;
  key: string;
  requestHash: string;
  status: 'in_progress' | 'completed';
  responseStatus: number | null;
  responseBody: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEventRecord {
  id: string;
  userId: string | null;
  action: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: Date;
}

export interface WebhookEventRecord {
  id: string;
  provider: string;
  eventType: string;
  payloadHash: string;
  processedAt: Date;
}

export interface ProviderRequestRecord {
  id: string;
  transactionId: string | null;
  provider: string;
  operation: string;
  request: Record<string, unknown>;
  response: Record<string, unknown> | null;
  status: 'success' | 'failed' | 'uncertain';
  createdAt: Date;
}

export interface SupportTicketRecord {
  id: string;
  userId: string;
  subject: string;
  message: string;
  status: 'open' | 'closed';
  createdAt: Date;
}

export type OneTimeTokenKind = 'password_reset' | 'email_verify' | 'phone_verify';

export interface OneTimeTokenRecord {
  id: string;
  userId: string;
  kind: OneTimeTokenKind;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface TransactionFilter {
  type?: TransactionType;
  status?: TransactionStatus;
  limit: number;
  cursor?: string | null;
}

export interface TransactionPage {
  items: TransactionRecord[];
  nextCursor: string | null;
}

export interface Store {
  readonly kind: 'memory' | 'postgres';

  /** Runs work atomically. Nested transactions are not supported. */
  transaction<T>(work: (tx: Store) => Promise<T>): Promise<T>;

  createUser(user: UserRecord): Promise<UserRecord>;
  findUserById(id: string): Promise<UserRecord | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserByPhone(phone: string): Promise<UserRecord | null>;
  updateUser(id: string, patch: UserPatch): Promise<UserRecord>;

  createSession(session: SessionRecord): Promise<SessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(id: string, at: Date): Promise<void>;
  revokeAllSessionsForUser(userId: string, at: Date): Promise<void>;

  createWallet(wallet: WalletRecord): Promise<WalletRecord>;
  getWalletByUserId(userId: string): Promise<WalletRecord | null>;
  updateWalletBalance(walletId: string, balanceKobo: number, updatedAt: Date): Promise<void>;

  appendLedgerEntry(entry: LedgerRecord): Promise<LedgerRecord>;
  findLedgerByReference(reference: string): Promise<LedgerRecord | null>;
  listLedger(userId: string, limit: number): Promise<LedgerRecord[]>;
  sumLedger(walletId: string): Promise<number>;

  createTransaction(transaction: TransactionRecord): Promise<TransactionRecord>;
  getTransactionById(id: string): Promise<TransactionRecord | null>;
  getTransactionByReference(reference: string): Promise<TransactionRecord | null>;
  findTransactionByProviderReference(
    providerReference: string,
  ): Promise<TransactionRecord | null>;
  /** Pending supplier orders that are due for reconciliation, oldest first. */
  listTransactionsByStatus(
    statuses: TransactionRecord['status'][],
    updatedBefore: Date,
    limit: number,
  ): Promise<TransactionRecord[]>;
  listTransactions(userId: string, filter: TransactionFilter): Promise<TransactionPage>;
  updateTransaction(
    id: string,
    patch: TransactionPatch,
    updatedAt: Date,
  ): Promise<TransactionRecord>;

  createFunding(funding: FundingRecord): Promise<FundingRecord>;
  getFundingByReference(reference: string): Promise<FundingRecord | null>;
  listFundingsByUser(
    userId: string,
    statuses: FundingRecord['status'][],
    limit?: number,
  ): Promise<FundingRecord[]>;
  updateFunding(id: string, patch: FundingPatch, updatedAt: Date): Promise<FundingRecord>;

  getIdempotency(userId: string, key: string): Promise<IdempotencyRecord | null>;
  /** Atomically reserves a key. Returns false when another request already owns it. */
  claimIdempotency(record: IdempotencyRecord): Promise<boolean>;
  putIdempotency(record: IdempotencyRecord): Promise<void>;
  deleteIdempotency(id: string): Promise<void>;

  recordAudit(event: AuditEventRecord): Promise<void>;

  hasWebhookEvent(id: string): Promise<boolean>;
  recordWebhookEvent(event: WebhookEventRecord): Promise<void>;

  recordProviderRequest(request: ProviderRequestRecord): Promise<void>;

  createSupportTicket(ticket: SupportTicketRecord): Promise<SupportTicketRecord>;
  listSupportTickets(userId: string): Promise<SupportTicketRecord[]>;

  createOneTimeToken(token: OneTimeTokenRecord): Promise<void>;
  findOneTimeTokenByHash(
    kind: OneTimeTokenKind,
    tokenHash: string,
  ): Promise<OneTimeTokenRecord | null>;
  consumeOneTimeToken(id: string, at: Date): Promise<void>;
  invalidateOneTimeTokens(userId: string, kind: OneTimeTokenKind, at: Date): Promise<void>;
}

export interface MeterVerification {
  customerName: string;
  customerAddress: string | null;
  meterNumber: string;
  meterType: MeterType;
  billerId: string;
  isDemo: boolean;
}

export interface CableVerification {
  customerName: string;
  smartcardNumber: string;
  providerId: string;
  currentPackage: string | null;
  isDemo: boolean;
}

export interface ProviderVoucher {
  pin: string;
  serial: string;
  expiresAt?: string;
}

export interface ProviderPurchaseResult {
  providerReference: string;
  message: string;
  token?: string;
  units?: string;
  vouchers?: ProviderVoucher[];
  raw: Record<string, unknown>;
  simulated: boolean;
}

export interface ProviderStatusResult {
  state: 'pending' | 'successful' | 'failed';
  providerReference: string;
  message: string;
  details?: Record<string, unknown>;
}

export function encodeTransactionCursor(transaction: TransactionRecord): string {
  return Buffer.from(`${transaction.createdAt.toISOString()}|${transaction.id}`).toString(
    'base64url',
  );
}

export function decodeTransactionCursor(
  cursor: string,
): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const separator = decoded.indexOf('|');
    if (separator <= 0) return null;
    const createdAt = new Date(decoded.slice(0, separator));
    const id = decoded.slice(separator + 1);
    if (Number.isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export function toUserProfile(user: UserRecord): UserProfile {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    hasTransactionPin: Boolean(user.transactionPinHash),
    createdAt: user.createdAt.toISOString(),
  };
}

export function toWalletSummary(wallet: WalletRecord): WalletSummary {
  return {
    id: wallet.id,
    balanceKobo: wallet.balanceKobo,
    currency: wallet.currency,
    updatedAt: wallet.updatedAt.toISOString(),
  };
}
