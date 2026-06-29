# Continue Here — Razzl API

## Current status

**Slice 1 complete** — minimal Next.js app, commerce TypeScript types, DB pool skeleton, CI + dev deploy workflow.

## Current branch

`slice-001-commerce-core-schema` — merge to `origin/main` when validated

## Last completed slice

**Slice 1** — Commerce core schema types + DB access skeleton (2026-06-29)

## Next slice

**Slice 2** — Platform adapter foundation (`lib/commerce/adapters/`)

## Exact next steps

1. Merge `slice-001-commerce-core-schema` → `origin/main`
2. Configure GitHub Environment `dev` vars from `terraform output github_actions_api_dev` (Studio terraform-dev)
3. Push initial image to `razzl-dev/api` ECR; set `api_service_enabled = true` in Studio terraform-dev
4. Start Slice 2: adapter interface + registry + Shopify skeleton

## Files added (Slice 1)

| Path | Purpose |
|------|---------|
| `app/health/route.ts` | ALB health check `/health` |
| `lib/commerce/types/` | Row types for all 8 `commerce_*` tables |
| `lib/commerce/core/db/` | mysql2 pool + query helpers |
| `.github/workflows/ci.yml` | Lint + build on PR/main |
| `.github/workflows/deploy-api-dev.yml` | ECR build → ECS deploy dev |
| `Dockerfile` | Port 8080 production image |
| `db/README.md` | Pointer to Studio migrations |
| `infra/terraform/README.md` | Pointer to Studio shared infra |

## Validation status

- [x] TypeScript types match `DATA-MODEL.md` / applied migration
- [x] DB pool mirrors Studio `lib/db.ts` env vars
- [x] `/health` returns 200
- [ ] `npm run lint` / `npm run build` (run locally after `npm install`)
- [ ] GitHub Environment `dev` configured for deploy workflow
- [ ] ECS API service enabled in terraform-dev

## Do-not-change warnings

- Schema migrations stay in **Studio** repo only
- No Shopify OAuth or adapter code until Slice 2–3
- Do not duplicate Studio UI in this repo

## Recommended next Composer prompt

```text
Implement Slice 2 per studio/docs/commerce/ADAPTER-CONTRACT.md. Adapter interface, registry, Shopify skeleton with normalization unit tests. No OAuth. Update CONTINUE-HERE.md.
```
