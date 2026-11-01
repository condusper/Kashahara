import type {
  AuditEventRecord,
  CableVerification,
  FundingPatch,
  FundingRecord,
  IdempotencyRecord,
  LedgerRecord,
  MeterVerification,
  OneTimeTokenKind,
  OneTimeTokenRecord,
  ProviderRequestRecord,
  SessionRecord,
  Store,
  SupportTicketRecord,
  TransactionFilter,
  TransactionPage,
  TransactionPatch,
  TransactionRecord,
  UserPatch,
  UserRecord,
  WalletRecord,
  WebhookEventRecord,
} from '../types';
import { decodeTransactionCursor, encodeTransactionCursor } from '../types';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Date fields that JSON turns into ISO strings. Only these keys are revived
 * when a snapshot is loaded so payment metadata keeps its original shape.
 */
const DATE_KEYS = new Set([
  'createdAt',
  'updatedAt',
  'completedAt',
  'expiresAt',
  'revokedAt',
  'usedAt',
  'processedAt',
]);

function reviveDates<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => reviveDates(item)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const revived: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      revived[key] =
        DATE_KEYS.has(key) && typeof item === 'string' ? new Date(item) : reviveDates(item);
    }
    return revived as T;
  }
  return value;
}

export interface MemorySnapshot {
  version: 1;
  savedAt: string;
  users: UserRecord[];
  sessions: SessionRecord[];
  wallets: WalletRecord[];
  ledger: LedgerRecord[];
  transactions: TransactionRecord[];
  fundings: FundingRecord[];
  idempotency: IdempotencyRecord[];
  auditEvents: AuditEventRecord[];
  webhookEvents: string[];
  providerRequests: ProviderRequestRecord[];
  supportTickets: SupportTicketRecord[];
  oneTimeTokens: OneTimeTokenRecord[];
}


/**
 * In-memory store used by the test suite and by development when no
 * DATABASE_URL is configured. It serializes all transactions so ledger
 * invariants can be tested without PostgreSQL. It is NOT durable.
 */
export class MemoryStore implements Store {
  readonly kind = 'memory' as const;

  private readonly users = new Map<string, UserRecord>();
  private readonly userIdByEmail = new Map<string, string>();
  private readonly userIdByPhone = new Map<string, string>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly sessionIdByTokenHash = new Map<string, string>();
  private readonly wallets = new Map<string, WalletRecord>();
  private readonly walletIdByUserId = new Map<string, string>();
  private readonly ledger = new Map<string, LedgerRecord>();
  private readonly ledgerIdByReference = new Map<string, string>();
  private readonly ledgerByUser = new Map<string, string[]>();
  private readonly transactions = new Map<string, TransactionRecord>();
  private readonly transactionIdByReference = new Map<string, string>();
  private readonly transactionIdsByUser = new Map<string, string[]>();
  private readonly funding = new Map<string, FundingRecord>();
  private readonly fundingIdByReference = new Map<string, string>();
  private readonly idempotency = new Map<string, IdempotencyRecord>();
  private readonly auditEvents: AuditEventRecord[] = [];
  private readonly webhookEvents = new Set<string>();
  private readonly providerRequests: ProviderRequestRecord[] = [];
  private readonly supportTickets: SupportTicketRecord[] = [];
  private readonly oneTimeTokens = new Map<string, OneTimeTokenRecord>();
  private readonly oneTimeTokenIdByHash = new Map<string, string>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly snapshotPath: string | null = null) {
    if (this.snapshotPath) this.loadFromDisk();
  }

  async transaction<T>(work: (tx: Store) => Promise<T>): Promise<T> {
    const run = this.queue.then(() => work(this));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async createUser(user: UserRecord): Promise<UserRecord> {
    if (this.userIdByEmail.has(user.email.toLowerCase())) {
      throw new Error('A user with this email already exists');
    }
    if (this.userIdByPhone.has(user.phone)) {
      throw new Error('A user with this phone number already exists');
    }
    this.users.set(user.id, clone(user));
    this.userIdByEmail.set(user.email.toLowerCase(), user.id);
    this.userIdByPhone.set(user.phone, user.id);
    return clone(user);
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const user = this.users.get(id);
    return user ? clone(user) : null;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const id = this.userIdByEmail.get(email.trim().toLowerCase());
    return id ? this.findUserById(id) : null;
  }

  async findUserByPhone(phone: string): Promise<UserRecord | null> {
    const id = this.userIdByPhone.get(phone);
    return id ? this.findUserById(id) : null;
  }

  async updateUser(id: string, patch: UserPatch): Promise<UserRecord> {
    const existing = this.users.get(id);
    if (!existing) throw new Error('User not found');
    if (patch.email && !sameEmail(patch.email, existing.email)) {
      const owner = this.userIdByEmail.get(patch.email.toLowerCase());
      if (owner && owner !== id) throw new Error('A user with this email already exists');
      this.userIdByEmail.delete(existing.email.toLowerCase());
      this.userIdByEmail.set(patch.email.toLowerCase(), id);
    }
    if (patch.phone && patch.phone !== existing.phone) {
      const owner = this.userIdByPhone.get(patch.phone);
      if (owner && owner !== id) throw new Error('A user with this phone number already exists');
      this.userIdByPhone.delete(existing.phone);
      this.userIdByPhone.set(patch.phone, id);
    }
    const updated = { ...existing, ...patch };
    this.users.set(id, clone(updated));
    return clone(updated);
  }

  async createSession(session: SessionRecord): Promise<SessionRecord> {
    if (this.sessionIdByTokenHash.has(session.tokenHash)) {
      throw new Error('Session token already exists');
    }
    this.sessions.set(session.id, clone(session));
    this.sessionIdByTokenHash.set(session.tokenHash, session.id);
    return clone(session);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const id = this.sessionIdByTokenHash.get(tokenHash);
    if (!id) return null;
    const session = this.sessions.get(id);
    return session ? clone(session) : null;
  }

  async revokeSession(id: string, at: Date): Promise<void> {
    const session = this.sessions.get(id);
    if (session && !session.revokedAt) {
      session.revokedAt = at;
    }
  }

  async revokeAllSessionsForUser(userId: string, at: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = at;
      }
    }
  }

  async createWallet(wallet: WalletRecord): Promise<WalletRecord> {
    if (this.walletIdByUserId.has(wallet.userId)) {
      throw new Error('Wallet already exists for this user');
    }
    this.wallets.set(wallet.id, clone(wallet));
    this.walletIdByUserId.set(wallet.userId, wallet.id);
    return clone(wallet);
  }

  async getWalletByUserId(userId: string): Promise<WalletRecord | null> {
    const id = this.walletIdByUserId.get(userId);
    if (!id) return null;
    const wallet = this.wallets.get(id);
    return wallet ? clone(wallet) : null;
  }

  async updateWalletBalance(
    walletId: string,
    balanceKobo: number,
    updatedAt: Date,
  ): Promise<void> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');
    if (!Number.isSafeInteger(balanceKobo) || balanceKobo < 0) {
      throw new Error('Wallet balance cannot be negative');
    }
    wallet.balanceKobo = balanceKobo;
    wallet.updatedAt = updatedAt;
  }

  async appendLedgerEntry(entry: LedgerRecord): Promise<LedgerRecord> {
    if (this.ledgerIdByReference.has(entry.reference)) {
      throw new Error('Ledger reference already exists');
    }
    this.ledger.set(entry.id, clone(entry));
    this.ledgerIdByReference.set(entry.reference, entry.id);
    const ids = this.ledgerByUser.get(entry.userId) ?? [];
    ids.push(entry.id);
    this.ledgerByUser.set(entry.userId, ids);
    return clone(entry);
  }

  async findLedgerByReference(reference: string): Promise<LedgerRecord | null> {
    const id = this.ledgerIdByReference.get(reference);
    if (!id) return null;
    const entry = this.ledger.get(id);
    return entry ? clone(entry) : null;
  }

  async listLedger(userId: string, limit: number): Promise<LedgerRecord[]> {
    const ids = this.ledgerByUser.get(userId) ?? [];
    return ids
      .map((id) => this.ledger.get(id))
      .filter((entry): entry is LedgerRecord => Boolean(entry))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map(clone);
  }

  async sumLedger(walletId: string): Promise<number> {
    let total = 0;
    for (const entry of this.ledger.values()) {
      if (entry.walletId !== walletId) continue;
      total += entry.direction === 'credit' ? entry.amountKobo : -entry.amountKobo;
    }
    return total;
  }

  async createTransaction(transaction: TransactionRecord): Promise<TransactionRecord> {
    if (this.transactionIdByReference.has(transaction.reference)) {
      throw new Error('Transaction reference already exists');
    }
    this.transactions.set(transaction.id, clone(transaction));
    this.transactionIdByReference.set(transaction.reference, transaction.id);
    const ids = this.transactionIdsByUser.get(transaction.userId) ?? [];
    ids.push(transaction.id);
    this.transactionIdsByUser.set(transaction.userId, ids);
    return clone(transaction);
  }

  async getTransactionById(id: string): Promise<TransactionRecord | null> {
    const transaction = this.transactions.get(id);
    return transaction ? clone(transaction) : null;
  }

  async getTransactionByReference(reference: string): Promise<TransactionRecord | null> {
    const id = this.transactionIdByReference.get(reference);
    return id ? this.getTransactionById(id) : null;
  }

  async findTransactionByProviderReference(
    providerReference: string,
  ): Promise<TransactionRecord | null> {
    for (const transaction of this.transactions.values()) {
      if (transaction.providerReference === providerReference) return clone(transaction);
    }
    return null;
  }

  async listTransactionsByStatus(
    statuses: TransactionRecord['status'][],
    updatedBefore: Date,
    limit: number,
  ): Promise<TransactionRecord[]> {
    const allowed = new Set(statuses);
    return [...this.transactions.values()]
      .filter(
        (transaction) =>
          allowed.has(transaction.status) &&
          Boolean(transaction.providerReference) &&
          transaction.updatedAt.getTime() <= updatedBefore.getTime(),
      )
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime())
      .slice(0, limit)
      .map(clone);
  }

  async listTransactions(userId: string, filter: TransactionFilter): Promise<TransactionPage> {
    const ids = this.transactionIdsByUser.get(userId) ?? [];
    let items = ids
      .map((id) => this.transactions.get(id))
      .filter((item): item is TransactionRecord => Boolean(item))
      .filter((item) => (filter.type ? item.type === filter.type : true))
      .filter((item) => (filter.status ? item.status === filter.status : true))
      .sort((a, b) => {
        const time = b.createdAt.getTime() - a.createdAt.getTime();
        return time !== 0 ? time : b.id.localeCompare(a.id);
      });

    if (filter.cursor) {
      const decoded = decodeTransactionCursor(filter.cursor);
      if (decoded) {
        items = items.filter((item) => {
          if (item.createdAt.getTime() < decoded.createdAt.getTime()) return true;
          if (item.createdAt.getTime() > decoded.createdAt.getTime()) return false;
          return item.id < decoded.id;
        });
      }
    }

    const page = items.slice(0, filter.limit);
    const nextCursor =
      items.length > filter.limit && page.length > 0
        ? encodeTransactionCursor(page[page.length - 1] as TransactionRecord)
        : null;
    return { items: page.map(clone), nextCursor };
  }

  async updateTransaction(
    id: string,
    patch: TransactionPatch,
    updatedAt: Date,
  ): Promise<TransactionRecord> {
    const existing = this.transactions.get(id);
    if (!existing) throw new Error('Transaction not found');
    const updated = { ...existing, ...patch, updatedAt };
    this.transactions.set(id, clone(updated));
    return clone(updated);
  }

  async createFunding(funding: FundingRecord): Promise<FundingRecord> {
    if (this.fundingIdByReference.has(funding.reference)) {
      throw new Error('Funding reference already exists');
    }
    this.funding.set(funding.id, clone(funding));
    this.fundingIdByReference.set(funding.reference, funding.id);
    return clone(funding);
  }

  async getFundingByReference(reference: string): Promise<FundingRecord | null> {
    const id = this.fundingIdByReference.get(reference);
    if (!id) return null;
    const funding = this.funding.get(id);
    return funding ? clone(funding) : null;
  }

  async listFundingsByUser(
    userId: string,
    statuses: FundingRecord['status'][],
    limit = 5,
  ): Promise<FundingRecord[]> {
    const allowed = new Set(statuses);
    return [...this.funding.values()]
      .filter((funding) => funding.userId === userId && allowed.has(funding.status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, Math.max(limit, 0))
      .map(clone);
  }

  async updateFunding(
    id: string,
    patch: FundingPatch,
    updatedAt: Date,
  ): Promise<FundingRecord> {
    const existing = this.funding.get(id);
    if (!existing) throw new Error('Funding attempt not found');
    const updated = { ...existing, ...patch, updatedAt };
    this.funding.set(id, clone(updated));
    return clone(updated);
  }

  async getIdempotency(userId: string, key: string): Promise<IdempotencyRecord | null> {
    const record = this.idempotency.get(`${userId}:${key}`);
    return record ? clone(record) : null;
  }

  async claimIdempotency(record: IdempotencyRecord): Promise<boolean> {
    const key = `${record.userId}:${record.key}`;
    if (this.idempotency.has(key)) return false;
    this.idempotency.set(key, clone(record));
    return true;
  }

  async putIdempotency(record: IdempotencyRecord): Promise<void> {
    this.idempotency.set(`${record.userId}:${record.key}`, clone(record));
  }

  async deleteIdempotency(id: string): Promise<void> {
    for (const [key, record] of this.idempotency.entries()) {
      if (record.id === id) {
        this.idempotency.delete(key);
        return;
      }
    }
  }

  async recordAudit(event: AuditEventRecord): Promise<void> {
    this.auditEvents.push(clone(event));
  }

  async hasWebhookEvent(id: string): Promise<boolean> {
    return this.webhookEvents.has(id);
  }

  async recordWebhookEvent(event: WebhookEventRecord): Promise<void> {
    this.webhookEvents.add(event.id);
  }

  async recordProviderRequest(request: ProviderRequestRecord): Promise<void> {
    this.providerRequests.push(clone(request));
  }

  async createSupportTicket(ticket: SupportTicketRecord): Promise<SupportTicketRecord> {
    this.supportTickets.push(clone(ticket));
    return clone(ticket);
  }

  async listSupportTickets(userId: string): Promise<SupportTicketRecord[]> {
    return this.supportTickets
      .filter((ticket) => ticket.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(clone);
  }

  async createOneTimeToken(token: OneTimeTokenRecord): Promise<void> {
    this.oneTimeTokens.set(token.id, clone(token));
    this.oneTimeTokenIdByHash.set(`${token.kind}:${token.tokenHash}`, token.id);
  }

  async findOneTimeTokenByHash(
    kind: OneTimeTokenKind,
    tokenHash: string,
  ): Promise<OneTimeTokenRecord | null> {
    const id = this.oneTimeTokenIdByHash.get(`${kind}:${tokenHash}`);
    if (!id) return null;
    const token = this.oneTimeTokens.get(id);
    return token ? clone(token) : null;
  }

  async consumeOneTimeToken(id: string, at: Date): Promise<void> {
    const token = this.oneTimeTokens.get(id);
    if (token && !token.usedAt) token.usedAt = at;
  }

  async invalidateOneTimeTokens(
    userId: string,
    kind: OneTimeTokenKind,
    at: Date,
  ): Promise<void> {
    for (const token of this.oneTimeTokens.values()) {
      if (token.userId === userId && token.kind === kind && !token.usedAt) {
        token.usedAt = at;
      }
    }
  }

  /** Serializes the full store state so a development restart can keep data. */
  snapshot(): MemorySnapshot {
    return clone({
      version: 1,
      savedAt: new Date().toISOString(),
      users: [...this.users.values()],
      sessions: [...this.sessions.values()],
      wallets: [...this.wallets.values()],
      ledger: [...this.ledger.values()],
      transactions: [...this.transactions.values()],
      fundings: [...this.funding.values()],
      idempotency: [...this.idempotency.values()],
      auditEvents: [...this.auditEvents],
      webhookEvents: [...this.webhookEvents],
      providerRequests: [...this.providerRequests],
      supportTickets: [...this.supportTickets],
      oneTimeTokens: [...this.oneTimeTokens.values()],
    });
  }

  saveToDisk(): void {
    if (!this.snapshotPath) return;
    mkdirSync(dirname(this.snapshotPath), { recursive: true });
    const tempPath = `${this.snapshotPath}.tmp`;
    // Write then rename so a crash cannot leave a half-written snapshot.
    writeFileSync(tempPath, JSON.stringify(this.snapshot()), 'utf8');
    renameSync(tempPath, this.snapshotPath);
  }

  restore(snapshot: MemorySnapshot): void {
    this.reset();

    for (const user of snapshot.users ?? []) {
      this.users.set(user.id, clone(user));
      this.userIdByEmail.set(user.email.toLowerCase(), user.id);
      this.userIdByPhone.set(user.phone, user.id);
    }
    for (const session of snapshot.sessions ?? []) {
      this.sessions.set(session.id, clone(session));
      this.sessionIdByTokenHash.set(session.tokenHash, session.id);
    }
    for (const wallet of snapshot.wallets ?? []) {
      this.wallets.set(wallet.id, clone(wallet));
      this.walletIdByUserId.set(wallet.userId, wallet.id);
    }
    for (const entry of snapshot.ledger ?? []) {
      this.ledger.set(entry.id, clone(entry));
      this.ledgerIdByReference.set(entry.reference, entry.id);
      const ids = this.ledgerByUser.get(entry.userId) ?? [];
      ids.push(entry.id);
      this.ledgerByUser.set(entry.userId, ids);
    }
    for (const transaction of snapshot.transactions ?? []) {
      this.transactions.set(transaction.id, clone(transaction));
      this.transactionIdByReference.set(transaction.reference, transaction.id);
      const ids = this.transactionIdsByUser.get(transaction.userId) ?? [];
      ids.push(transaction.id);
      this.transactionIdsByUser.set(transaction.userId, ids);
    }
    for (const funding of snapshot.fundings ?? []) {
      this.funding.set(funding.id, clone(funding));
      this.fundingIdByReference.set(funding.reference, funding.id);
    }
    for (const record of snapshot.idempotency ?? []) {
      this.idempotency.set(`${record.userId}:${record.key}`, clone(record));
    }
    for (const event of snapshot.auditEvents ?? []) {
      this.auditEvents.push(clone(event));
    }
    for (const eventId of snapshot.webhookEvents ?? []) {
      this.webhookEvents.add(eventId);
    }
    for (const request of snapshot.providerRequests ?? []) {
      this.providerRequests.push(clone(request));
    }
    for (const ticket of snapshot.supportTickets ?? []) {
      this.supportTickets.push(clone(ticket));
    }
    for (const token of snapshot.oneTimeTokens ?? []) {
      this.oneTimeTokens.set(token.id, clone(token));
      this.oneTimeTokenIdByHash.set(`${token.kind}:${token.tokenHash}`, token.id);
    }
  }

  private loadFromDisk(): void {
    try {
      const raw = readFileSync(this.snapshotPath as string, 'utf8');
      this.restore(reviveDates(JSON.parse(raw) as MemorySnapshot));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new Error(
        `Could not load the development store from ${this.snapshotPath}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private reset(): void {
    this.users.clear();
    this.userIdByEmail.clear();
    this.userIdByPhone.clear();
    this.sessions.clear();
    this.sessionIdByTokenHash.clear();
    this.wallets.clear();
    this.walletIdByUserId.clear();
    this.ledger.clear();
    this.ledgerIdByReference.clear();
    this.ledgerByUser.clear();
    this.transactions.clear();
    this.transactionIdByReference.clear();
    this.transactionIdsByUser.clear();
    this.funding.clear();
    this.fundingIdByReference.clear();
    this.idempotency.clear();
    this.auditEvents.length = 0;
    this.webhookEvents.clear();
    this.providerRequests.length = 0;
    this.supportTickets.length = 0;
    this.oneTimeTokens.clear();
    this.oneTimeTokenIdByHash.clear();
  }

  /** Test-only inspection helpers. */
  inspect() {
    return {
      users: this.users.size,
      wallets: this.wallets.size,
      ledgerEntries: this.ledger.size,
      transactions: this.transactions.size,
      auditEvents: this.auditEvents.length,
      providerRequests: this.providerRequests.length,
    };
  }
}

// These type-only imports are re-exported here to keep the store surface easy
// to discover for callers that only import from the store module.
export type { CableVerification, MeterVerification };

const WRITE_METHODS = new Set<string>([
  'transaction',
  'createUser',
  'updateUser',
  'createSession',
  'revokeSession',
  'revokeAllSessionsForUser',
  'createWallet',
  'updateWalletBalance',
  'appendLedgerEntry',
  'createTransaction',
  'updateTransaction',
  'createFunding',
  'updateFunding',
  'claimIdempotency',
  'putIdempotency',
  'deleteIdempotency',
  'recordAudit',
  'recordWebhookEvent',
  'recordProviderRequest',
  'createSupportTicket',
  'createOneTimeToken',
  'consumeOneTimeToken',
  'invalidateOneTimeTokens',
]);

/**
 * A MemoryStore that writes a JSON snapshot after every mutation. This keeps
 * local development data (accounts, wallets, funding history) across
 * `tsx watch` restarts without pretending to be a production database.
 * Tests keep using `new MemoryStore()` so they never touch disk.
 */
export function openPersistentMemoryStore(snapshotPath: string): Store {
  const store = new MemoryStore(snapshotPath);
  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      if (typeof property !== 'string' || !WRITE_METHODS.has(property)) {
        return value.bind(target);
      }
      return (...args: unknown[]) => {
        const persist = () => {
          try {
            target.saveToDisk();
          } catch (error) {
            console.error('Could not save the development store snapshot', error);
          }
        };
        const result = (value as (...inner: unknown[]) => unknown).apply(target, args);
        if (result && typeof (result as Promise<unknown>).then === 'function') {
          return (result as Promise<unknown>).then((resolved) => {
            persist();
            return resolved;
          });
        }
        persist();
        return result;
      };
    },
  }) as Store;
}
