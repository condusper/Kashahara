# Kashahara

Kashahara is a premium Nigerian VTU and digital-payments app: wallet funding,
airtime, data bundles, electricity tokens, cable TV, and exam PINs.

The repository is an npm-workspaces monorepo:

| Workspace | Path | Stack |
| --- | --- | --- |
| Mobile app | `apps/mobile` | Expo SDK 58, React Native 0.88, Expo Router, TypeScript |
| API | `services/api` | Node.js 22, Express 5, TypeScript, PostgreSQL, Zod |
| Shared domain | `packages/shared` | Framework-free types, money helpers, phone helpers, bundled catalogue |

## Environment notes

The app is built for a live launch. The repository ships with a local supplier
adapter so the full purchase, ledger, and receipt lifecycle can be exercised
without external credentials.

- Set `VTU_PROVIDER=bigisub` with `BIGISUB_API_TOKEN` and
  `BIGISUB_TRANSACTION_PIN` to route airtime and data through the live Bigisub
  wallet supplier (all four networks, no SIM hosting or cloud profiles). The
  adapter only supports airtime and data so far; other services are refunded
  until wired. `VTU_PROVIDER=http` remains available for a generic contracted
  supplier. Verify every endpoint against the supplier before live traffic.
  Before the first purchase, confirm the token and wallet without moving money:
  `npm run bigisub:check --workspace @kashahara/api`. Live data prices include
  `DATA_MARKUP_PERCENT` (default `3`, rounded up to whole Naira). Airtime adds
  `AIRTIME_FEE_PERCENT` (default `2.5`, rounded up to whole Naira, with an
  `AIRTIME_FEE_MIN_KOBO` floor of ₦1) as a separate service fee. Pending orders
  are auto-reconciled every `PURCHASE_RECONCILE_INTERVAL_MS` (default `60000`).
  Bigisub has no webhooks.
- Set `PAYSTACK_SECRET_KEY` to enable hosted Paystack checkout. Without it, the
  API can still complete wallet funding locally; this is controlled by
  `ALLOW_SIMULATED_PAYMENTS` and must be disabled in production.
- Paystack test/live mode is derived from the key prefix (`sk_test_` /
  `sk_live_`). A live key always disables simulated funding. After pasting a
  key, confirm it with the read-only balance check:
  `npm run paystack:check --workspace @kashahara/api`. Register
  `https://<api-host>/api/v1/webhooks/paystack` in the Paystack dashboard. If
  using Ogdams, also register `https://<api-host>/api/v1/webhooks/ogdams`.
  Both webhook routes verify the supplier signature before changing any wallet.
  Bigisub has no webhooks: its pending orders are reconciled by polling
  `GET /api/v2/anubis/transactions/{transaction_id}/`.
- The bundled catalogue in `packages/shared` is an offline fallback. The API
  serves the authoritative catalogue at runtime.
- Every successful purchase and wallet funding attempt produces a downloadable
  PNG receipt from the app.

## Requirements

- Node.js 22 or newer
- npm 10 or newer (npm 9.2 has a cache race on Node 22; use npm 10 if installs
  fail with `ENOENT ... _cacache`)
- PostgreSQL 14+ for the durable store (optional for local development)
- Expo Go or a development build for the mobile app

## Install

```bash
npm install
```

## Configure the API

```bash
cp services/api/.env.example services/api/.env
```

At minimum, review `JWT_SECRET`, `DATABASE_URL`, `PAYSTACK_SECRET_KEY`, and
`VTU_PROVIDER`. Secrets belong only in the API environment, never in the mobile
app.

If `DATABASE_URL` is omitted in development, the API uses a file-backed store at
`services/api/.data/memory-store.json` and logs a prominent warning. Data
survives restarts, but this is not a production database: it is single-process,
not transactional across processes, and must not be used for live traffic.

## Run

```bash
# API (http://localhost:4000)
npm run dev:api

# Mobile (Expo dev server)
npm run dev:mobile
```

The mobile client resolves the API base URL from `EXPO_PUBLIC_API_URL`, then
`expo.extra.apiUrl` in `apps/mobile/app.config.js`, then defaults to
`http://localhost:4000/api/v1` (`10.0.2.2` on the Android emulator).

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000/api/v1 npm run dev:mobile
```

The mobile start script serves plain JavaScript so the dev server also works in
sandboxed environments where the Hermes bytecode compiler cannot run. Use
`npm run start:hermes --workspace @kashahara/mobile` to precompile bytecode.

## Production deployment

The API is prepared for Render: a `render.yaml` blueprint provisions PostgreSQL,
a Redis-compatible Key Value instance for shared rate limiting, HTTPS, health
checks, and pre-deploy migrations. See [Deploying to production](docs/deployment.md)
for the exact steps, secrets, Paystack webhook URL, and EAS Android build.

Production builds compile `@kashahara/shared` to `packages/shared/dist`; the
mobile app still resolves the shared package's TypeScript source through the
`react-native` export condition.

```bash
# Production-style API build and start
npm run build:api
node services/api/dist/index.js

# Apply migrations against DATABASE_URL
node services/api/dist/migrate.js
```

`REDIS_URL` is optional for a single instance and required before scaling to
more than one API instance. When Redis is unavailable, the API falls back to
in-process counters so it stays online.

## Database

```bash
# Apply migrations (requires DATABASE_URL)
npm run migrate

# Seed a sample account and transactions (refuses production)
npm run seed
```

Seed credentials (local development only):

- Email: `demo@kashahara.test`
- Password: `DemoPass123!`
- Transaction PIN: `1234`

Migrations live in `services/api/src/migrations` and are copied into `dist` by
the build.

## Checks

```bash
npm run typecheck   # all workspaces
npm test            # API test suite (node:test via tsx)
```

Mobile-only checks:

```bash
npx tsc --noEmit -p apps/mobile/tsconfig.json
npm run lint --workspace @kashahara/mobile
npm run doctor --workspace @kashahara/mobile
```

## Project layout

```
apps/mobile/
  app/                 Expo Router routes (auth, tabs, purchase flows, account)
  src/components/      Design-system components
  src/hooks/           Catalogue, wallet, purchase, transaction hooks
  src/lib/             API client, token storage, formatting
  src/providers/       Auth, theme, and toast providers
  src/theme/           Design tokens and tone palettes
services/api/
  src/routes/          Versioned REST routes
  src/services/        Auth, wallet, purchase business logic
  src/store/           MemoryStore and PostgresStore
  src/providers/       Supplier adapters (local and HTTP)
  src/middleware/      Auth, errors, rate limits, idempotency
  src/migrations/      SQL schema
packages/shared/       Shared types, money/phone helpers, bundled catalogue
docs/                  Architecture, API, providers, security, testing
```

## Documentation

- [Architecture](docs/architecture.md)
- [API reference](docs/api.md)
- [Deploying to production](docs/deployment.md)
- [Supplier adapters](docs/providers.md)
- [Security model](docs/security.md)
- [Testing](docs/testing.md)

## Known limitations

- PostgreSQL is not available in every development environment. The Postgres
  store, migrations, and seed can be typechecked but only executed where a
  PostgreSQL server exists.
- Email and SMS delivery are not wired to a provider. Development builds return
  verification and reset codes in the response when `ALLOW_DEV_CODES=true`.
- Reconciliation of `uncertain` supplier outcomes is a manual/operational
  process. The API exposes status refresh and a reconciliation summary; it does
  not silently retry or refund an uncertain order.
- Paystack webhook delivery requires a public URL or a tunnel in local
  development.
