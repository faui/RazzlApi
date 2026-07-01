# Continue Here — Razzl API

## Current status

**Slice 4 implemented** — tenant linking (HMAC link tokens, Studio deep links, connection status UI). Ready for dev validation and merge.

## Current branch

`slice-004-tenant-connection` — merge to `origin/main` after E2E link test

## Last completed slice

**Slice 3** — Shopify OAuth install flow (2026-06-29, merged + deployed to dev)

## Next slice

**Slice 5** — Shopify product import into `commerce_*` tables

## Exact next steps

1. Add env vars locally (or run `studio/infra/terraform-dev/scripts/create-dev-shopify-secrets.ps1`):
   - `RAZZL_STUDIO_PUBLIC_ORIGIN=https://studio-dev.razzl.com`
   - `COMMERCE_STUDIO_LINK_SECRET` (same value in Studio `.env.local`)
2. Re-upload Shopify secret with `studio_link_secret` key → `terraform apply` in terraform-dev
3. Merge + deploy **RazzlApi** and **Studio** Slice 4 branches
4. E2E: Shopify admin → **Connect existing Razzl account** → Studio login → confirm link → tenant name on `/shopify`
5. Start Slice 5: product import

## Files added (Slice 4)

| Path | Purpose |
|------|---------|
| `lib/commerce/core/connections/link-token.ts` | HMAC-signed link tokens |
| `lib/commerce/core/connections/connection-service.ts` | start/complete/unlink tenant link |
| `lib/commerce/config/studio-env.ts` | Studio origin + internal secret verify |
| `lib/commerce/core/studio-links.ts` | Login/signup deep link builders |
| `app/api/commerce/connection/link/start/route.ts` | Start link → Studio URLs |
| `app/api/commerce/connection/link/route.ts` | POST link / DELETE unlink (internal key) |
| `app/shopify/shopify-onboarding-panel.tsx` | Connect account UI + checklist |

## Validation status

- [x] Link token unit tests
- [x] `npm run lint` / `npm run test` / `npm run build`
- [ ] Live tenant link on dev store
- [ ] Slice 4 merged to `origin/main`

## Do-not-change warnings

- Schema migrations stay in **Studio** repo only
- No product sync until Slice 5

## Recommended next Composer prompt

```text
Implement Slice 5 per IMPLEMENTATION-PLAN.md: Shopify product import into commerce_product tables. Webhook + manual sync trigger. Update CONTINUE-HERE.md.
```
