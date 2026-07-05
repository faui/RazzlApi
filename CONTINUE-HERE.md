# Continue Here — Razzl API

## Current status

**Slice 10 implemented** — Shopify Billing / App Pricing (`appSubscriptionCreate`, billing webhooks, entitlement projection, embedded billing UI, feature gating).

## Current branch

Merge to `main` and deploy api-dev. Re-run OAuth or `shopify app deploy` to register billing webhook subscriptions and scopes.

## Last completed slice

**Slice 10** — Shopify billing adapter, `commerce_billing_account` writes, billing API routes, webhook handlers, map/sync/CTA gating, embedded billing panel

## Next slice

**Slice 12** — App Store readiness (or Slice 9 analytics enhancements per backlog)

## Exact next steps

1. Push to `main` — confirm `Deploy API to Dev` succeeds
2. `shopify app deploy` from `api/` (registers `app_subscriptions/update` webhook)
3. Partner Dashboard: confirm app uses **manual pricing** (not managed) and **public distribution** for Billing API on dev stores
4. Dev store E2E: link tenant → Billing panel → approve plan → map product → verify `tenant_subscription` row
5. Trigger `app_subscriptions/update` webhook; confirm idempotency + entitlement projection

## Files changed (Slice 10)

| Path | Purpose |
|------|---------|
| `lib/commerce/adapters/shopify/billing.ts` | `appSubscriptionCreate`, billing status GraphQL |
| `lib/commerce/adapters/shopify/graphql-client.ts` | Admin GraphQL helper |
| `lib/commerce/core/billing/billing-service.ts` | Lane resolution, session creation, webhook apply |
| `lib/commerce/core/billing/billing-account-repo.ts` | `commerce_billing_account` CRUD |
| `lib/commerce/core/billing/subscription-tier-catalog.ts` | Plan parity from `master_subscription_tier` |
| `lib/commerce/core/billing/tenant-subscription-projection.ts` | Entitlement projection (reuse `tenant_subscription`) |
| `app/api/commerce/billing/status/route.ts` | Billing status + plans |
| `app/api/commerce/billing/session/route.ts` | Create Shopify billing session |
| `app/shopify/shopify-billing-panel.tsx` | Embedded billing UI |
| `lib/commerce/core/events/webhook-processor-service.ts` | `app_subscriptions/*` + uninstall billing cleanup |
| `lib/commerce/adapters/shopify/webhooks.ts` | Billing webhook normalization |
| `shopify.app.toml` | Billing webhook topics |
| `docs/commerce/SLICE-10-DEVIATIONS.md` | Guideline deviations |

## Studio companion (billing_source routing)

| Path | Purpose |
|------|---------|
| `lib/commerce-billing-lane.ts` | Detect `shopify_billing` lane |
| `app/api/tenant/commerce-billing-lane/route.ts` | API for Studio UI |
| `app/app/billing/page.tsx` | Suppress Stripe portal when Shopify-billed |
| `app/app/subscription/page.tsx` | Suppress Stripe checkout/portal when Shopify-billed |

## Validation status

- [ ] api-dev deployed with Slice 10
- [ ] Dev store approves test plan (`SHOPIFY_BILLING_TEST=true`)
- [ ] `app_subscriptions/update` updates `commerce_billing_account` + `tenant_subscription`
- [ ] Map/sync/CTA gated until billing active (Shopify lane)
- [ ] Stripe lane unchanged for direct customers
- [ ] Lint + tests pass locally

## Recommended next Composer prompt

```text
Validate Slice 10 E2E on api-dev dev store per CONTINUE-HERE.md. Then start Slice 12 App Store readiness checklist.
```
