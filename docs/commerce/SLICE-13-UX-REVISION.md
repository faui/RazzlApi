# Slice 13 — Embedded Admin Wizard + Studio Commerce Indicators

**Status:** Planned (UX revision)  
**Repos:** RazzlApi (primary — Shopify embedded app) + Studio (dashboard indicators)  
**App name:** Razzl Product Setup Copilot  
**Purpose:** Single source of truth for the next UX revision — zero drift for implementers.

---

## Executive summary

Replace the current **scroll stack** (Onboarding + Billing + Products + …) with a **mandatory 3-step setup wizard** (Link → Subscribe → Sync). After wizard completion, show a compact **“Store connected to Razzl”** confirmation block. Fix known UX bugs (sync list delay, map modal persistence, CTA layout). Add **Studio dashboard** indicators for Shopify-connected tenants and mapped products.

**Do not rebuild Studio flows inside Shopify.** Deep links to Studio for copilot create/edit remain.

---

## Non-negotiables (read first)

From [`README.md`](./README.md), [`STUDIO-CONTRACT.md`](./STUDIO-CONTRACT.md), [`STYLEGUIDE.md`](./STYLEGUIDE.md):

1. **Studio is system of record** — products, copilots, Stripe billing UI, profile.
2. **Shopify-acquired tenants use Shopify Billing** — not Stripe checkout in embedded app.
3. **Polaris only** in embedded app — do **not** import shadcn/Studio components into RazzlApi.
4. **Generic `commerce_*` naming** in core; Shopify-specific under `lib/commerce/adapters/shopify/`.
5. **Billing gate** — sync/map/CTA API returns `402` / `BILLING_REQUIRED` until Shopify plan approved ([`billing-service.ts`](../../lib/commerce/core/billing/billing-service.ts) `assertCommerceFeatureEntitlement`).
6. **Deep links** — use [`studio-links.ts`](../../lib/commerce/core/studio-links.ts); preserve `shopify_shop`, `shopify_product`, `shopify_title`, `shopify_image` query params.

---

## Current architecture (as of 2026-07-20)

### Embedded app entry

| File | Role |
|------|------|
| [`app/shopify/page.tsx`](../../app/shopify/page.tsx) | Server: `shop`, `host`, `tenantLinked`, connection status |
| [`app/shopify/shopify-embedded-shell.tsx`](../../app/shopify/shopify-embedded-shell.tsx) | App Bridge bootstrap, connection fetch, session-token exchange |
| [`app/shopify/shopify-embedded-home.tsx`](../../app/shopify/shopify-embedded-home.tsx) | Page title, “Add Copilot” primary action |
| [`app/shopify/shopify-commerce-panels.tsx`](../../app/shopify/shopify-commerce-panels.tsx) | **Panel orchestrator** — refactor target for wizard |

### Current panel order (to be replaced)

```
Connection card (OAuth — keep above wizard)
  → ShopifyOnboardingPanel      ← REMOVE as standalone
  → ShopifyBillingPanel         ← REMOVE as standalone
  → ShopifyCustomerPreviewPanel
  → ShopifyProductsPanel
  → ShopifyCtaSettingsPanel
  → ShopifyLaunchAnalyticsPanel
  → ShopifyAppFooter
```

### Current onboarding steps (incomplete — missing billing)

[`shopify-onboarding-panel.tsx`](../../app/shopify/shopify-onboarding-panel.tsx) lines 57–82:

1. Link Razzl Studio account  
2. Sync products  
3. Map + enable CTA  

**Gap:** Billing is enforced in API but **not** in onboarding UI. Merchants hit “Sync complete” then empty/errors until billing approved.

### Billing today

| File | Behavior |
|------|----------|
| [`shopify-billing-panel.tsx`](../../app/shopify/shopify-billing-panel.tsx) | Polaris `Select` dropdown for plans; “Approve plan in Shopify” redirect |
| [`billing-service.ts`](../../lib/commerce/core/billing/billing-service.ts) L128–131 | `shopifyManageMessage` text-only — no clickable URL |
| [`app/api/commerce/billing/status/route.ts`](../../app/api/commerce/billing/status/route.ts) | Returns `plans[]`, `platformBillingStatus`, `currentTierCode` |
| [`app/api/commerce/billing/session/route.ts`](../../app/api/commerce/billing/session/route.ts) | Creates Shopify confirmation URL |

**Manage subscription issue:** Message says *Apps → Razzl Product Setup Copilot → Manage subscription* but merchants report that menu item is missing. Investigate Shopify Managed Pricing / App Bridge billing admin paths; provide a **working link or accurate instructions** — do not ship misleading copy.

**Plan picker reference (visual only):** Studio [`studio/components/subscription/pricing-plans-grid.tsx`](../../../studio/components/subscription/pricing-plans-grid.tsx) — **reimplement in Polaris** (plan cards, monthly/yearly cadence). Data from `GET /api/commerce/billing/status` → `plans[]`. Do not import Studio UI into API repo.

### Products / sync / map

| File | Role |
|------|------|
| [`shopify-products-panel.tsx`](../../app/shopify/shopify-products-panel.tsx) | Sync, IndexTable, map/unmap modals |
| [`app/api/commerce/sync/route.ts`](../../app/api/commerce/sync/route.ts) | GET status, POST `runProductSync` |
| [`app/api/commerce/products/route.ts`](../../app/api/commerce/products/route.ts) | Mapping board items |
| [`app/api/commerce/mappings/route.ts`](../../app/api/commerce/mappings/route.ts) | POST/PATCH/DELETE mappings |

**Sync list delay (known bug — may persist on api-dev):**

- Commit `1ce5cfc` added `reloadingProducts` + skeleton until `loadData({ refreshing: true })` completes after sync.
- **User still sees:** toast “Sync complete — N products” then **empty list**; second sync click populates table.
- **Likely cause:** Race between POST sync commit and parallel GET `/api/commerce/products` in `loadData` ([`shopify-products-panel.tsx`](../../app/shopify/shopify-products-panel.tsx) L178–183). POST returns `stats.productsSeen` but does not return product rows.
- **Required fix:** After sync, fetch products **sequentially** or **retry** when `stats.productsSeen > 0` but `items.length === 0` (bounded retry, e.g. 3× 500ms). Optionally extend POST sync response with `items` count check. Do not mark sync UX done until first-click list populate is verified manually.

**Map copilot modal (known bug):**

- Modal: [`shopify-products-panel.tsx`](../../app/shopify/shopify-products-panel.tsx) L720–815  
- “Create new copilot from PDF” opens Studio via `rowCreateCopilotUrl` (L102–112) with `shopify_product`, `shopify_title`, `shopify_image`; base URL includes `shopify_shop` from [`studio-links.ts`](../../lib/commerce/core/studio-links.ts).
- Modal **stays open** when user returns from Studio.
- **Required behavior:**
  1. On “Create copilot from PDF in Studio” click → **close modal**
  2. Set row state **`mappingInProgress`** (or similar) for that `externalProductId`
  3. Show inline indicator on product row (e.g. Polaris `Badge` tone="info" “Mapping in progress…”)
  4. User clicks **Refresh status** (existing `handleRefreshSnapshots` / `loadData`) to pick up mapped copilot
- **Studio side (already shipped):** After copilot create, [`product-guide-dialog.tsx`](../../../studio/components/product-guide/product-guide-dialog.tsx) calls `POST /api/commerce/map-shopify-product` → auto-map. Refresh in Shopify app should show **mapped** without re-opening modal.

### CTA settings layout (defective)

[`shopify-cta-settings-panel.tsx`](../../app/shopify/shopify-cta-settings-panel.tsx) + [`shopify-admin.css`](../../app/shopify/shopify-admin.css):

**Required layout changes:**

| Issue | Fix |
|-------|-----|
| Header misaligned | One line: icon + title **left**; subtitle **right** (same row) |
| Theme block blows page height | Move “Add Razzl Setup Help to your product page” **to the right** of “Storefront appearance” — compact 2-column grid |
| Overall | Compact, scannable, world-class SaaS polish within Polaris constraints |

### Analytics / preview panel order

**Required order** on main page (post-wizard):

1. Connection card (if not fully connected) OR “Store connected to Razzl” summary (when wizard complete)
2. Products panel (sync/map/CTA per product)
3. CTA settings
4. **What your customers will see** — [`shopify-customer-preview-panel.tsx`](../../app/shopify/shopify-customer-preview-panel.tsx) — **move above** analytics
5. **Setup help analytics** — [`shopify-launch-analytics-panel.tsx`](../../app/shopify/shopify-launch-analytics-panel.tsx)

---

## Target UX: Setup wizard

### Mandatory steps (strict order)

| Step | ID | Complete when | Blocks |
|------|-----|---------------|--------|
| 1 | `link` | `tenantLinked === true` | Steps 2–3 |
| 2 | `subscribe` | `platformBillingStatus === 'active'` OR Stripe lane with entitlement | Step 3 |
| 3 | `sync` | `productCount > 0` | Main catalog work |

Steps 1–3 are **not optional**. Merchant cannot sync until linked **and** subscribed. Merchant cannot usefully map until sync completes (existing API gates).

**After step 3 complete:** Collapse wizard into **“Store connected to Razzl”** card:

- Confirm all three steps ✓  
- Link: **Manage your store in Razzl Studio** (existing dashboard URL from API)  
- Link: **Change subscription** (billing management — fixed path from billing investigation)  
- Optional: tenant name, product count summary  

**Remove** standalone `ShopifyOnboardingPanel` and `ShopifyBillingPanel` from scroll — wizard subsumes them.

### Wizard UI pattern

- Single component e.g. `shopify-setup-wizard.tsx` (new)
- Reuse/adapt [`onboarding-stepper.tsx`](../../app/shopify/onboarding-stepper.tsx) for 3 steps (not 3 old + billing bolted on)
- Step content:
  - **Link:** existing login/signup CTAs → `GET /api/commerce/connection/link/start`
  - **Subscribe:** Polaris plan cards (Studio-like), approve via `POST /api/commerce/billing/session`
  - **Sync:** Embed sync CTA + progress; on success advance to complete state
- When wizard incomplete: **de-emphasize or disable** products/CTA/analytics sections (banner: “Complete setup above”) — fail closed, no confusing partial states ([`STYLEGUIDE.md`](./STYLEGUIDE.md))

### Map + CTA enable (post-wizard)

Mapping and “CTA On” remain in **products table** — not wizard step 4 (user request focuses wizard on link/billing/sync). Optional: show soft checklist item in “Store connected” card: “Map copilots and enable CTA” with link scroll to products.

---

## Part B — Studio dashboard (separate repo)

**Repo:** `../studio`  
**Do not implement Studio changes in RazzlApi PR unless paired slice.**

### B1 — Tenant Shopify indicator

| Requirement | Detail |
|-------------|--------|
| Show connected store | Only when `commerce_platform_connection` exists with `install_status = 'connected'` and `store_domain` set |
| Display | e.g. badge/chip in [`app-shell.tsx`](../../../studio/components/shell/app-shell.tsx) near tenant name: “Shopify · {store_domain}” |
| Link | Opens Shopify admin or storefront in new tab — use `https://{store_domain}/admin` or merchant-facing URL |
| Non-Shopify tenants | **Render nothing** — follow [`commerce-billing-lane.ts`](../../../studio/lib/commerce-billing-lane.ts) gating pattern |

**API gap:** Add `GET /api/tenant/commerce-connection` (Studio) returning `{ ok, platformType, storeDomain, storeDisplayName, installStatus }` from DB join on session `tenantPk`. Extend [`lib/commerce-billing-lane.ts`](../../../studio/lib/commerce-billing-lane.ts) or new `lib/commerce-connection.ts`.

### B2 — Mapped product indicator on dashboard

| Requirement | Detail |
|-------------|--------|
| Where | [`app/app/dashboard/page.tsx`](../../../studio/app/app/dashboard/page.tsx) — grid card + list row title area (L861–868, L1037–1046) |
| Text | e.g. “Mapped to Shopify: {product_title}” — truncate with `title` attribute tooltip for full text |
| Data | Extend `GET /api/products` to LEFT JOIN `commerce_razzl_product_mapping` + `commerce_external_product` for tenant’s Shopify connection (only rows with mapping) |
| Non-mapped products | No change |

**Schema reference:** [`DATA-MODEL.md`](./DATA-MODEL.md) — `commerce_razzl_product_mapping`, `commerce_external_product`, `commerce_platform_connection`.

---

## API contracts (embedded app)

| Route | Method | Used for |
|-------|--------|----------|
| `/api/commerce/shopify/connection` | GET | Connection + `tenantLinked` + tokenStatus |
| `/api/commerce/connection/link/start` | GET | Studio link URLs |
| `/api/commerce/billing/status` | GET | Wizard step 2 |
| `/api/commerce/billing/session` | POST | Plan approval redirect |
| `/api/commerce/sync` | GET, POST | Wizard step 3 + products panel |
| `/api/commerce/products` | GET | Product table |
| `/api/commerce/mappings` | POST, PATCH, DELETE | Map/unmap/CTA |
| `/api/commerce/mappings/refresh` | POST | Refresh status |
| `/api/commerce/cta/config` | GET, PATCH | CTA settings |

---

## Studio deep links (create copilot from map)

Built by [`buildStudioCreateCopilotUrl`](../../lib/commerce/core/studio-links.ts):

```
{STUDIO}/app/dashboard?create_copilot=1&shopify_shop={shop}&shopify_product={id}&shopify_title=…&shopify_image=…
```

Studio [`app-shell.tsx`](../../../studio/components/shell/app-shell.tsx) parses params → [`ProductGuideDialog`](../../../studio/components/product-guide/product-guide-dialog.tsx) → auto-map on success via [`map-shopify-product/route.ts`](../../../studio/app/api/commerce/map-shopify-product/route.ts).

---

## UX quality bar

Before marking slice complete:

1. **Wizard:** Cannot sync before subscribe; cannot subscribe before link. Visual progress clear.
2. **Sync:** First click populates product list (manual test with 10+ products).
3. **Map flow:** Modal closes on Studio open; row shows in-progress; refresh shows mapped.
4. **CTA settings:** Header + 2-column layout per spec; no excessive vertical scroll.
5. **Billing:** Plan selection uses card grid (not bare dropdown); manage subscription path verified on dev store.
6. **Polaris-native, world-class** — propose improvements in PR description; see [`SLICE-9B-UX-GAP-REVIEW.md`](./SLICE-9B-UX-GAP-REVIEW.md) for prior gaps.
7. **Tests:** Add/update Vitest for wizard step derivation, sync retry logic, billing message helper. Run `npm run lint` + tests.
8. **Docs:** Update this file + [`CONTINUE-HERE.md`](../../CONTINUE-HERE.md) when done.

---

## File change checklist (RazzlApi)

| Action | Path |
|--------|------|
| **New** | `app/shopify/shopify-setup-wizard.tsx` |
| **Refactor** | `app/shopify/shopify-commerce-panels.tsx` |
| **Remove usage** | `shopify-onboarding-panel.tsx`, `shopify-billing-panel.tsx` (may keep modules for wizard step content extraction) |
| **Fix** | `shopify-products-panel.tsx` — sync retry, map modal close, in-progress row state |
| **Fix** | `shopify-cta-settings-panel.tsx`, `shopify-admin.css` |
| **Reorder** | `shopify-commerce-panels.tsx` — preview above analytics |
| **Maybe** | `lib/commerce/core/billing/billing-service.ts` — manage subscription URL if Shopify provides one |
| **Tests** | `app/shopify/*.test.tsx`, billing/sync unit tests |

## File change checklist (Studio — Part B)

| Action | Path |
|--------|------|
| **New** | `app/api/tenant/commerce-connection/route.ts` |
| **New/extend** | `lib/commerce-connection.ts` |
| **Update** | `components/shell/app-shell.tsx` |
| **Update** | `app/api/products/route.ts` + `app/app/dashboard/page.tsx` |

---

## Related docs

| Doc | Why |
|-----|-----|
| [`SLICE-9B-UX-GAP-REVIEW.md`](./SLICE-9B-UX-GAP-REVIEW.md) | Prior UX gaps |
| [`SLICE-10-E2E-VALIDATION.md`](./SLICE-10-E2E-VALIDATION.md) | Billing E2E |
| [`SHOPIFY-SPEC.md`](./SHOPIFY-SPEC.md) | OAuth, sync, billing |
| [`STUDIO-CONTRACT.md`](./STUDIO-CONTRACT.md) | Studio routes/APIs |
| [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) | Slice discipline |

---

## Open questions for implementer

| # | Question | Bias |
|---|----------|------|
| OQ-UX-01 | Exact Shopify Admin URL for “manage subscription” on Managed Pricing apps? | Research Shopify docs; ship working link or rewrite copy |
| OQ-UX-02 | Disable products panel vs banner when wizard incomplete? | Prefer disabled overlay + single banner |
| OQ-UX-03 | Should “Change subscription” re-open wizard step 2 or separate modal? | Re-open step 2 inline in summary card |

*Created 2026-07-20 for Slice 13 UX revision handoff.*
