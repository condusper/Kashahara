# Architecture

## Overview

Kashahara is split into three workspaces that share one domain model:

```
Expo app (React Native)
        │  HTTPS / JSON
        ▼
Express API  ──►  PostgreSQL (users, wallets, ledger, transactions)
        │
        ├──►  Paystack (wallet funding, test mode)
        └──►  VTU supplier adapter (mock or HTTP template)
```

The mobile app never holds provider secrets. It talks only to the Kashahara API.

## Shared domain

`packages/shared` is dependency-free so it can run in React Native and Node:

- `types.ts` — transactions, statuses, recipients, catalogue shapes.
- `money.ts` — integer-kobo parsing and formatting.
- `phone.ts` — Nigerian phone normalisation and validation.
- `catalog.ts` — the fictional demo catalogue used as an offline fallback.

Money is always an integer number of kobo. No floating-point arithmetic is used
for balances or amounts.

## API layering

```
routes/        HTTP parsing, auth guards, status codes
services/      business rules and atomic operations
store/         persistence interface (MemoryStore, PostgresStore)
providers/     supplier adapters behind one interface
middleware/    authentication, errors, rate limits, idempotency
```

### Services

- **AuthService** — registration, login, refresh/logout, profile, password
  change/reset, transaction PIN, email/phone verification. Changing an email or
  phone resets that channel's verification flag.
- **WalletService** — funding initialisation, verified Paystack credit,
  ledger reads, reconciliation summary, simulated funding (development only).
- **PurchaseService** — validates catalogue products, debits the wallet, calls
  the supplier, and applies a definitive result. Uncertain outcomes keep the
  debit and mark the transaction `uncertain`.

### Store abstraction

`Store` is the persistence contract. `MemoryStore` backs tests and the
no-database development mode. `PostgresStore` implements the same contract with
SQL and real transactions.

Atomic wallet work runs inside `store.transaction(async (tx) => ...)`. The
Postgres implementation issues `BEGIN` / `COMMIT` / `ROLLBACK` on a dedicated
pool client, so the balance update, ledger append, and transaction row commit
together.

### Idempotency

Purchase and funding endpoints require an `Idempotency-Key` header. The
middleware:

1. Claims `(user_id, key)` atomically.
2. Rejects the same key with a different request body.
3. Replays a completed response for a duplicate request.
4. Returns a conflict if the first request is still in progress.

This prevents a retry or double tap from debiting twice.

## Mobile structure

Expo Router organises the app into route groups:

```
app/
  index.tsx                 Auth-aware redirect
  (auth)/                   Welcome, sign in, sign up, password reset
  (app)/
    (tabs)/                 Home, activity, wallet, account
    airtime.tsx             Airtime purchase
    data.tsx                Data bundle purchase
    electricity.tsx         Meter verification + token purchase
    cable.tsx               Smartcard verification + subscription
    exam.tsx                Exam voucher purchase
    add-money.tsx           Wallet funding
    funding/[reference].tsx Funding status / simulated confirmation
    transaction/[id].tsx    Receipt, status refresh, support entry
    profile.tsx             Profile editing
    security.tsx            PIN, password, sessions
    verify.tsx              Email/phone verification
    support.tsx             FAQ and support tickets
```

State is provided by:

- `ThemeProvider` — system/light/dark tokens, persisted preference.
- `AuthProvider` — session, profile, wallet, token refresh.
- `ToastProvider` — accessible transient feedback.

The catalogue hook loads the API catalogue and falls back to the bundled demo
catalogue when offline, so the UI remains usable without claiming live data.

## Financial invariants

- Wallet balances are integer kobo and never negative.
- Every balance change appends a ledger entry with `balance_after_kobo`.
- `ledger_entries` is append-only; a database trigger rejects `UPDATE` and
  `DELETE`.
- A wallet debit and its transaction row are committed in one database
  transaction.
- A confirmed failed supplier request is reversed with a separate credit entry.
- An uncertain supplier outcome is **not** retried or refunded automatically.
  The debit stays until reconciliation resolves it.
- Paystack credit requires a valid HMAC signature, a matching amount, and a
  known funding reference. Client-reported success is never trusted.

## Environments

| Mode | Store | Supplier | Funding |
| --- | --- | --- | --- |
| `test` | MemoryStore | Mock | Simulated |
| `development` | Memory or Postgres | Mock by default | Paystack if configured, else simulated |
| `production` | Postgres (required) | HTTP adapter (required for live) | Paystack (simulation forbidden) |

Production startup rejects a missing `JWT_SECRET`, a missing `DATABASE_URL`, and
`ALLOW_SIMULATED_PAYMENTS=true`.
