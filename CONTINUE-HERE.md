# Continue Here — Razzl API

## Current status

**Slice 9 implemented** — launch tracking for storefront CTA clicks.

## Current branch

Merge to `main` and deploy api-dev when validated. Apply Studio migration `20260702_commerce_launch_event.sql` to shared RDS first.

## Last completed slice

**Slice 9** — `commerce_launch_event` table, CTA click tracking in theme block, Shopify admin analytics summary

## Next slice

**Slice 10** — Shopify Billing / App Pricing

## Exact next steps

1. Apply `studio/db/migrations/20260702_commerce_launch_event.sql` on dev RDS
2. Deploy api-dev with Slice 9
3. Redeploy theme extension (`shopify app deploy`) so click tracking JS ships
4. Validate: storefront CTA click → row in `commerce_launch_event` → analytics panel updates

## Files added (Slice 9)

| Path | Purpose |
|------|---------|
| `studio/db/migrations/20260702_commerce_launch_event.sql` | Launch event table (Studio schema owner) |
| `lib/commerce/core/analytics/launch-event-repo.ts` | Insert + aggregation queries |
| `lib/commerce/core/analytics/launch-tracking-service.ts` | Record click + analytics summary |
| `app/api/commerce/launch-events/route.ts` | Public POST + CORS (theme block) |
| `app/api/commerce/analytics/launches/route.ts` | Merchant GET summary |
| `app/shopify/shopify-launch-analytics-panel.tsx` | Setup help analytics UI |
| `extensions/razzl-setup-help/assets/razzl-setup-help.js` | Track click before redirect |

## Validation status

- [ ] Migration applied on dev RDS
- [ ] Slice 9 deployed to api-dev
- [ ] Theme extension redeployed
- [ ] Storefront click creates event row
- [ ] Analytics panel shows counts

## Recommended next Composer prompt

```text
Implement Slice 10: Shopify Billing / App Pricing per IMPLEMENTATION-PLAN.md. Update CONTINUE-HERE.md.
```
