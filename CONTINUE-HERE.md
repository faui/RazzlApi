# Continue Here — Razzl API

## Current status

**Slice 9B implemented** — embedded admin UX uplift with Shopify Polaris + App Bridge.

## Current branch

Merge to `main` and deploy api-dev when validated on dev store embedded app.

## Last completed slice

**Slice 9B** — Polaris shell, connection card, onboarding progress, IndexTable products, CTA settings previews, analytics stat cards

## Next slice

**Slice 10** — Shopify Billing / App Pricing

## Exact next steps

1. Open embedded app on `razzl-dev.myshopify.com` — verify Polaris UI, products table, sync, mapping, CTA save toast
2. Merge Slice 9B to `main`; deploy api-dev
3. Continue Slice 9 validation (launch events migration + theme extension) if not done
4. Start Slice 10 billing

## Files changed (Slice 9B)

| Path | Purpose |
|------|---------|
| `app/shopify/layout.tsx` | App Bridge script + Polaris CSS |
| `app/shopify/shopify-polaris-provider.tsx` | AppProvider + toast context |
| `app/shopify/shopify-embedded-home.tsx` | Page shell with primary action |
| `app/shopify/shopify-connection-card.tsx` | Connection status card |
| `app/shopify/shopify-*-panel.tsx` | Polaris refactor of all panels |
| `package.json` | `@shopify/polaris`, App Bridge, icons |
| `studio/docs/commerce/IMPLEMENTATION-PLAN.md` | Slice 9B definition |

## Validation status

- [ ] Embedded app renders Polaris UI on dev store
- [ ] Products table: search, sort, kebab actions, CTA toggle
- [ ] Sync now shows loader + last synced timestamp
- [ ] CTA settings save shows toast
- [ ] Analytics EmptyState + stat cards
- [ ] Lint + build pass
- [ ] Slice 9B deployed to api-dev

## Recommended next Composer prompt

```text
Implement Slice 10: Shopify Billing / App Pricing per IMPLEMENTATION-PLAN.md. Update CONTINUE-HERE.md.
```
