# Continue Here — Razzl API

## Current status

**Slices 5–6 implemented** on branch `slice-005-006-product-sync-mapping`. Slice 4 tenant linking verified on dev store `razzl-dev.myshopify.com`.

## Current branch

`slice-005-006-product-sync-mapping` — merge to `main` and deploy api-dev

## Last completed slice

**Slice 4** — tenant linking (verified on dev)

## Next slice

**Slice 7** — Studio deep links, launch URL builders, mapping snapshot refresh

## Exact next steps

1. Merge `slice-005-006-product-sync-mapping` → `main`, push, deploy api-dev
2. In Shopify app: **Sync now** → map products → toggle CTA for published copilots
3. Start Slice 7 (storefront CTA resolver is Slice 8)

## Files added (Slices 5–6)

| Path | Purpose |
|------|---------|
| `lib/commerce/adapters/shopify/products.ts` | Shopify REST product fetch |
| `lib/commerce/core/sync/sync-service.ts` | Idempotent catalog sync |
| `lib/commerce/core/mapping/mapping-service.ts` | Map/unmap/CTA + Studio product picker |
| `app/api/commerce/sync/route.ts` | POST sync / GET status |
| `app/api/commerce/products/route.ts` | Product + mapping board |
| `app/api/commerce/mappings/route.ts` | Map, unmap, CTA toggle |
| `app/shopify/shopify-products-panel.tsx` | Sync + mapping table UI |

## Validation status

- [x] Unit tests (25+), lint, build pass locally
- [x] Slice 4 E2E on razzl-dev store
- [ ] Slice 5–6 deployed to api-dev
- [ ] Live sync + mapping on dev store

## Recommended next Composer prompt

```text
Implement Slice 7: Studio deep link and launch URL builders. Refresh mapping snapshots from product status. Update CONTINUE-HERE.md.
```
