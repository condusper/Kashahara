# Security model

## Secrets

- Paystack, supplier, JWT, and database secrets live only in the API
  environment. The mobile app receives none of them.
- `services/api/.env.example` contains placeholders only. Real `.env` files are
  git-ignored.
- Production startup refuses to run without a 32+ character `JWT_SECRET` and a
  `DATABASE_URL`, and refuses `ALLOW_SIMULATED_PAYMENTS=true`.
- The HTTP supplier adapter refuses to start without `VTU_BASE_URL` and
  `VTU_API_KEY`.

## Authentication

- Passwords and transaction PINs are hashed with scrypt (N=16384, r=8, p=1) and
  a 16-byte per-secret salt. Comparison uses `timingSafeEqual`.
- Access tokens are HS256 JWTs signed with `JWT_SECRET`, with `iss`/`aud`
  claims and a 15-minute default lifetime.
- Refresh tokens are 32 random bytes, stored as SHA-256 hashes. Refresh rotates
  the token and revokes the previous session.
- Password change and "sign out everywhere" revoke other sessions.
- PIN attempts are rate-limited separately from general requests.

## Transport and headers

- The API disables `x-powered-by`, sets `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, a restrictive
  `Permissions-Policy`, and `Cache-Control: no-store`.
- CORS is an allow-list from `CORS_ORIGINS`. Requests without an `Origin`
  (native apps, server-to-server) are allowed; browser origins must match.
- The mobile client stores tokens in `expo-secure-store` with
  `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Web development falls back to
  `localStorage`; that is a development convenience, not a production target.
- Production deployments must terminate TLS in front of the API.

## Input validation

Every mutating route parses its body with a Zod schema. Validation errors return
`422` with field-level details and never echo secrets. Amounts must be integer
kobo and within per-service limits. Phone numbers are normalised to Nigerian
format before storage or lookup.

## Rate limiting

- A global limiter protects `/api/v1` (default 120 requests/minute).
- Login, registration, password reset, verification, and PIN routes have
  tighter limits.
- The Paystack webhook is mounted before the global limiter so legitimate
  provider retries are not blocked. Health checks are also exempt because Render
  probes them continuously.
- When `REDIS_URL` is set, counters are shared across API instances through
  Redis. If Redis is unavailable, the limiter falls back to in-process counters
  and keeps the API online.

## Wallet and ledger integrity

- Balances are integer kobo and constrained to be non-negative.
- Every change writes an append-only ledger entry. A database trigger rejects
  `UPDATE` and `DELETE` on `ledger_entries`.
- Debit, ledger entry, and transaction row commit in one database transaction.
- Idempotency keys prevent duplicate debits from retries or double taps.
- A reconciliation endpoint compares the stored balance with the ledger sum.

## Payments

- Paystack webhooks are verified with HMAC SHA-512 over the **raw** request body
  using the secret key. Invalid signatures return `401` and change nothing.
- The webhook event id is recorded so duplicate deliveries are ignored.
- Credit requires a known funding reference and a matching amount. A client
  saying "payment succeeded" is never trusted.
- Only test keys should be used until the integration is verified end-to-end.
  A live secret key must be rotated if it is ever exposed.

## Uncertain supplier outcomes

A timeout or ambiguous supplier response is not treated as success or failure.
The transaction is marked `uncertain` and the debit is retained. Automatic retry
or refund is forbidden because it could double-charge or double-credit. The app
tells the user not to retry and points to support/reconciliation.

## Verification changes

Changing an email or phone number resets that channel's verified flag. A new
address or number is never considered verified merely because the previous one
was.

## Development-only features

- `ALLOW_DEV_CODES=true` returns reset/verification codes in API responses.
- `ALLOW_SIMULATED_PAYMENTS=true` enables the simulated funding endpoint.
- The mock supplier is always labelled `simulated: true`.

All three must be disabled or replaced before production.

## Known gaps

- No email/SMS delivery provider is wired, so verification and reset rely on
  development codes in this build.
- No CSRF concern for the native client (bearer tokens, no cookies), but a web
  deployment would need an explicit CSRF review.
- The file-backed memory store is single-instance only. Production uses
  PostgreSQL; shared rate limiting requires `REDIS_URL`.
