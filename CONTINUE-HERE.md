# Continue Here — Razzl API

## Current status

**Slices 5–6 implemented** on branch `slice-005-006-product-sync-mapping` (product import + mapping UI/API). **Slice 4** on `slice-004-tenant-connection` — merge both to `main` and redeploy api-dev.

## Current branch

`slice-005-006-product-sync-mapping` (includes Slice 4 base)

## Last completed slice

**Slice 4** — tenant linking (local + remote branch; **not yet on api-dev** as of 2026-07-01)

## Next slice

**Slice 7** — Studio deep links, launch URL builders, mapping snapshot refresh

## Exact next steps

1. Merge `slice-004-tenant-connection` → `main`, deploy api-dev, validate tenant link E2E
2. Merge `slice-005-006-product-sync-mapping` → `main`, deploy api-dev
3. E2E: Sync products → map to copilot → toggle CTA
4. Start Slice 7 per IMPLEMENTATION-PLAN.md

## Files added (Slices 5–6)

| Path | Purpose |
|------|---------|
| `lib/commerce/adapters/shopify/products.ts` | Shopify REST product fetch |
| `lib/commerce/core/sync/sync-service.ts` | Idempotent catalog sync |
| `lib/commerce/core/products/external-product-repo.ts` | External product/variant upsert |
| `lib/commerce/core/mapping/mapping-service.ts` | Map/unmap/CTA + Studio product picker |
| `app/api/commerce/sync/route.ts` | POST sync / GET status |
| `app/api/commerce/products/route.ts` | Product + mapping board |
| `app/api/commerce/mappings/route.ts` | Map, unmap, CTA toggle |
| `app/shopify/shopify-products-panel.tsx` | Sync + mapping table UI |

## Validation status

- [x] Product fetch + sync unit tests
- [x] `npm run lint` / `npm run test` / `npm run build`
- [ ] Slice 4 merged + deployed to api-dev
- [ ] Live product sync on dev store
- [ ] Mapping + CTA toggle on dev store

## Recommended next Composer prompt

```text
Implement Slice 7: Studio deep link and launch URL builders. Refresh mapping snapshots from product status. Update CONTINUE-HERE.md.
```
