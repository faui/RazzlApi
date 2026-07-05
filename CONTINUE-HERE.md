# Continue Here — Razzl API

## Current status

**Slice 12 started** — App Store readiness checklist + listing docs. **Slice 10** code complete; api-dev smoke validated; webhook URI fix applied (re-deploy required).

## Current branch

Merge webhook URI fix + Slice 12 docs to `main`, deploy api-dev, run `shopify app deploy`, then complete manual billing E2E on dev store.

## Last completed slice

**Slice 10** — Shopify billing (pending full manual E2E after webhook re-deploy)

## Next slice

**Slice 12** — App Store submission prep (in progress)

## Exact next steps

1. Merge + deploy api-dev
2. **`shopify app deploy`** — registers absolute webhook URLs (critical fix)
3. Run `npm run test:slice10-smoke -- YOUR-STORE.myshopify.com`
4. Manual: approve test plan → verify SQL in [`SLICE-10-E2E-VALIDATION.md`](docs/commerce/SLICE-10-E2E-VALIDATION.md)
5. Work [`APP-STORE-READINESS.md`](docs/commerce/APP-STORE-READINESS.md) checklist — screenshots, demo store, listing form

## Slice 10 validation status

| Check | Status |
|-------|--------|
| api-dev deployed (CI run 28752759266) | ✅ |
| Lint + tests (52) | ✅ |
| Smoke script (infra) | ✅ |
| Webhook URL fix in `shopify.app.toml` | ✅ (needs deploy) |
| Dev store billing approval E2E | ⬜ Manual |
| `app_subscriptions/update` → DB | ⬜ After re-deploy |

See [`docs/commerce/SLICE-10-E2E-VALIDATION.md`](docs/commerce/SLICE-10-E2E-VALIDATION.md).

## Slice 12 deliverables (started)

| Path | Purpose |
|------|---------|
| `docs/commerce/APP-STORE-READINESS.md` | Submission checklist + listing copy draft |
| `docs/commerce/SLICE-10-E2E-VALIDATION.md` | E2E validation report + SQL |
| `scripts/slice-10-e2e-smoke.mjs` | api-dev smoke (optional shop arg) |
| `app/shopify/shopify-app-footer.tsx` | Privacy + support links |

## Recommended next Composer prompt

```text
Capture App Store screenshots from dev store demo. Complete APP-STORE-READINESS.md demo store section. Create shopify.app.prod.toml for production deploy.
```
