# Continue Here — Razzl API

## Current status

**Slice 2 complete** — platform adapter interface, registry, Shopify skeleton with normalization + webhook unit tests.

## Current branch

`slice-002-adapter-foundation` — merge to `origin/main` after validation

## Last completed slice

**Slice 2** — Platform adapter foundation (2026-06-29)

## Next slice

**Slice 3** — Shopify app skeleton / OAuth install flow

## Exact next steps

1. Merge `slice-002-adapter-foundation` → `origin/main`
2. Configure GitHub Environment `dev` — see `.github/DEPLOYMENT.md`
3. Enable API ECS: set `api_service_enabled = true` in Studio terraform-dev
4. Start Slice 3: Shopify OAuth authorize + callback routes

## Files added (Slice 2)

| Path | Purpose |
|------|---------|
| `lib/commerce/adapters/types.ts` | Adapter interface, normalized types, `CommerceAdapterError` |
| `lib/commerce/adapters/registry.ts` | `getAdapter(platformType)` |
| `lib/commerce/adapters/shopify/index.ts` | Shopify adapter skeleton (API methods → NOT_IMPLEMENTED) |
| `lib/commerce/adapters/shopify/normalize.ts` | Shopify REST product → `NormalizedCommerceProduct` |
| `lib/commerce/adapters/shopify/webhooks.ts` | HMAC verify + webhook normalization |
| `lib/commerce/adapters/shopify/__fixtures__/` | Golden JSON fixtures |
| `lib/commerce/adapters/**/*.test.ts` | Normalization, webhook, registry tests |
| `vitest.config.ts` | Unit test runner |

## Validation status

- [x] Adapter interface matches `ADAPTER-CONTRACT.md`
- [x] Shopify product normalization golden tests pass
- [x] Webhook HMAC + normalization tests pass
- [x] Registry returns Shopify adapter; rejects unsupported platforms
- [x] `npm run lint` / `npm run test` / `npm run build`
- [ ] GitHub Environment `dev` configured for deploy workflow
- [ ] ECS API service enabled in terraform-dev

## Do-not-change warnings

- Schema migrations stay in **Studio** repo only
- No real Shopify OAuth/API calls until Slice 3+
- Do not duplicate Studio UI in this repo

## Recommended next Composer prompt

```text
Implement Slice 3 per docs/commerce/SHOPIFY-SPEC.md. Shopify OAuth authorize + callback, HMAC validation, encrypted token storage on commerce_platform_connection. No product sync yet. Update CONTINUE-HERE.md.
```
