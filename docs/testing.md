# Testing

## Commands

```bash
# All API tests
npm test

# API typecheck
npm run typecheck --workspace @kashahara/api

# All workspace typechecks
npm run typecheck

# Mobile typecheck
npx tsc --noEmit -p apps/mobile/tsconfig.json

# Mobile lint and Expo health check (requires installed mobile deps)
npm run lint --workspace @kashahara/mobile
npm run doctor --workspace @kashahara/mobile
```

The API suite uses Node's built-in test runner through `tsx --test`, so there is
no separate test framework to configure. The mobile lint task checks both
`apps/mobile/app` and `apps/mobile/src`.

## Current results

At the time of writing:

- API typecheck: passes.
- API tests: **89 tests, 15 suites, 0 failures**.
- Mobile typecheck (`tsc --noEmit`): passes.
- Mobile lint (`app` and `src`): passes.
- Expo Doctor: **20/20 checks pass**.

These results are from the local environment. Re-run the commands to confirm the
current tree.

## What the API suite covers

| File | Coverage |
| --- | --- |
| `auth.test.ts` | Registration, duplicate detection, email/phone login, refresh rotation, PIN set/verify, password reset, email verification, verification reset on contact change |
| `wallet.test.ts` | Simulated funding, ledger reconciliation, reference/amount mismatch, overdraft rejection |
| `purchases.test.ts` | Successful debit, airtime service fee, wrong PIN, confirmed rejection refund, uncertain debit retention, reconciliation to success/failure, insufficient funds, exam vouchers, network mismatch |
| `idempotency.test.ts` | Response replay, key reuse with different body, concurrent same-key requests |
| `webhook.test.ts` | Valid Paystack credit, duplicate event, invalid signature, amount mismatch, unknown reference |
| `paystack.test.ts` | Funding initialization, checkout reconciliation, test/live mode handling |
| `bigisub.test.ts` | Bigisub auth, data-plan pricing/markup, purchase requests, status polling and reconciliation |
| `ogdams.test.ts` | Ogdams airtime/data requests, live data-plan catalogue and price checks |
| `ogdams-webhook.test.ts` | Signed Ogdams webhook processing, duplicate handling, unknown references |
| `persistence.test.ts` | File-backed store save/load and restart behaviour |
| `config.test.ts` | Environment parsing, pricing and reconciliation settings, production guards |
| `shared.test.ts` | Phone normalisation/validation/network hints/masking, money formatting and parsing, airtime fee calculation |

The purchase tests use `MockVtuProvider`, whose outcome is controlled by the
identifier suffix (`0000` decline, `9999` timeout). HTTP-level tests use a real
Express app on an ephemeral port and the in-memory store.

## Not covered by automated tests

- **PostgreSQL integration.** No PostgreSQL server is available in the current
  environment. `PostgresStore`, the migration runner, and the seed script are
  typechecked but have not been executed here. Run `npm run migrate` and
  `npm run seed` against a real database before relying on them.
- **Mobile UI.** There are no component or end-to-end tests yet. Mobile checks
  are limited to TypeScript, lint, and Expo Doctor.
- **Paystack sandbox.** Webhook tests sign synthetic payloads. They do not call
  the real Paystack API.
- **Live supplier delivery.** No live supplier credentials are configured, and
  no real VTU delivery has been verified.

## Adding tests

- Put API tests in `services/api/src/tests/*.test.ts`.
- Use `makeHarness()` for an in-memory app and services, and
  `makeHarnessWithProvider()` to inject a stub supplier.
- Use `registerUser()`, `setPin()`, and `fundWallet()` from `helpers.ts`.
- For HTTP behaviour, start the app with `createApp()` and listen on port `0`.
- Assert on wallet balances, ledger entries, and transaction statuses, not only
  on HTTP codes.
- When testing financial behaviour, assert that a duplicate or retry does not
  move money twice.

## Manual smoke test

1. Start the API with no `DATABASE_URL` (memory mode) and the mock supplier.
2. Start the mobile app with `EXPO_PUBLIC_API_URL` pointing at the API.
3. Register a user, set a 4-digit PIN, and fund the wallet with simulated
   funding.
4. Buy airtime with a phone ending in `0000` (decline) and confirm the refund.
5. Buy airtime with a phone ending in `9999` (timeout) and confirm the
   transaction is `uncertain` and the debit remains.
6. Open the transaction, refresh it, and confirm reconciliation behaves as
   documented.
7. Repeat a purchase request with the same idempotency key and confirm the
   wallet is debited once.
