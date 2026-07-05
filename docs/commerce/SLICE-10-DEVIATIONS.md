# Slice 10 — Deviations from Shopify guideline draft

This slice follows [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) and [`DATA-MODEL.md`](./DATA-MODEL.md). The guideline draft in the Composer prompt used simplified column names; this document records intentional differences.

## Schema mapping (guideline → implemented)

| Guideline (figurative) | Implemented |
|------------------------|-------------|
| Add columns to tenant billing table | Uses existing **`commerce_billing_account`** + **`commerce_platform_connection.billing_source`** / **`platform_billing_status`** (no DDL change — Slice 1 schema) |
| `shopify_shop_domain` | **`commerce_platform_connection.store_domain`** |
| `shopify_charge_id` | **`commerce_billing_account.platform_billing_charge_id`** |
| `billing_source = 'shopify'` | **`billing_source = 'shopify_billing'`** (enum per DATA-MODEL) |
| `shopify_subscription_status` | **`commerce_billing_account.platform_billing_status`** (+ connection mirror column) |

## Entitlements

- No new entitlement engine. Shopify webhooks call **`projectTenantSubscriptionFromShopify`**, which writes **`tenant_subscription`** the same way Studio’s Stripe webhook does.
- Shopify subscription GIDs are stored in **`tenant_subscription.stripe_subscription_id`** (column name is Stripe-oriented; value prefix `gid://shopify/...`).

## Billing scopes

- **No extra OAuth scopes** added for `appSubscriptionCreate` (Shopify does not require `read_billing` / `write_billing` for app subscriptions on current platform guidance).
- App must be configured for **public distribution** in Partner Dashboard to use Billing API on dev stores (`test: true` still applies).

## Plan parity

- Plans loaded from **`master_subscription_tier`** (same rows/prices as Stripe checkout).
- **`appSubscriptionCreate`** uses `tier_name`, `recurring_price_amount`, `billing_interval`, and `billing_interval_count` — no separate Shopify pricing table.

## Trial

- Default **7-day trial** via mutation `trialDays` (configurable with env **`SHOPIFY_BILLING_TRIAL_DAYS`**).
- Admin-configurable `commerce_billing_account.trial_*` columns exist in schema but are not yet exposed in UI (OQ-022 follow-up).

## Stripe lane (OQ-020)

- Tenants with **`tenant_stripe_customer`** at link time get **`billing_source = stripe`** and **`platform_billing_status = not_required`** — no Shopify billing for connector features; existing Stripe subscription drives entitlements.

## Manage subscription URL

- No deep link. Embedded admin and Studio billing show: **Apps → Razzl Product Setup Copilot → Manage subscription**.

## Gating surface

- Gates on **map**, **sync**, and **CTA enable** (SHOPIFY-SPEC), not only map-first — map-first remains the primary paywall UX trigger.

## Webhook topics

- Guideline listed **`app_subscriptions/cancelled`** — **not a valid Shopify topic**. Only **`app_subscriptions/update`** exists; cancellations arrive with `status: CANCELLED` on that topic.
- **Uninstall** does not reliably fire subscription update webhooks; use **`app/uninstalled`** + **`markBillingCancelledOnUninstall`** for cleanup (Shopify platform behavior).

## Studio

- Minimal change: **`app/app/billing/page.tsx`** and **`app/app/subscription/page.tsx`** suppress Stripe portal/checkout when **`commerce_billing_account.billing_source = shopify_billing`**.
