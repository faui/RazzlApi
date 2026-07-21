# Continue Here — Razzl API

## Current status

**Slice 13 Shopify sync defect fix deployed to dev on 2026-07-21.**

The OAuth callback 404 was caused by the dev ECS task pinning Shopify Admin API
version `2024-10`, which is no longer available. API, Shopify app configuration,
theme extension configuration, and Studio-owned ECS Terraform now use `2026-07`.

The embedded product board now reads already-synced product mappings without
resolving an Admin API token. Sync and other Shopify API operations still require
a valid token. This keeps the 16 locally stored Shopify products visible while a
merchant reconnect is required.

## Deployed revisions

| Surface | Deployed code/config commit | Dev ECS revision | Status |
|---|---|---|---|
| Razzl API | `9726dbb` | `razzl-dev-api:34` | rollout completed, target healthy |
| Studio | `8775016` | `razzl-dev-studio:38` | rollout completed |

The latest API task definition has `SHOPIFY_API_VERSION=2026-07` and runs image
`9726dbb9cc296e5da0c7b610170254fc95b28655`.

## Verification completed

- Focused regression tests: 5 passed
- Full commerce tests: 85 passed
- API lint: passed
- API production build: passed
- Terraform validate: passed
- Dev Terraform apply: one API task-definition replacement only
- `https://api-dev.razzl.com/health`: `{"ok":true}`
- `https://studio-dev.razzl.com/api/health`: healthy
- Product board API for `razzl-dev.myshopify.com`: 16 Shopify products, 2 Studio products
- OAuth readiness: Shopify config, token encryption, and database all healthy

## Remaining merchant E2E step

The current connection is tenant-linked but has `tokenStatus=reauth_required`.
This is expected after the earlier failed OAuth callback and requires one
interactive Shopify reconnect:

1. Sign in to the Shopify dev account in the in-app browser.
2. Open the Razzl embedded app and complete reconnect/OAuth approval.
3. Confirm the product list renders immediately.
4. Run **Sync now** and confirm a successful sync plus refreshed list.
5. Exercise mapping, multi-title hover/count text, CTA toggle, and Studio commerce indicators.
6. Recheck API/Studio health, ECS stability, and CloudWatch errors.

Do not put Shopify credentials, session tokens, access tokens, or refresh tokens
in repo files, commands, screenshots, or logs.

## Ownership reminders

- Commerce code and Shopify adapter changes belong in Razzl API.
- Schema migrations and shared ECS Terraform belong in Studio.
- Shopify API callers must use the centralized version helper.
- Local database reads must not unnecessarily require an Admin API token.
- Storefront CTA URLs use `launchsource=shopify`.
- Stripe customers do not receive paid Shopify-billed features (OQ-020).
