# Slice 10 — E2E Validation Report (api-dev)

**Date:** 2026-07-05  
**Environment:** `https://api-dev.razzl.com`  
**Deploy:** GitHub `Deploy API to Dev` run `28752759266` (success, commit `bug fix`)

## Automated checks (this session)

| Check | Result | Notes |
|-------|--------|-------|
| `GET /health` | ✅ Pass | `{"ok":true}` |
| Webhook route `/api/commerce/shopify/webhooks` | ✅ Pass | Returns 400 without headers (route exists) |
| Wrong deploy path `/shopify/api/.../webhooks` | ❌ Fail (pre-fix) | Returned 404 — **root cause of billing webhook E2E gap** |
| `npm run test:commerce` | ✅ Pass | 52 tests (incl. new billing webhook test) |
| `npm run lint` | ✅ Pass | — |
| `node scripts/slice-10-e2e-smoke.mjs` | ✅ Pass | Without shop arg — infra smoke only |

## Critical fix applied

`shopify.app.toml` used **relative** webhook URIs (`/api/commerce/shopify/webhooks`). With `application_url = https://api-dev.razzl.com/shopify`, Shopify CLI deployed webhooks to:

```text
https://api-dev.razzl.com/shopify/api/commerce/shopify/webhooks  → 404
```

Correct endpoint:

```text
https://api-dev.razzl.com/api/commerce/shopify/webhooks  → 400/401/200
```

**Fix:** absolute HTTPS URIs in `shopify.app.toml`. Re-run `shopify app deploy` after merge.

OAuth install still registers correct URLs via REST (`webhook-register.ts` using `RAZZL_PUBLIC_ORIGIN`); TOML-deployed subscriptions were wrong until this fix.

## Manual E2E checklist (requires dev store + Shopify admin)

Run with your dev store:

```powershell
cd api
node scripts/slice-10-e2e-smoke.mjs YOUR-DEV-STORE.myshopify.com
```

| Step | Status | How to verify |
|------|--------|---------------|
| App installed on dev store | ⬜ Manual | Partner Dashboard → Test on development store |
| Tenant linked to Studio | ⬜ Manual | Embedded app shows tenant name |
| Billing panel shows plans | ⬜ Manual | Billing card → plan dropdown populated |
| Approve test plan (`SHOPIFY_BILLING_TEST=true`) | ⬜ Manual | Redirect to Shopify charge confirmation |
| `app_subscriptions/update` received | ⬜ Manual | After deploy fix + reinstall; check `commerce_platform_event` |
| `commerce_billing_account.platform_billing_status = active` | ⬜ SQL | See query below |
| `tenant_subscription.is_current = 1` projected | ⬜ SQL | Tier matches selected plan |
| Map blocked before billing | ⬜ Manual | Map attempt → `BILLING_REQUIRED` |
| Map succeeds after billing | ⬜ Manual | — |
| Stripe lane unchanged | ⬜ Manual | Link Stripe tenant → Studio billing UI, no Shopify charge |

### SQL helpers (dev DB)

```sql
SELECT store_domain, install_status, tenant_fk, billing_source, platform_billing_status
FROM commerce_platform_connection
WHERE platform_type = 'shopify';

SELECT billing_source, platform_billing_status, billing_plan_external_id,
       platform_billing_subscription_id
FROM commerce_billing_account
ORDER BY updated_on DESC
LIMIT 5;

SELECT ts.tenant_fk, mst.tier_code, ts.stripe_subscription_status, ts.is_current
FROM tenant_subscription ts
JOIN master_subscription_tier mst ON mst.subscription_tier_pk = ts.subscription_tier_fk
WHERE ts.is_current = 1
ORDER BY ts.updated_on DESC
LIMIT 5;

SELECT event_type, processing_status, received_at
FROM commerce_platform_event
WHERE event_type = 'app_subscriptions/update'
ORDER BY received_at DESC
LIMIT 10;
```

## Blockers before marking Slice 10 fully validated

1. **`shopify app deploy`** with absolute webhook URIs (post-fix)
2. **Shopify Partners Dashboard** ([partners.shopify.com](https://partners.shopify.com)) → **Apps** → **Razzl Product Setup Copilot** → **Distribution** (public distribution) and **Pricing** (manual pricing, not managed — required for `appSubscriptionCreate`)
3. **Manual billing approval** in the **Shopify embedded app** (not Studio subscription page): open `https://api-dev.razzl.com/shopify` on the dev store → **Billing** card → choose plan → **Approve plan in Shopify**. Requires `SHOPIFY_BILLING_TEST=true` on api-dev ECS. Only applies to tenants on the **Shopify billing lane** (no `tenant_stripe_customer` row at link time).
4. Dev store domain confirmed: `razzl-dev.myshopify.com`

## Observed state — `razzl-dev.myshopify.com` (2026-07-05)

| Query | Your result | Interpretation |
|-------|-------------|----------------|
| `commerce_platform_connection` | tenant **123**, `billing_source=none`, `not_required` | Link likely predates Slice 10 billing init; lane still resolves to **Stripe** because tenant 123 has `tenant_stripe_customer` |
| `commerce_billing_account` | empty | `initializeBillingOnTenantLink` did not run (pre-Slice-10 link). Backfill optional for Stripe lane; required for Shopify billing E2E |
| `tenant_subscription` | rows for tenant **124**, multiple `is_current=1` | Wrong tenant for this store, or separate test data — **tenant 123** (linked store) has no current subscription → `hasEntitlement=false` in smoke |
| `commerce_platform_event` | empty | No billing webhooks received (wrong TOML webhook URLs until redeploy) |

### Shopify billing E2E on this store

This tenant is on the **Stripe lane** (OQ-020). Studio subscription page is the correct billing UI; Shopify charge flow is **not** used.

To exercise Shopify billing E2E, use a **new Studio tenant without Stripe** and link it to the dev store (or unlink/re-link after removing `tenant_stripe_customer` for a dedicated test account).

### Optional backfill (Stripe lane, existing link)

```sql
-- Run only if commerce_billing_account row is missing for tenant 123
INSERT INTO commerce_billing_account (
  tenant_fk, commerce_platform_connection_fk, billing_source, acquisition_source,
  platform_billing_status, trial_enabled, trial_duration_days, trial_max_products
)
SELECT c.tenant_fk, c.commerce_platform_connection_pk, 'stripe', c.acquisition_source,
       'not_required', 1, 7, 1
FROM commerce_platform_connection c
WHERE c.store_domain = 'razzl-dev.myshopify.com'
  AND NOT EXISTS (
    SELECT 1 FROM commerce_billing_account ba
    WHERE ba.commerce_platform_connection_fk = c.commerce_platform_connection_pk
  );

UPDATE commerce_platform_connection
SET billing_source = 'stripe', platform_billing_status = 'not_required'
WHERE store_domain = 'razzl-dev.myshopify.com';
```

## Stripe lane regression

Code path verified by unit tests (`resolveBillingLane` → `stripe` when `tenant_stripe_customer` exists at link). No api-dev Stripe+Shopify combined E2E run in this session.
