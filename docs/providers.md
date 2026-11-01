# Supplier adapters

Kashahara talks to VTU suppliers through one interface, `VtuProvider`. The rest
of the API does not know which supplier is in use.

```ts
interface VtuProvider {
  readonly name: string;
  readonly isSimulated: boolean;
  purchaseAirtime(request: AirtimeRequest): Promise<ProviderPurchaseResult>;
  purchaseData(request: DataRequest): Promise<ProviderPurchaseResult>;
  verifyMeter(request: MeterRequest): Promise<MeterVerification>;
  purchaseElectricity(request: ElectricityRequest): Promise<ProviderPurchaseResult>;
  verifyCable(request: CableVerifyRequest): Promise<CableVerification>;
  purchaseCable(request: CablePurchaseRequest): Promise<ProviderPurchaseResult>;
  purchaseExam(request: ExamRequest): Promise<ProviderPurchaseResult>;
  getStatus(providerReference: string): Promise<ProviderStatusResult>;
  /** Optional: a supplier-published data catalogue. */
  listDataPlans?(): Promise<readonly DataPlan[]>;
}
```

Adapters live in `services/api/src/providers`. `createProvider(config)` selects
one at startup:

- `VTU_PROVIDER=mock` (default) → `MockVtuProvider`
- `VTU_PROVIDER=http` → `HttpVtuProvider` (requires `VTU_BASE_URL` and
  `VTU_API_KEY`)
- `VTU_PROVIDER=ogdams` → `OgdamsVtuProvider` (requires `OGDAMS_API_KEY`,
  optional `OGDAMS_BASE_URL` and `OGDAMS_AIRTIME_TYPE`, default `vtu`)
- `VTU_PROVIDER=bigisub` → `BigisubVtuProvider` (requires `BIGISUB_API_TOKEN`
  and a four-digit `BIGISUB_TRANSACTION_PIN`, optional `BIGISUB_BASE_URL`,
  default `https://api.bigisub.ng`)

## MockVtuProvider

Development only. It never contacts a supplier and never delivers a real
product. It is deterministic so tests and demos are repeatable:

| Identifier ends with | Outcome |
| --- | --- |
| `0000` | Definitive decline (`ProviderRejectedError`) |
| `9999` | Timeout / no definitive result (`ProviderTimeoutError`) |
| anything else | Success |

The identifier is the phone number, meter number, or smartcard number. Every
result carries `simulated: true`, and the API stores that flag on the
transaction. Electricity tokens and exam PINs are clearly fake
(`SIM-ELEC-…`, `SIM-…`).

The mock's `getStatus` returns `failed` when the provider reference contains
`FAIL`, otherwise `successful`. This is used to exercise the refresh path.

## HttpVtuProvider

A template for a contracted supplier. It is deliberately generic because
supplier contracts differ. Before enabling it:

1. Read the supplier's API documentation.
2. Adapt the endpoint paths and request/response field mappings in
   `providers/http.ts`.
3. Confirm authentication headers and error semantics.
4. Verify every operation in the supplier's sandbox.
5. Add contract tests against recorded sandbox responses.
6. Only then set `VTU_PROVIDER=http` in production.

The adapter maps supplier failures to two distinct errors:

- `ProviderRejectedError` — the supplier definitively declined. The purchase is
  refunded with a separate ledger credit.
- `ProviderTimeoutError` — the request may have been received but no definitive
  result is available. The transaction becomes `uncertain` and the debit is
  **kept**. Do not retry or refund until reconciliation.

`ProviderNotConfiguredError` is raised if credentials are missing.

## OgdamsVtuProvider

Live adapter for Ogdams SimHosting (`https://simhosting.ogdams.ng/api/v1`),
authenticated with `Authorization: Bearer <OGDAMS_API_KEY>`. It supports
airtime and data through:

| Operation | Endpoint | Body |
| --- | --- | --- |
| Live catalogue | `GET /get/data/plans` | — |
| Airtime | `POST /vend/airtime` | `networkId`, `amount` (Naira), `phoneNumber`, `type`, `reference` |
| Data | `POST /vend/data` | `networkId`, `planId`, `phoneNumber`, `reference` |

Network ids are `MTN=1`, `Airtel=2`, `Glo=3`, `9mobile=4`. Ogdams responses are
shaped `{ status, code, data: { msg, ref } }`: `200` is successful, `201`/`202`
mean queued or processing, and `424` (or `status: false`) is a definitive
decline. `201`/`202` become `ProviderPendingError`: the wallet debit is kept and
the transaction stays `processing` until a webhook or manual reconciliation
provides the final result. Airtime uses `OGDAMS_AIRTIME_TYPE` (default `vtu`,
lowercase), one of `vtu`, `momo`, `sns`, or `awuf4u`.

Before live vending works, the Ogdams account must have the requested channel
profile configured. Without it the supplier rejects the request with
`424 — You are yet to set your MTN - MOMO [Cloud] Profile.` for airtime or
`424 — You are yet to set your MTN-DATA-GIFTING(DG)/AWOOF [Cloud] Profile.` for
data (or the equivalent for the selected network), and no funds are moved. In
the Ogdams dashboard, complete the SIM Hosting profile for each network and
channel you want to sell: choose the hosting type (cloud SIM, device SIM, or
wallet-only), link the SIM, and activate the matching airtime or data profile. A
wallet balance alone does not create the profile. The same 424 response is
returned for the native `POST /vend/airtime` endpoint and the SmePlug- and
Msorg-compatible endpoints, so retrying through a different endpoint does not
bypass the missing profile.

The live data catalogue replaces the bundled demo plans in `GET /catalog`.
Plans are cached for five minutes. Unpriced products (for example
`[DATA_SHARE]`) and products without a recognisable data allowance are skipped.
The numeric Ogdams `planId` is exposed as the catalogue plan id, so a purchase
can only send a plan the supplier actually sells.

Ogdams does not publish electricity, cable, or exam APIs, and it does not
expose a documented transaction-status endpoint. Those operations are rejected
(and refunded) and `getStatus` reports `pending`; check the Ogdams dashboard for
reconciliation.

Set the supplier webhook to
`https://<api-host>/api/v1/webhooks/ogdams` in the Ogdams dashboard. Ogdams
signs the raw body with HMAC-SHA512 using the API secret and sends the digest in
`ogdams-simhosting-signature` (a `sha512=` prefix and hex or base64 digests are
accepted). The payload shape is not documented, so reference, status, and
message fields are discovered recursively. A signed success marks the order
`successful`, a signed failure reverses the debit exactly once, and an
unrecognised reference is acknowledged without changing any wallet.

## BigisubVtuProvider

Wallet-only adapter for Bigisub (`https://api.bigisub.ng`). It needs no SIM
hosting, cloud profile, or licence: fund the Bigisub wallet and buy directly.
Authentication is `Authorization: Token <BIGISUB_API_TOKEN>`. Every purchase
also sends the account's four-digit transaction PIN, which is why the PIN is a
server-only secret and must never reach the mobile app.

| Operation | Endpoint | Body |
| --- | --- | --- |
| Live catalogue | `GET /api/v2/vtu/data/plans/` | — |
| Wallet balance | `GET /api/v2/financial/wallet/balance/` | — |
| Airtime | `POST /api/v2/vtu/airtime/purchase/` | `network`, `phone_number`, `amount` (Naira string), `airtime_type: "vtu"`, `pin` |
| Data | `POST /api/v2/vtu/data/purchase/` | `network`, `plan` (numeric id), `phone_number`, `pin` |
| Status | `GET /api/v2/anubis/transactions/{transaction_id}/` | — |
| Active requery | `POST /api/v2/anubis/transactions/{transaction_id}/requery/` | — |

Network ids are **`MTN=1`, `Glo=2`, `Airtel=3`, `9mobile=4`**. Bigisub published
`2` and `3` the wrong way round until 26 October 2026, and Ogdams uses a
different map, so never copy one adapter's ids into the other.

Airtime is whole Naira only, with a ₦25 minimum; a request for less is rejected
before anything is sent. Data purchases always refresh the live catalogue and
compare the plan price first, so a stale price is rejected (and refunded)
instead of being sent. Plans with `plan_disabled: true`, a zero price, or an
unrecognised allowance are hidden from the catalogue. The catalogue is cached
for five minutes.

Purchase responses carry `transaction_id`, `reference`, and `status`. A
successful status returns `providerReference = transaction_id`; `processing`
becomes `ProviderPendingError` and keeps the debit. Bigisub has **no webhooks and
no callbacks**, so pending orders are reconciled by polling. `getStatus` reads
the `anubis` detail endpoint and, when the order is still pending, makes an
active requery so the upstream provider is asked for a final result. A `404` is
treated as pending (not failed), because the supplier may not have recorded the
order yet, and a `429` requery is treated as still pending. Bigisub throttles
requery to one attempt every 30 seconds per transaction.

The API also runs a background reconciliation pass every
`PURCHASE_RECONCILE_INTERVAL_MS` (default `60000`). It picks up `processing` and
`uncertain` orders that have not been checked in the last 30 seconds, polls them
oldest-first, and settles or refunds them. Set the interval to `0` to disable
the job. Without it, a pending order would wait for the customer to tap refresh.

Customer-facing data prices are the live supplier price plus
`DATA_MARKUP_PERCENT` (default `3`), rounded up to the next whole Naira. Set it
to `0` to sell at supplier cost. The same marked-up price is used for catalogue
display and purchase validation, so a price cannot drift between the two.

Airtime is charged as the requested face value plus a service fee of
`AIRTIME_FEE_PERCENT` (default `2.5`), rounded up to the next whole Naira, with
`AIRTIME_FEE_MIN_KOBO` (default `100`, i.e. ₦1) as the floor. Only the face
value is sent to Bigisub; the fee covers the Paystack funding cost. For example,
a ₦50 top-up costs the customer ₦52 (₦1.25 fee rounds up to ₦2), while the
supplier receives a ₦50 order. The fee is stored as `feeKobo` and repeated in
`details.serviceFeeKobo`, with the face value in `details.faceValueKobo`. A
refund returns the full debit, including the fee.

Bigisub also publishes electricity, cable TV, recharge PIN, education, ISP,
betting, and SMS APIs. The current adapter rejects those operations (and refunds
the wallet) until they are wired; only airtime and data are live.

## Outcome handling

| Supplier result | Transaction status | Wallet |
| --- | --- | --- |
| Success | `successful` | Debit stays |
| Queued / processing (`201`/`202`) | `processing` | Debit stays |
| Definitive decline | `failed` | Debit reversed with a credit entry |
| Timeout / ambiguous | `uncertain` | Debit stays until reconciliation |
| Status refresh says failed | `failed` | Debit reversed once |
| Status refresh says successful | `successful` | Debit stays |
| Status refresh still pending | `processing` / `uncertain` | No change |

A reversal is idempotent: the ledger reference for a purchase reversal is
derived from the original purchase reference, so a retry cannot credit twice.

## Adding a supplier

1. Implement `VtuProvider` in a new file.
2. Return `simulated: false` only for a real integration.
3. Map every failure to a definitive or uncertain error; never throw a generic
   error for an ambiguous network failure.
4. Add the adapter to `createProvider`.
5. Add tests using a stub `fetch` or recorded fixtures.
6. Document the supplier contract and any operational caveats.

## What is not claimed

The repository does not contain supplier credentials. With
`VTU_PROVIDER=mock` (the default), no real airtime, data, electricity token,
cable subscription, or exam PIN is delivered. The Ogdams and Bigisub adapters
are wired for live airtime and data. Bigisub airtime and data have been
delivered end-to-end in live tests; re-run a small funded purchase as a smoke
test after changing supplier credentials or pricing. Bigisub has no webhook, so
pending orders are reconciled by the polling job described above.
