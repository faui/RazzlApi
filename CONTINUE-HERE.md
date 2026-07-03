# Continue Here — Razzl API

## Current status

**Slices 7–8 implemented** on current branch. Slice 4 tenant linking verified on dev store `razzl-dev.myshopify.com`.

## Current branch

Merge to `main` and deploy api-dev when validated.

## Last completed slices

**Slice 7** — mapping snapshot refresh from live Studio product rows  
**Slice 8** — storefront CTA resolver API, merchant CTA settings UI, theme app extension

## Next slice

**Slice 9** — launch tracking (`commerce_launch_event`, click tracking in theme block)

## Exact next steps

1. Deploy api-dev with Slices 7–8
2. **Shopify CLI:** deploy theme extension (`shopify app deploy` or `shopify app dev` with extensions)
3. In Shopify admin app: Sync → Map Copilot → publish copilot in Studio → toggle CTA On → **Refresh Copilot status**
4. Theme editor: add **Razzl Setup Help** block to product template
5. Verify storefront product page shows CTA → Launch opens ChatKit with `launchsource=shopify`

## Files added (Slices 7–8)

| Path | Purpose |
|------|---------|
| `lib/commerce/core/mapping/status-sync.ts` | Refresh mapping snapshots from `product` rows |
| `app/api/commerce/mappings/refresh/route.ts` | POST refresh endpoint |
| `lib/commerce/core/cta/cta-config-repo.ts` | Storefront CTA config CRUD |
| `lib/commerce/core/cta/cta-resolver-service.ts` | Fail-closed public CTA resolver |
| `app/api/commerce/cta/resolve/route.ts` | Public GET + CORS |
| `app/api/commerce/cta/config/route.ts` | Merchant GET/PATCH CTA settings |
| `app/shopify/shopify-cta-settings-panel.tsx` | CTA settings + theme instructions |
| `extensions/razzl-setup-help/` | Theme app extension (product block) |

## Validation status

- [x] Unit tests (38 commerce tests), lint, build pass locally
- [x] Slice 4 E2E on razzl-dev store
- [ ] Slices 7–8 deployed to api-dev
- [ ] Theme extension deployed to dev store
- [ ] Live storefront CTA on dev store

## Recommended next Composer prompt

```text
Implement Slice 9: Launch tracking — commerce_launch_event table migration (Studio db/), track CTA click before redirect in theme block, lightweight analytics UI in Shopify admin. Update CONTINUE-HERE.md.
```
