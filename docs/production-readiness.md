# Production and Play Store readiness

This is the gap between the current repository and a real, revenue-earning app
on Google Play. The code is a complete, well-tested skeleton: accounts, wallet,
ledger, purchases, receipts, support tickets, and Paystack plumbing all exist.
What is missing is **live money rails, delivery infrastructure, and the
non-code work Google requires**.

Nothing below is optional for a public launch unless marked otherwise.

---

## 1. Live VTU supplier (the biggest blocker)

Airtime and data now run through live supplier adapters: `VTU_PROVIDER=bigisub`
or `VTU_PROVIDER=ogdams` (with the matching token/PIN). Electricity, cable, and
exam purchases are still rejected by those adapters and refunded until they are
wired. The checklist below covers what remains before every service can be sold.

You need:

- [ ] A contracted VTU/aggregator supplier (for example an aggregator that
      covers MTN, Glo, Airtel, 9mobile, DStv, GOtv, StarTimes, Showmax, and
      WAEC/NECO/JAMB pins).
- [x] Live credentials for airtime and data (Bigisub and Ogdams adapters in
      `services/api/src/providers`).
- [x] Airtime and data endpoints, auth headers, request fields, and
      response/error handling adapted for both suppliers.
- [ ] Contract tests against recorded sandbox responses.
- [x] A funded supplier wallet/prepaid balance, confirmed by live airtime and
      data purchases.
- [ ] A supplier low-balance alert and a defined top-up threshold so live
      orders are not declined during peak traffic.
- [ ] Confirmation of per-product availability, price, validity, and delivery
      SLA. Live data plans come from the supplier; the bundled electricity,
      cable, and exam catalogue in `packages/shared/src/catalog.ts` is still
      demo data and must be replaced before selling those services.
- [ ] Status/reconciliation handling for every product, including electricity
      tokens and exam PINs. Airtime and data reconciliation is implemented,
      including Bigisub polling and Ogdams webhooks.
- [x] Switch `VTU_PROVIDER` to `bigisub` or `ogdams` with the supplier token
      (and Bigisub transaction PIN), then verify airtime and data end-to-end
      with small real amounts. Repeat for electricity, cable, and exam once
      those adapters exist.

Until every service is wired, the app cannot honestly claim to "provide all the
available services".

## 2. Live payments (Paystack)

- [ ] Complete Paystack business/KYC onboarding and obtain live keys.
- [ ] Set `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, and a public
      `PAYSTACK_CALLBACK_URL` (an HTTPS page or deep link, not localhost).
- [ ] Run `npm run paystack:check --workspace @kashahara/api`. It calls the
      read-only balance endpoint and reports test/live mode without printing
      the key. A live key automatically disables simulated funding.
- [ ] Confirm webhook delivery to `https://<api-host>/api/v1/webhooks/paystack`
      and that the dashboard webhook secret matches the API secret.
- [ ] Verify the full funding lifecycle with real cards and bank transfers:
      initialize → checkout → webhook → wallet credit → receipt.
- [ ] Test duplicate webhooks, wrong amounts, abandoned payments, and refunds.
- [ ] Set `ALLOW_SIMULATED_PAYMENTS=false` (production already refuses `true`).
- [ ] Decide fees: Paystack charges a percentage. Airtime now carries a
      separate service fee (`AIRTIME_FEE_PERCENT`, default `2.5%`) that covers
      the gateway cost and keeps every sale profitable. Wallet funding still has
      no fee; either absorb the Paystack charge on funding or add an explicit
      funding fee.

## 3. Production backend

- [x] Managed PostgreSQL, Redis, HTTPS, health checks, and pre-deploy migrations
      are defined in `render.yaml` for Render. See
      [deployment.md](deployment.md).
- [ ] Apply the Render blueprint and confirm the live database has automated
      backups, point-in-time recovery, and TLS.
- [ ] Run migrations against production (`preDeployCommand` does this
      automatically). Migrations live in `services/api/src/migrations`
      (`001_init.sql`, `002_provider_reference.sql`); add a new file for every
      future schema change.
- [ ] Deploy the API to a real host with HTTPS, a stable domain, health checks,
      and at least two instances.
- [x] Shared Redis-backed rate limiting with an in-memory fallback. Set
      `REDIS_URL` before running multiple instances.
- [ ] Add structured logs, error tracking (Sentry or similar), uptime
      monitoring, and alerts for failed purchases, webhook failures, supplier
      timeouts, and low supplier balance.
- [ ] Add a scheduled reconciliation job for `uncertain` transactions and a
      daily ledger-vs-balance check (`/wallet/reconciliation` exists but is
      manual).
- [ ] Define a data retention and backup policy.

## 4. Email, SMS, and verification

`ALLOW_DEV_CODES=true` currently returns reset and verification codes in API
responses. That is development-only.

- [ ] Wire a transactional email provider (Resend, Postmark, SES) for email
      verification, password reset, receipts, and security alerts.
- [ ] Wire an SMS provider (Termii, Africa's Talking, Twilio) for phone
      verification and transaction alerts. SMS is expected in Nigeria.
- [ ] Set `ALLOW_DEV_CODES=false` in production.
- [ ] Add templates, retry handling, and per-channel rate limits.
- [ ] Consider OTP login and device/session alerts.

## 5. Product completeness

- [ ] Replace the demo catalogue with live supplier pricing and availability.
- [ ] Add an admin/operations surface (even a protected internal web page) for:
      users, transactions, uncertain orders, refunds, support tickets, supplier
      balance, and manual reconciliation. None exists today.
- [ ] Add push notifications (Expo Notifications) for purchase results, funding
      confirmation, and reversal/refund events.
- [ ] Add user-facing transaction search/filtering and export if the activity
      list grows.
- [ ] Add per-user and per-day limits, velocity checks, and fraud rules.
- [ ] Decide on KYC tiers. Nigerian financial apps usually need identity
      verification and tiered limits; confirm the requirement with your
      compliance adviser.
- [ ] Add a "delete my account" flow (Google Play requires an in-app and web
      deletion path for apps with accounts).
- [ ] Add app version/build info and a proper "About" screen.
- [x] Update the support FAQ and app copy to match the receipt format (receipts
      export as PNG; the README and account/footer copy now agree).

## 6. Legal and Play Store compliance

- [ ] Publish a real Privacy Policy at a public HTTPS URL.
- [ ] Publish Terms of Service at a public HTTPS URL and link both from sign-up
      (the checkbox currently references them without links) and Account.
- [ ] Complete Google Play **Data safety** declarations (what you collect,
      why, whether it is shared, encryption in transit, deletion).
- [ ] Complete the **Financial features** declaration and provide evidence of
      your payment/VTU business model. Google scrutinises money apps.
- [ ] Confirm whether your model needs any Nigerian licence or partner-of-record
      arrangement (VTU/payment aggregation is regulated). Do not launch on legal
      advice from this document alone.
- [ ] Add a support contact, business address, and refund/cancellation policy.
- [ ] Content rating questionnaire, ads declaration, and target audience.
- [ ] Account deletion URL and instructions in the Play Console.

## 7. Android release engineering

`apps/mobile/eas.json` defines `preview` and `production` profiles, and
`app.config.js` has an initial `android.versionCode` / `ios.buildNumber`.
EAS is configured to manage version numbers remotely.

- [ ] `npx eas-cli login` and `npx eas-cli init` to link the Expo project.
- [ ] Confirm the production `EXPO_PUBLIC_API_URL` (HTTPS) in `eas.json`. It is
      baked into the bundle; it cannot be changed later.
- [ ] Generate/secure an upload keystore and store it in EAS credentials.
      Losing it blocks updates.
- [ ] Build an Android App Bundle: `eas build -p android --profile production`.
- [ ] Test the signed AAB on a real device via an internal testing track.
- [ ] Add Play Console listing assets: 512×512 icon, feature graphic
      (1024×500), at least 2 phone screenshots (usually 4–8), short and full
      descriptions, and a privacy policy URL.
- [ ] Complete the store listing, content rating, data safety, and pricing.
- [ ] Roll out to internal → closed → open → production testing.
- [ ] Add EAS Update (optional) only after the native build is stable.

The current Expo config also lacks explicit Android permissions and an
`android.intentFilters` deep-link setup for the payment callback. The
`kashahara://` scheme is registered by Expo, but add intent filters if you want
the link to open from a browser or email. Test the Paystack redirect on a
release build, not only in Expo Go.

## 8. Security and reliability before launch

- [ ] Rotate every secret that has ever been used in development.
- [ ] Confirm TLS everywhere, including the API and database connections.
- [ ] Review token storage, session revocation, PIN lockout, and refresh-token
      rotation with a second pair of eyes.
- [ ] Add dependency and container scanning, and pin/update dependencies.
- [ ] Add a staging environment that mirrors production.
- [ ] Load-test the purchase and funding paths.
- [ ] Write a runbook for: supplier outage, Paystack outage, uncertain orders,
      duplicate debits, and data restore.
- [ ] Add CI that runs typecheck, lint, API tests, and `expo-doctor` on every
      pull request. There is no CI configuration today.

## 9. Minimum definition of "fully functional"

A user can install from Play Store, sign up, verify email/phone, fund a wallet
with a real card, buy real airtime/data/electricity/cable/exam pins, receive the
product or token, see the correct wallet balance and ledger, download a PNG
receipt, and get support when something fails — with monitoring, backups, and a
way to reconcile uncertain orders.

---

## Suggested order

1. Supplier contract + real catalogue + HTTP adapter.
2. Paystack live keys + webhook + real funding test.
3. Managed Postgres + production API + Redis rate limiting + monitoring.
4. Email/SMS delivery, disable dev codes.
5. Admin/reconciliation tooling and push notifications.
6. Privacy, terms, data safety, financial declarations.
7. EAS build, signed AAB, internal testing, store listing, rollout.
