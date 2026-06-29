# Continue Here — Razzl API

## Current status

**Slice 3 complete** — Shopify OAuth install flow, HMAC validation, encrypted token storage, connection status API, embedded admin home.

## Current branch

`slice-003-shopify-oauth` — merge to `origin/main` after validation

## Last completed slice

**Slice 3** — Shopify app skeleton / OAuth (2026-06-29)

## Next slice

**Slice 4** — Razzl tenant/account connection (`tenant_fk` linking)

## Exact next steps

1. Configure Shopify Partner app URLs to match `shopify.app.toml` and `.env.example`
2. Set `SHOPIFY_*` and `COMMERCE_TOKEN_ENCRYPTION_KEY` in GitHub Environment / Secrets Manager
3. Merge `slice-003-shopify-oauth` → `origin/main`
4. Validate install on Shopify dev store creates `commerce_platform_connection` row
5. Start Slice 4: link connection to Studio tenant

## Files added (Slice 3)

| Path | Purpose |
|------|---------|
| `lib/commerce/config/shopify-env.ts` | Shopify env config + shop domain normalization |
| `lib/commerce/core/crypto/token-crypto.ts` | AES-256-GCM token encrypt/decrypt |
| `lib/commerce/core/connections/platform-connection-repo.ts` | Connection upsert + status queries |
| `lib/commerce/adapters/shopify/oauth.ts` | OAuth HMAC, authorize URL, token exchange |
| `app/api/commerce/shopify/auth/route.ts` | Install → Shopify authorize redirect |
| `app/api/commerce/shopify/auth/callback/route.ts` | OAuth callback + DB persist |
| `app/api/commerce/shopify/connection/route.ts` | Connection status JSON API |
| `app/shopify/page.tsx` | Embedded admin home (minimal) |
| `shopify.app.toml` | Partner app config template |

## Validation status

- [x] OAuth HMAC unit tests (valid + invalid)
- [x] Token encryption roundtrip tests
- [x] Authorize URL builder test
- [x] `npm run lint` / `npm run test` / `npm run build`
- [ ] Live install on Shopify dev store
- [ ] GitHub Environment secrets for Shopify + encryption key

## Do-not-change warnings

- Schema migrations stay in **Studio** repo only
- No product sync until Slice 5
- No tenant linking until Slice 4

## Recommended next Composer prompt

```text
Implement Slice 4 per STUDIO-CONTRACT.md. Link Shopify connection to tenant_fk. Deep link to Studio signup/login. Connection status UI in Shopify admin. Update CONTINUE-HERE.md.
```
