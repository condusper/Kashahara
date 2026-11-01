-- Kashahara initial schema.
--
-- Money is always stored as integer kobo. The ledger is append-only: balances
-- are derived from ledger entries and enforced with a trigger that rejects
-- UPDATE and DELETE on ledger_entries.

CREATE TABLE users (
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  transaction_pin_hash text,
  email_verified boolean NOT NULL DEFAULT false,
  phone_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX users_email_lower_unique ON users (lower(email));

CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text,
  ip text,
  created_at timestamptz NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);

CREATE TABLE wallets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  balance_kobo bigint NOT NULL DEFAULT 0 CHECK (balance_kobo >= 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  updated_at timestamptz NOT NULL
);

CREATE TABLE ledger_entries (
  id uuid PRIMARY KEY,
  wallet_id uuid NOT NULL REFERENCES wallets (id),
  user_id uuid NOT NULL REFERENCES users (id),
  direction text NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  balance_after_kobo bigint NOT NULL CHECK (balance_after_kobo >= 0),
  reference text NOT NULL UNIQUE,
  kind text NOT NULL,
  transaction_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX ledger_entries_user_created_idx
  ON ledger_entries (user_id, created_at DESC, id DESC);
CREATE INDEX ledger_entries_wallet_idx ON ledger_entries (wallet_id);

CREATE FUNCTION ledger_entries_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only';
END;
$$;

CREATE TRIGGER ledger_entries_no_update
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_reject_mutation();

CREATE TRIGGER ledger_entries_no_delete
  BEFORE DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_reject_mutation();

CREATE TABLE transactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  reference text NOT NULL UNIQUE,
  type text NOT NULL CHECK (
    type IN ('airtime', 'data', 'electricity', 'cable', 'exam', 'wallet_funding')
  ),
  status text NOT NULL CHECK (
    status IN (
      'created',
      'awaiting_payment',
      'processing',
      'successful',
      'failed',
      'reversal_pending',
      'reversed',
      'refunded',
      'uncertain'
    )
  ),
  amount_kobo bigint NOT NULL CHECK (amount_kobo >= 0),
  fee_kobo bigint NOT NULL DEFAULT 0 CHECK (fee_kobo >= 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  recipient jsonb NOT NULL DEFAULT '{}'::jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_reference text,
  failure_reason text,
  simulated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE INDEX transactions_user_created_idx
  ON transactions (user_id, created_at DESC, id DESC);
CREATE INDEX transactions_status_idx ON transactions (status);

CREATE TABLE funding_attempts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  reference text NOT NULL UNIQUE,
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  status text NOT NULL CHECK (
    status IN ('awaiting_payment', 'successful', 'failed', 'abandoned')
  ),
  provider text NOT NULL CHECK (provider IN ('paystack', 'simulated')),
  provider_reference text,
  authorization_url text,
  simulated boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE INDEX funding_attempts_user_created_idx
  ON funding_attempts (user_id, created_at DESC);

CREATE TABLE idempotency_keys (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('in_progress', 'completed')),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (user_id, key)
);

CREATE TABLE audit_events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users (id),
  action text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  created_at timestamptz NOT NULL
);

CREATE INDEX audit_events_user_created_idx
  ON audit_events (user_id, created_at DESC);

CREATE TABLE webhook_events (
  id text PRIMARY KEY,
  provider text NOT NULL,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  processed_at timestamptz NOT NULL
);

CREATE TABLE provider_requests (
  id uuid PRIMARY KEY,
  transaction_id uuid REFERENCES transactions (id),
  provider text NOT NULL,
  operation text NOT NULL,
  request jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'uncertain')),
  created_at timestamptz NOT NULL
);

CREATE INDEX provider_requests_transaction_idx
  ON provider_requests (transaction_id, created_at DESC);

CREATE TABLE support_tickets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id),
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL
);

CREATE INDEX support_tickets_user_created_idx
  ON support_tickets (user_id, created_at DESC);

CREATE TABLE one_time_tokens (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('password_reset', 'email_verify', 'phone_verify')),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL,
  UNIQUE (kind, token_hash)
);

CREATE INDEX one_time_tokens_user_kind_idx ON one_time_tokens (user_id, kind);
