# API reference

Base URL: `http://localhost:4000`

All business endpoints are versioned under `/api/v1`. Health is also available
at `/health`.

## Conventions

- Requests and responses are JSON.
- Money is an integer number of kobo (`₦1 = 100`).
- Timestamps are ISO-8601 strings.
- Authenticated routes require `Authorization: Bearer <accessToken>`.
- Purchase and funding routes require an `Idempotency-Key` header
  (8–128 characters, `A-Z a-z 0-9 . _ : -`).
- Every response carries `X-Request-Id`. Error bodies include the same id.

### Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some of the information you entered is not valid.",
    "details": [{ "path": "phone", "message": "Enter a valid Nigerian phone number" }],
    "requestId": "8c1f..."
  }
}
```

Common codes: `VALIDATION_ERROR` (422), `UNAUTHORIZED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), `INSUFFICIENT_FUNDS`
(422), `PROVIDER_ERROR` (502), `INTERNAL_ERROR` (500).

## Health

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` or `/api/v1/health` | Service, store, provider, and feature status |

```json
{
  "status": "ok",
  "service": "kashahara-api",
  "version": "0.1.0",
  "env": "development",
  "time": "2026-10-30T00:00:00.000Z",
  "store": "postgres",
  "provider": { "name": "mock", "simulated": true },
  "paystackConfigured": false,
  "simulatedFundingEnabled": true,
  "catalogVersion": "demo-2026-10"
}
```

## Authentication

| Method | Path | Auth | Body |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | no | `fullName`, `email`, `phone`, `password` |
| POST | `/api/v1/auth/login` | no | `identifier` (email or phone), `password` |
| POST | `/api/v1/auth/refresh` | no | `refreshToken` |
| POST | `/api/v1/auth/logout` | no | `refreshToken` |
| POST | `/api/v1/auth/logout-all` | yes | — |
| GET | `/api/v1/auth/me` | yes | — |
| PATCH | `/api/v1/auth/me` | yes | `fullName?`, `email?`, `phone?` |
| POST | `/api/v1/auth/change-password` | yes | `currentPassword`, `newPassword` |
| POST | `/api/v1/auth/transaction-pin` | yes | `password`, `pin` (4–6 digits) |
| POST | `/api/v1/auth/forgot-password` | no | `identifier` |
| POST | `/api/v1/auth/reset-password` | no | `token`, `newPassword` |
| POST | `/api/v1/auth/verify/request` | yes | `channel`: `email` or `phone` |
| POST | `/api/v1/auth/verify/confirm` | yes | `channel`, `code` |

Register/login/refresh return an `AuthSessionResponse`:

```json
{
  "accessToken": "…",
  "refreshToken": "…",
  "accessTokenExpiresAt": "2026-10-30T00:15:00.000Z",
  "user": {
    "id": "…",
    "fullName": "Ada Okafor",
    "email": "ada@example.test",
    "phone": "08031234567",
    "emailVerified": false,
    "phoneVerified": false,
    "hasTransactionPin": false,
    "createdAt": "2026-10-30T00:00:00.000Z"
  },
  "wallet": { "id": "…", "balanceKobo": 0, "currency": "NGN", "updatedAt": "…" }
}
```

Changing an email or phone number resets that channel's verified flag. In
development with `ALLOW_DEV_CODES=true`, verification and reset endpoints return
a `devCode` / `devToken` so the flow can be exercised without email or SMS.

## Catalogue

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/catalog` | no | Networks, data plans, billers, cable packages, exam products |

The response includes `catalog`, `provider: { name, simulated }`, `notice`, and
`version`. Demo entries carry `isDemo: true`. The catalogue also carries
`airtimeFee: { percent, minKobo }`, the fee the API applies to airtime; the app
uses it to show the same total the API will charge.

## Wallet

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/wallet` | yes | Wallet, recent ledger, reconciliation summary |
| GET | `/api/v1/wallet/ledger?limit=20` | yes | Ledger entries (1–50) |
| GET | `/api/v1/wallet/reconciliation` | yes | Stored balance vs ledger sum |
| POST | `/api/v1/wallet/funding` | yes | Start a funding attempt |
| GET | `/api/v1/wallet/funding/:reference` | yes | Funding status |
| POST | `/api/v1/wallet/funding/:reference/simulate` | yes | Development-only simulated credit |

Start funding:

```http
POST /api/v1/wallet/funding
Idempotency-Key: fund-2026-10-30-001
Content-Type: application/json

{ "amountKobo": 500000 }
```

`amountKobo` must be between `10000` (₦100) and `10000000` (₦100,000).

Response `201`:

```json
{
  "funding": { "reference": "FUND-…", "amountKobo": 500000, "status": "awaiting_payment", "…": "…" },
  "mode": "paystack",
  "authorizationUrl": "https://checkout.paystack.com/…",
  "message": "Complete the payment to fund your wallet."
}
```

`mode` is `paystack` when a secret key is configured, otherwise `simulated`.
The simulated credit endpoint is disabled in production, and it is always
disabled when the configured key is a live key (`sk_live_`).

The API derives test/live mode from the key prefix. `GET /api/v1/health`
reports `paystackMode` (`test`, `live`, `unknown`, or `null`) without exposing
the key. Use `npm run paystack:check --workspace @kashahara/api` to confirm a
new key with a read-only balance call before accepting payments.

Paystack reports an initialized-but-unpaid checkout as `abandoned`
immediately, so the API keeps the attempt open for 30 minutes before closing
it. A `charge.success` webhook still credits the wallet after that window, so a
customer who pays late is never lost.

## Purchases

All purchase routes are authenticated and idempotent.

| Method | Path | Body |
| --- | --- | --- |
| POST | `/api/v1/purchases/verify-meter` | `billerId`, `meterNumber`, `meterType` |
| POST | `/api/v1/purchases/verify-cable` | `providerId`, `smartcardNumber` |
| POST | `/api/v1/purchases/airtime` | `network`, `phone`, `amountKobo`, `pin` |
| POST | `/api/v1/purchases/data` | `network`, `phone`, `planId`, `pin` |
| POST | `/api/v1/purchases/electricity` | `billerId`, `meterNumber`, `meterType`, `amountKobo`, `pin` |
| POST | `/api/v1/purchases/cable` | `providerId`, `smartcardNumber`, `packageId`, `pin` |
| POST | `/api/v1/purchases/exam` | `productId`, `quantity` (1–5), `pin` |

`network` is `MTN`, `GLO`, `AIRTEL`, or `9MOBILE`. `meterType` is `prepaid` or
`postpaid`. Amount limits: airtime ₦50–₦50,000; electricity ₦500–₦500,000.

Airtime is charged as the requested face value plus a service fee. The fee is
`AIRTIME_FEE_PERCENT` of the face value (default `2.5`), rounded up to the next
whole Naira, with `AIRTIME_FEE_MIN_KOBO` (default `100`, i.e. ₦1) as the floor.
`amountKobo` holds the face value, `feeKobo` the service fee, and `totalKobo`
the amount debited from the wallet. Only the face value is sent to the supplier.
A failed order is refunded for the full debit, including the fee. The fee is
mirrored in `details.faceValueKobo` and `details.serviceFeeKobo`.

Purchase response `201`:

```json
{
  "transaction": {
    "id": "…",
    "reference": "…",
    "type": "airtime",
    "status": "successful",
    "amountKobo": 100000,
    "feeKobo": 2500,
    "totalKobo": 102500,
    "currency": "NGN",
    "recipient": { "phone": "08031234567", "network": "MTN" },
    "details": {
      "network": "MTN",
      "phone": "08031234567",
      "faceValueKobo": 100000,
      "serviceFeeKobo": 2500,
      "providerMessage": "Airtime purchase successful",
      "simulated": true
    },
    "providerReference": "MOCK-…",
    "failureReason": null,
    "simulated": true,
    "createdAt": "…",
    "updatedAt": "…",
    "completedAt": "…"
  },
  "wallet": { "balanceKobo": 2400000, "…": "…" },
  "simulated": true
}
```

A supplier decline returns a transaction with status `failed` and a separate
reversal credit in the ledger. A supplier timeout returns status `uncertain` and
keeps the debit in place.

## Transactions

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/transactions?type=&status=&limit=&cursor=` | yes | Cursor-paginated history |
| GET | `/api/v1/transactions/:id` | yes | One transaction and current wallet |
| POST | `/api/v1/transactions/:id/refresh` | yes | Ask the supplier for a definitive status |

Refresh only reverses a transaction when the supplier returns a definitive
`failed`. Pending or uncertain results leave the debit untouched.

## Support

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/support/faq` | no | FAQ entries |
| GET | `/api/v1/support/tickets` | yes | Current user's tickets |
| POST | `/api/v1/support/tickets` | yes | `subject` (3–160), `message` (10–4000) |

## Webhooks

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/v1/webhooks/paystack` | Paystack event receiver |

Register `https://<api-host>/api/v1/webhooks/paystack` in the Paystack
dashboard. The webhook verifies the raw request body with HMAC SHA-512 using
`PAYSTACK_SECRET_KEY`, records the event id for idempotency, and credits only a
known funding reference with a matching amount and currency. It is mounted
before the global rate limiter so legitimate Paystack retries are not rejected.
The endpoint always returns `200` for a signed but irrelevant event so Paystack
does not retry it forever; only an invalid signature returns `401`.

## Idempotency

```http
Idempotency-Key: mob-m8x2k-4f9c1a2b3d4e
```

- The same key with the same body replays the original response and sets
  `Idempotent-Replay: true`.
- The same key with a different body returns `409 CONFLICT`.
- A concurrent request while the first is still running returns `409`.
