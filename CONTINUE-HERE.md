# Continue Here — Razzl API

## Current status

**Slice 9B.1 implemented** — premium UX polish on embedded admin (switch toggles, stepper, connection banners, CTA preview panel).

## Current branch

Merge to `main` and deploy api-dev. **Team must refresh embedded app** — prior review may have been pre–Slice 9B deploy (kebab menus were already in 9B).

## Last completed slice

**Slice 9B.1** — visual polish: connection banners, onboarding stepper, outlined Unmapped badge, CTA switch, row hover, CTA preview panel

## Next slice

**Slice 10** — Shopify Billing / App Pricing

## Exact next steps

1. Deploy api-dev with Slice 9B + 9B.1
2. Hard-refresh Shopify embedded app (or re-open from Admin → Apps)
3. Validate products table: single ⋯ kebab per row, switch CTA, outlined Unmapped badge
4. Start Slice 10 when UX sign-off received

## Files changed (Slice 9B.1)

| Path | Purpose |
|------|---------|
| `app/shopify/shopify-admin.css` | Row hover, switch, badges, preview panel |
| `app/shopify/shopify-switch.tsx` | Toggle control |
| `app/shopify/status-badge.tsx` | Outlined Unmapped + filled status badges |
| `app/shopify/onboarding-stepper.tsx` | Numbered step circles |
| `app/shopify/shopify-connection-card.tsx` | Banner + nested status panel |
| `app/shopify/shopify-onboarding-panel.tsx` | Progress % + stepper |
| `app/shopify/shopify-products-panel.tsx` | Switch, badges, table hover |
| `app/shopify/shopify-cta-settings-panel.tsx` | Preview panel layout |
| `app/shopify/shopify-launch-analytics-panel.tsx` | EmptyState container |

## Validation status

- [ ] api-dev deployed with 9B.1
- [ ] Team confirms post-deploy UI (not pre-9B screenshot)
- [ ] Lint + build pass locally
- [ ] Slice 10 ready to start

## Recommended next Composer prompt

```text
Implement Slice 10: Shopify Billing / App Pricing per IMPLEMENTATION-PLAN.md. Update CONTINUE-HERE.md.
```
