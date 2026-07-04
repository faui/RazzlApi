# Shopify Adapter Specification

**Status:** Slice 0 — specification only, not implemented  
**Scope:** Shopify-specific layer on top of Commerce Integration Core

## Positioning

**App title:** Razzl Product Setup Copilot  
**Tagline:** Add AI setup help to your product pages.

Shopify is the **first acquisition connector**, not the Razzl architecture.

## What must NOT be built inside Shopify

- Studio dashboard (full product list/management)
- Profile / tenant management (beyond read-only summary + deep link)
- Stripe billing screens
- PDF/manual upload
- Copilot generation pipeline
- Copilot editor
- Publishing/review workflows

## Shopify app structure (proposed)

```text
shopify/                        # or lib/commerce/adapters/shopify/
  oauth/
  admin-api/
  webhooks/
  billing/
  theme-extension/
  ui/                           # Embedded admin (Polaris)
```

Hosting options (decided — OQ-030):

**RazzlApi** at `api.razzl.com` — separate Fargate service and repo. Shopify embedded admin backend, OAuth callbacks, webhooks, and CTA resolver all live here. See [`API-REPO.md`](./API-REPO.md).

## OAuth / install flow

### Install sequence

1. Merchant clicks Install in Shopify App Store or custom install URL
2. Redirect to Shopify OAuth authorize URL with requested scopes
3. Shopify redirects to app callback with `code` + `shop` + `hmac`
4. App validates HMAC, exchanges code for offline access token
5. Create/update `commerce_platform_connection`:
   - `platform_type = shopify`
   - `external_store_id` = Shopify shop ID
   - `store_domain` = `{shop}.myshopify.com`
   - `install_status = installed`
   - `acquisition_source = shopify_app_store` (if App Store) or `direct`
   - `access_token_encrypted` = encrypted token
6. Register webhooks (Slice 11)
7. Redirect merchant to embedded app home (onboarding)

### Required scopes (initial — confirm against current Shopify docs before Slice 3)

| Scope area | Purpose |
|------------|---------|
| `read_products` | Product import |
| Billing scopes | App Pricing / Billing API (Slice 10) |
| Webhook topics | `app/uninstalled`, compliance (Slice 11) |

**Avoid in v1:** customer, order, fulfillment scopes (protected customer data).

### Session types

- **Offline token:** stored encrypted on `commerce_platform_connection` for background sync
- **Online token / session:** embedded admin session (if needed for user-scoped actions)

## Store / account connection to Razzl tenant

After OAuth, merchant lands on onboarding:

| Option | Behavior |
|--------|----------|
| Create Razzl account | Deep link to Studio `/auth/start` or `/auth/verify` with return URL; on completion link `tenant_fk` on connection |
| Connect existing Razzl account | OAuth/login flow; user confirms tenant link |

Update connection:

- `tenant_fk` = linked tenant
- `install_status = connected`
- `connected_at = now()`

**Studio routes to use:** see [`STUDIO-CONTRACT.md`](./STUDIO-CONTRACT.md). Do not duplicate signup UI in Shopify unless no reusable route exists.

## Shopify product import

### Admin API

- Use **Shopify Admin REST Products API** for catalog import (OQ-033 — GraphQL deferred unless REST limits block scale)
- Paginate through shop catalog
- Normalize to `NormalizedCommerceProduct` / `NormalizedCommerceVariant`
- Upsert into `commerce_external_product` / `commerce_external_variant`
- Record `commerce_platform_sync_run`

### Sync rules

- Idempotent upsert by `(connection_id, external_product_id)`
- Mark deleted/archived products with `deleted_on_platform_at` — do not hard-delete mappings
- Preserve `commerce_razzl_product_mapping` across syncs
- Do **not** auto-create Razzl copilots from Shopify products

### UI

- Products screen in embedded admin: imported list, last sync time, manual "Sync now" button
- Show sync errors from latest `commerce_platform_sync_run`

## Product → Razzl product / copilot mapping

### Mapping UI (Shopify admin)

Product table columns:

| Commerce Product | Razzl Product | Copilot Status | CTA | Actions |
|------------------|---------------|----------------|-----|---------|

**Copilot status** derived from mapped `product.master_product_status.status_code` via Studio API or snapshot refresh:

| Display | Source |
|---------|--------|
| Unmapped | No `product_fk` |
| Draft / Processing | `in-progress`, `processing-error` |
| Published | `active` (confirm — see OPEN-QUESTIONS) |
| Stale | Snapshot older than threshold |
| Error | Mapping or API failure |

### Actions

| Action | Implementation |
|--------|----------------|
| Map existing Razzl product | Picker → set `product_fk` on mapping |
| Create in Razzl Studio | Deep link to `/app/dashboard` (PDF upload flow) |
| Edit Copilot | Deep link to `/app/products/{product_pk}/edit` |
| Launch Copilot | Open computed launch URL (same as Studio dashboard) |
| Enable/disable CTA | Toggle `storefront_cta_enabled` |
| Resync product | `fetchProductById` for single product |

Store `razzl_code_snapshot` and URLs on mapping for fast CTA resolution; refresh via status sync (Slice 7).

## Deep links into Studio

Templates (use `getPublicOrigin()` + `withBasePath()`):

| Purpose | Path |
|---------|------|
| Dashboard | `/app/dashboard` |
| Edit copilot | `/app/products/{product_pk}/edit` |
| Profile | `/app/profile` |
| Billing (Stripe customers) | `/app/billing` |
| Signup/login | `/auth/start` |

Label in Shopify UI: **Open in Razzl Studio**, **Edit Copilot**, **Launch Copilot**.

Authentication: merchant must have Studio session or complete login — see OPEN-QUESTIONS.

## Theme app extension / app block (storefront CTA)

### Behavior

- Merchant adds **Razzl Setup Help** app block to product template in theme editor
- Block reads current product context (`product.id` / handle)
- Block calls Razzl CTA resolver endpoint with shop domain + external product ID
- Resolver returns launch URL only if:
  - Connection active
  - Product mapped
  - Mapped Razzl product publishable (`active` + valid `razzl_code`)
  - CTA enabled for product
- Otherwise: **render nothing** (fail closed)

### Default CTA copy

- Default label: **Setup help**
- Alternates: Assembly help, Installation help, Ask setup copilot, Product setup help

### Launch URL

```
{chatKitBaseUrl}?razzl_code_product={razzl_code}&launchsource=shopify
```

(`launchsource=shopify` per OQ-002.)

### Open mode

Configurable via `commerce_storefront_cta_config.cta_open_mode`: `same_tab` or `new_tab`.

### Styling

Inherit merchant theme by default (`cta_style_mode = inherit_theme`). See [`STYLEGUIDE.md`](./STYLEGUIDE.md).

## Shopify Billing / App Pricing

For **Shopify App Store-acquired** paid merchants:

- Use Shopify App Pricing or Billing API
- Record in `commerce_billing_account`:
  - `billing_source = shopify_billing`
  - `acquisition_source = shopify_app_store`
- Gate product sync, mapping, and CTA until billing active (or free plan/trial)

For **existing Stripe customers** installing connector:

- Record accurate `acquisition_source` and `billing_source`
- **Policy validation required** before public App Store — see OPEN-QUESTIONS

Do not show Stripe checkout inside Shopify embedded app for Shopify-acquired merchants.

## Webhooks

### Topics (planned Slice 11)

| Topic | Purpose |
|-------|---------|
| `products/create`, `products/update`, `products/delete` | Incremental catalog sync |
| `app/uninstalled` | Mark connection uninstalled, revoke tokens |
| Compliance webhooks | GDPR/privacy mandatory for public apps |

### Processing

1. Verify HMAC (`X-Shopify-Hmac-Sha256`)
2. Insert `commerce_platform_event` with idempotency key
3. Normalize via adapter
4. Apply update (sync product, update connection status)
5. Mark processed

Raw body required for HMAC — ensure Next.js route disables JSON parse before verify.

## Admin app screens (Shopify embedded)

Build **only** these screens:

1. **Home / Onboarding** — value prop, create/connect account, checklist
2. **Billing** — Shopify plan acceptance (Shopify-acquired); connection status + Studio billing link (Stripe customers)
3. **Products** — imported catalog, mapping table, actions
4. **CTA Settings** — defaults, open mode, style
5. **Analytics** — basic launches by product (Slice 9)
6. **Settings / Connection** — linked tenant, sync status, disconnect, support

Use **Shopify Polaris** for embedded admin. See [`STYLEGUIDE.md`](./STYLEGUIDE.md).

## Compliance requirements (public app)

- Mandatory compliance webhooks (customer data request, customer redact, shop redact)
- Privacy policy and terms URLs
- Minimal scopes justification
- No protected customer data in v1
- Uninstall: deactivate connection, handle token deletion per policy

See [`SECURITY-COMPLIANCE.md`](./SECURITY-COMPLIANCE.md).

## App Store readiness checklist (Slice 12)

- Working embedded admin
- Billing through Shopify for app charges
- Demo store with theme block
- Listing copy aligned with setup copilot positioning
- Screenshots/video
- Support contact
- Accurate categorization (not generic chatbot)

## References

- [Shopify App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
- [Shopify App Pricing](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing)
- [Theme app extensions](https://shopify.dev/docs/apps/build/online-store/theme-app-extensions)
- [App blocks](https://shopify.dev/docs/storefronts/themes/architecture/blocks/app-blocks)
- [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Webhooks](https://shopify.dev/docs/api/webhooks/latest)
