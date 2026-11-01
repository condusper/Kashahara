import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  AuditEventRecord,
  FundingPatch,
  FundingRecord,
  IdempotencyRecord,
  LedgerRecord,
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

interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

type Row = Record<string, unknown>;

function asDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  return new Date(0);
}

function asNullableDate(value: unknown): Date | null {
  return value === null || value === undefined ? null : asDate(value);
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function mapUser(row: Row): UserRecord {
  return {
    id: String(row.id),
    fullName: String(row.full_name),
    email: String(row.email),
    phone: String(row.phone),
    passwordHash: String(row.password_hash),
    transactionPinHash: row.transaction_pin_hash ? String(row.transaction_pin_hash) : null,
    emailVerified: Boolean(row.email_verified),
    phoneVerified: Boolean(row.phone_verified),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

function mapSession(row: Row): SessionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    tokenHash: String(row.token_hash),
    expiresAt: asDate(row.expires_at),
    revokedAt: asNullableDate(row.revoked_at),
    userAgent: row.user_agent ? String(row.user_agent) : null,
    ip: row.ip ? String(row.ip) : null,
    createdAt: asDate(row.created_at),
  };
}

function mapWallet(row: Row): WalletRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    balanceKobo: asNumber(row.balance_kobo),
    currency: 'NGN',
    updatedAt: asDate(row.updated_at),
  };
}

function mapLedger(row: Row): LedgerRecord {
  return {
    id: String(row.id),
    walletId: String(row.wallet_id),
    userId: String(row.user_id),
    direction: row.direction === 'credit' ? 'credit' : 'debit',
    amountKobo: asNumber(row.amount_kobo),
    balanceAfterKobo: asNumber(row.balance_after_kobo),
    reference: String(row.reference),
    kind: String(row.kind),
    transactionId: row.transaction_id ? String(row.transaction_id) : null,
    metadata: asObject(row.metadata),
    createdAt: asDate(row.created_at),
  };
}

function mapTransaction(row: Row): TransactionRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    reference: String(row.reference),
    type: row.type as TransactionRecord['type'],
    status: row.status as TransactionRecord['status'],
    amountKobo: asNumber(row.amount_kobo),
    feeKobo: asNumber(row.fee_kobo),
    currency: 'NGN',
    recipient: asObject(row.recipient),
    details: asObject(row.details),
    providerReference: row.provider_reference ? String(row.provider_reference) : null,
    failureReason: row.failure_reason ? String(row.failure_reason) : null,
    simulated: Boolean(row.simulated),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
    completedAt: asNullableDate(row.completed_at),
  };
}

function mapFunding(row: Row): FundingRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    reference: String(row.reference),
    amountKobo: asNumber(row.amount_kobo),
    status: row.status as FundingRecord['status'],
    provider: row.provider as FundingRecord['provider'],
    providerReference: row.provider_reference ? String(row.provider_reference) : null,
    authorizationUrl: row.authorization_url ? String(row.authorization_url) : null,
    simulated: Boolean(row.simulated),
    metadata: asObject(row.metadata),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
    completedAt: asNullableDate(row.completed_at),
  };
}

function mapIdempotency(row: Row): IdempotencyRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    key: String(row.key),
    requestHash: String(row.request_hash),
    status: row.status as IdempotencyRecord['status'],
    responseStatus: row.response_status === null ? null : asNumber(row.response_status),
    responseBody: row.response_body ?? null,
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

function mapSupportTicket(row: Row): SupportTicketRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    subject: String(row.subject),
    message: String(row.message),
    status: row.status as SupportTicketRecord['status'],
    createdAt: asDate(row.created_at),
  };
}

function mapOneTimeToken(row: Row): OneTimeTokenRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kind: row.kind as OneTimeTokenKind,
    tokenHash: String(row.token_hash),
    expiresAt: asDate(row.expires_at),
    usedAt: asNullableDate(row.used_at),
    createdAt: asDate(row.created_at),
  };
}

export class PostgresStore implements Store {
  readonly kind = 'postgres' as const;

  constructor(private readonly db: Queryable) {}

  async transaction<T>(work: (tx: Store) => Promise<T>): Promise<T> {
    const pool = this.db as unknown as Pool;
    if (typeof pool.connect !== 'function') {
      throw new Error('Nested transactions are not supported');
    }
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = new PostgresStore(client);
      const result = await work(tx);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createUser(user: UserRecord): Promise<UserRecord> {
    const result = await this.db.query<Row>(
      `INSERT INTO users
        (id, full_name, email, phone, password_hash, transaction_pin_hash,
         email_verified, phone_verified, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        user.id,
        user.fullName,
        user.email,
        user.phone,
        user.passwordHash,
        user.transactionPinHash,
        user.emailVerified,
        user.phoneVerified,
        user.createdAt,
        user.updatedAt,
      ],
    );
    return mapUser(result.rows[0] as Row);
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const result = await this.db.query<Row>('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const result = await this.db.query<Row>(
      'SELECT * FROM users WHERE lower(email) = lower($1)',
      [email],
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async findUserByPhone(phone: string): Promise<UserRecord | null> {
    const result = await this.db.query<Row>('SELECT * FROM users WHERE phone = $1', [phone]);
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  }

  async updateUser(id: string, patch: UserPatch): Promise<UserRecord> {
    const columns: Record<keyof UserPatch, string> = {
      fullName: 'full_name',
      email: 'email',
      phone: 'phone',
      passwordHash: 'password_hash',
      transactionPinHash: 'transaction_pin_hash',
      emailVerified: 'email_verified',
      phoneVerified: 'phone_verified',
      updatedAt: 'updated_at',
    };
    const values: unknown[] = [];
    const assignments: string[] = [];
    for (const [key, column] of Object.entries(columns) as [
      keyof UserPatch,
      string,
    ][]) {
      const value = patch[key];
      if (value !== undefined && key !== 'updatedAt') {
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
      }
    }
    if (assignments.length === 0) {
      const existing = await this.findUserById(id);
      if (!existing) throw new Error('User not found');
      return existing;
    }
    values.push(patch.updatedAt ?? new Date());
    assignments.push(`updated_at = $${values.length}`);
    values.push(id);
    const result = await this.db.query<Row>(
      `UPDATE users SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!result.rows[0]) throw new Error('User not found');
    return mapUser(result.rows[0]);
  }

  async createSession(session: SessionRecord): Promise<SessionRecord> {
    const result = await this.db.query<Row>(
      `INSERT INTO sessions
        (id, user_id, token_hash, expires_at, revoked_at, user_agent, ip, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        session.id,
        session.userId,
        session.tokenHash,
        session.expiresAt,
        session.revokedAt,
        session.userAgent,
        session.ip,
        session.createdAt,
      ],
    );
    return mapSession(result.rows[0] as Row);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const result = await this.db.query<Row>(
      'SELECT * FROM sessions WHERE token_hash = $1',
      [tokenHash],
    );
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async revokeSession(id: string, at: Date): Promise<void> {
    await this.db.query(
      'UPDATE sessions SET revoked_at = COALESCE(revoked_at, $2) WHERE id = $1',
      [id, at],
    );
  }

  async revokeAllSessionsForUser(userId: string, at: Date): Promise<void> {
    await this.db.query(
      'UPDATE sessions SET revoked_at = COALESCE(revoked_at, $2) WHERE user_id = $1',
      [userId, at],
    );
  }

  async createWallet(wallet: WalletRecord): Promise<WalletRecord> {
    const result = await this.db.query<Row>(
      `INSERT INTO wallets (id, user_id, balance_kobo, currency, updated_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [wallet.id, wallet.userId, wallet.balanceKobo, wallet.currency, wallet.updatedAt],
    );
    return mapWallet(result.rows[0] as Row);
  }

  async getWalletByUserId(userId: string): Promise<WalletRecord | null> {
    const result = await this.db.query<Row>('SELECT * FROM wallets WHERE user_id = $1', [
      userId,
    ]);
    return result.rows[0] ? mapWallet(result.rows[0]) : null;
  }

  async updateWalletBalance(
    walletId: string,
    balanceKobo: number,
    updatedAt: Date,
  ): Promise<void> {
    await this.db.query(
      'UPDATE wallets SET balance_kobo = $2, updated_at = $3 WHERE id = $1',
      [walletId, balanceKobo, updatedAt],
    );
  }

  async appendLedgerEntry(entry: LedgerRecord): Promise<LedgerRecord> {
    const result = await this.db.query<Row>(
      `INSERT INTO ledger_entries
        (id, wallet_id, user_id, direction, amount_kobo, balance_after_kobo,
         reference, kind, transaction_id, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        entry.id,
        entry.walletId,
        entry.userId,
        entry.direction,
        entry.amountKobo,
        entry.balanceAfterKobo,
        entry.reference,
        entry.kind,
        entry.transactionId,
        JSON.stringify(entry.metadata),
        entry.createdAt,
      ],
    );
    return mapLedger(result.rows[0] as Row);
  }

  async findLedgerByReference(reference: string): Promise<LedgerRecord | null> {
    const result = await this.db.query<Row>(
      'SELECT * FROM ledger_entries WHERE reference = $1',
      [reference],
    );
    return result.rows[0] ? mapLedger(result.rows[0]) : null;
  }

  async listLedger(userId: string, limit: number): Promise<LedgerRecord[]> {
    const result = await this.db.query<Row>(
      `SELECT * FROM ledger_entries
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [userId, limit],
    );
    return result.rows.map(mapLedger);
  }

  async sumLedger(walletId: string): Promise<number> {
    const result = await this.db.query<Row>(
      `SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_kobo ELSE -amount_kobo END), 0) AS total
       FROM ledger_entries WHERE wallet_id = $1`,
      [walletId],
    );
    return asNumber(result.rows[0]?.total);
  }

  async createTransaction(transaction: TransactionRecord): Promise<TransactionRecord> {
    const result = await this.db.query<Row>(
      `INSERT INTO transactions
        (id, user_id, reference, type, status, amount_kobo, fee_kobo, currency,
         recipient, details, provider_reference, failure_reason, simulated,
         created_at, updated_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        transaction.id,
        transaction.userId,
        transaction.reference,
        transaction.type,
        transaction.status,
        transaction.amountKobo,
        transaction.feeKobo,
        transaction.currency,
        JSON.stringify(transaction.recipient),
        JSON.stringify(transaction.details),
        transaction.providerReference,
        transaction.failureReason,
        transaction.simulated,
        transaction.createdAt,
        transaction.updatedAt,
        transaction.completedAt,
      ],
    );
    return mapTransaction(result.rows[0] as Row);
  }

  async getTransactionById(id: string): Promise<TransactionRecord | null> {
    const result = await this.db.query<Row>('SELECT * FROM transactions WHERE id = $1', [id]);
    return result.rows[0] ? mapTransaction(result.rows[0]) : null;
  }

  async getTransactionByReference(reference: string): Promise<TransactionRecord | null> {
    const result = await this.db.query<Row>(
      'SELECT * FROM transactions WHERE reference = $1',
      [reference],
    );
    return result.rows[0] ? mapTransaction(result.rows[0]) : null;
  }

  async findTransactionByProviderReference(
    providerReference: string,
  ): Promise<TransactionRecord | null> {
    const result = await this.db.query<Row>(
      `SELECT * FROM transactions
       WHERE provider_reference = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [providerReference],
    );
    return result.rows[0] ? mapTransaction(result.rows[0]) : null;
  }

  async listTransactionsByStatus(
    statuses: TransactionRecord['status'][],
    updatedBefore: Date,
    limit: number,
  ): Promise<TransactionRecord[]> {
    if (statuses.length === 0) return [];
    const result = await this.db.query<Row>(
      `SELECT * FROM transactions
       WHERE status = ANY($1::text[])
         AND provider_reference IS NOT NULL
         AND provider_reference <> ''
         AND updated_at <= $2
       ORDER BY updated_at ASC
       LIMIT $3`,
      [statuses, updatedBefore, limit],
    );
    return result.rows.map(mapTransaction);
  }

  async listTransactions(userId: string, filter: TransactionFilter): Promise<TransactionPage> {
    const decoded = filter.cursor ? decodeTransactionCursor(filter.cursor) : null;
    const result = await this.db.query<Row>(
      `SELECT * FROM transactions
       WHERE user_id = $1
         AND ($2::text IS NULL OR type = $2)
         AND ($3::text IS NULL OR status = $3)
         AND ($4::timestamptz IS NULL OR (created_at, id) < ($4::timestamptz, $5::uuid))
       ORDER BY created_at DESC, id DESC
       LIMIT $6`,
      [
        userId,
        filter.type ?? null,
        filter.status ?? null,
        decoded?.createdAt ?? null,
        decoded?.id ?? null,
        filter.limit + 1,
      ],
    );
    const rows = result.rows.map(mapTransaction);
    const page = rows.slice(0, filter.limit);
    const nextCursor =
      rows.length > filter.limit && page.length > 0
        ? encodeTransactionCursor(page[page.length - 1] as TransactionRecord)
        : null;
    return { items: page, nextCursor };
  }

  async updateTransaction(
    id: string,
    patch: TransactionPatch,
    updatedAt: Date,
  ): Promise<TransactionRecord> {
    const columns: Record<keyof TransactionPatch, string> = {
      status: 'status',
      details: 'details',
      providerReference: 'provider_reference',
      failureReason: 'failure_reason',
      simulated: 'simulated',
      completedAt: 'completed_at',
      updatedAt: 'updated_at',
    };
    const values: unknown[] = [];
    const assignments: string[] = [];
    for (const [key, column] of Object.entries(columns) as [
      keyof TransactionPatch,
      string,
    ][]) {
      if (key === 'updatedAt') continue;
      const value = patch[key];
      if (value !== undefined) {
        values.push(key === 'details' ? JSON.stringify(value) : value);
        assignments.push(`${column} = $${values.length}`);
      }
    }
    values.push(updatedAt);
    assignments.push(`updated_at = $${values.length}`);
    values.push(id);
    const result = await this.db.query<Row>(
      `UPDATE transactions SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!result.rows[0]) throw new Error('Transaction not found');
    return mapTransaction(result.rows[0]);
  }

  async createFunding(funding: FundingRecord): Promise<FundingRecord> {
    const result = await this.db.query<Row>(
      `INSERT INTO funding_attempts
        (id, user_id, reference, amount_kobo, status, provider, provider_reference,
         authorization_url, simulated, metadata, created_at, updated_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        funding.id,
        funding.userId,
        funding.reference,
        funding.amountKobo,
        funding.status,
        funding.provider,
        funding.providerReference,
        funding.authorizationUrl,
        funding.simulated,
        JSON.stringify(funding.metadata),
        funding.createdAt,
        funding.updatedAt,
        funding.completedAt,
      ],
    );
    return mapFunding(result.rows[0] as Row);
  }

  async getFundingByReference(reference: string): Promise<FundingRecord | null> {
    const result = await this.db.query<Row>(
      'SELECT * FROM funding_attempts WHERE reference = $1',
      [reference],
    );
    return result.rows[0] ? mapFunding(result.rows[0]) : null;
  }

  async listFundingsByUser(
    userId: string,
    statuses: FundingRecord['status'][],
    limit = 5,
  ): Promise<FundingRecord[]> {
    if (statuses.length === 0) return [];
    const result = await this.db.query<Row>(
      `SELECT * FROM funding_attempts
        WHERE user_id = $1 AND status = ANY($2::text[])
        ORDER BY created_at DESC
        LIMIT $3`,
      [userId, statuses, Math.max(limit, 0)],
    );
    return result.rows.map(mapFunding);
  }

  async updateFunding(
    id: string,
    patch: FundingPatch,
    updatedAt: Date,
  ): Promise<FundingRecord> {
    const columns: Record<keyof FundingPatch, string> = {
      status: 'status',
      providerReference: 'provider_reference',
      authorizationUrl: 'authorization_url',
      simulated: 'simulated',
      metadata: 'metadata',
      completedAt: 'completed_at',
      updatedAt: 'updated_at',
    };
    const values: unknown[] = [];
    const assignments: string[] = [];
    for (const [key, column] of Object.entries(columns) as [
      keyof FundingPatch,
      string,
    ][]) {
      if (key === 'updatedAt') continue;
      const value = patch[key];
      if (value !== undefined) {
        values.push(key === 'metadata' ? JSON.stringify(value) : value);
        assignments.push(`${column} = $${values.length}`);
      }
    }
    values.push(updatedAt);
    assignments.push(`updated_at = $${values.length}`);
    values.push(id);
    const result = await this.db.query<Row>(
      `UPDATE funding_attempts SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    if (!result.rows[0]) throw new Error('Funding attempt not found');
    return mapFunding(result.rows[0]);
  }

  async getIdempotency(userId: string, key: string): Promise<IdempotencyRecord | null> {
    const result = await this.db.query<Row>(
      'SELECT * FROM idempotency_keys WHERE user_id = $1 AND key = $2',
      [userId, key],
    );
    return result.rows[0] ? mapIdempotency(result.rows[0]) : null;
  }

  async claimIdempotency(record: IdempotencyRecord): Promise<boolean> {
    const result = await this.db.query<Row>(
      `INSERT INTO idempotency_keys
        (id, user_id, key, request_hash, status, response_status, response_body,
         created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id, key) DO NOTHING
       RETURNING id`,
      [
        record.id,
        record.userId,
        record.key,
        record.requestHash,
        record.status,
        record.responseStatus,
        record.responseBody === null ? null : JSON.stringify(record.responseBody),
        record.createdAt,
        record.updatedAt,
      ],
    );
    return result.rows.length > 0;
  }

  async putIdempotency(record: IdempotencyRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO idempotency_keys
        (id, user_id, key, request_hash, status, response_status, response_body,
         created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id, key) DO UPDATE SET
         request_hash = EXCLUDED.request_hash,
         status = EXCLUDED.status,
         response_status = EXCLUDED.response_status,
         response_body = EXCLUDED.response_body,
         updated_at = EXCLUDED.updated_at`,
      [
        record.id,
        record.userId,
        record.key,
        record.requestHash,
        record.status,
        record.responseStatus,
        record.responseBody === null ? null : JSON.stringify(record.responseBody),
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  async deleteIdempotency(id: string): Promise<void> {
    await this.db.query('DELETE FROM idempotency_keys WHERE id = $1', [id]);
  }

  async recordAudit(event: AuditEventRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_events (id, user_id, action, metadata, ip, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [event.id, event.userId, event.action, JSON.stringify(event.metadata), event.ip, event.createdAt],
    );
  }

  async hasWebhookEvent(id: string): Promise<boolean> {
    const result = await this.db.query<Row>(
      'SELECT 1 FROM webhook_events WHERE id = $1',
      [id],
    );
    return result.rows.length > 0;
  }

  async recordWebhookEvent(event: WebhookEventRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO webhook_events (id, provider, event_type, payload_hash, processed_at)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [event.id, event.provider, event.eventType, event.payloadHash, event.processedAt],
    );
  }

  async recordProviderRequest(request: ProviderRequestRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO provider_requests
        (id, transaction_id, provider, operation, request, response, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        request.id,
        request.transactionId,
        request.provider,
        request.operation,
        JSON.stringify(request.request),
        request.response === null ? null : JSON.stringify(request.response),
        request.status,
        request.createdAt,
      ],
    );
  }

  async createSupportTicket(ticket: SupportTicketRecord): Promise<SupportTicketRecord> {
    const result = await this.db.query<Row>(
      `INSERT INTO support_tickets (id, user_id, subject, message, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [ticket.id, ticket.userId, ticket.subject, ticket.message, ticket.status, ticket.createdAt],
    );
    return mapSupportTicket(result.rows[0] as Row);
  }

  async listSupportTickets(userId: string): Promise<SupportTicketRecord[]> {
    const result = await this.db.query<Row>(
      'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map(mapSupportTicket);
  }

  async createOneTimeToken(token: OneTimeTokenRecord): Promise<void> {
    await this.db.query(
      `INSERT INTO one_time_tokens
        (id, user_id, kind, token_hash, expires_at, used_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [token.id, token.userId, token.kind, token.tokenHash, token.expiresAt, token.usedAt, token.createdAt],
    );
  }

  async findOneTimeTokenByHash(
    kind: OneTimeTokenKind,
    tokenHash: string,
  ): Promise<OneTimeTokenRecord | null> {
    const result = await this.db.query<Row>(
      'SELECT * FROM one_time_tokens WHERE kind = $1 AND token_hash = $2',
      [kind, tokenHash],
    );
    return result.rows[0] ? mapOneTimeToken(result.rows[0]) : null;
  }

  async consumeOneTimeToken(id: string, at: Date): Promise<void> {
    await this.db.query(
      'UPDATE one_time_tokens SET used_at = COALESCE(used_at, $2) WHERE id = $1',
      [id, at],
    );
  }

  async invalidateOneTimeTokens(
    userId: string,
    kind: OneTimeTokenKind,
    at: Date,
  ): Promise<void> {
    await this.db.query(
      'UPDATE one_time_tokens SET used_at = COALESCE(used_at, $2) WHERE user_id = $1 AND kind = $3',
      [userId, at, kind],
    );
  }
}
