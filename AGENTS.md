# AGENTS.md — Razzl API (api.razzl.com)

## Required reading (commerce docs — this repo)

Commerce documentation lives in **this repository**:

1. [`docs/commerce/README.md`](docs/commerce/README.md)
2. [`docs/commerce/API-REPO.md`](docs/commerce/API-REPO.md)
3. [`docs/commerce/STUDIO-CONTRACT.md`](docs/commerce/STUDIO-CONTRACT.md)
4. [`docs/commerce/IMPLEMENTATION-PLAN.md`](docs/commerce/IMPLEMENTATION-PLAN.md)
5. [`CONTINUE-HERE.md`](CONTINUE-HERE.md)

Schema migrations remain in **Studio**: [`../studio/db/migrations/`](../studio/db/migrations/)

## This repo owns

- Commerce Integration Core (`lib/commerce/core/`)
- Platform adapters (`lib/commerce/adapters/shopify/`)
- Shopify OAuth, webhooks, billing API
- CTA resolver (`api.razzl.com`)
- Shopify theme app extension
- **Commerce documentation** (`docs/commerce/`)
- CI/CD for API Fargate service (deploy workflow; shared infra in Studio terraform)

## Studio repo owns

- MySQL DDL and migrations (`db/`)
- Product dashboard, copilot editor, profile, Stripe billing UI
- `razzl_session` auth for Studio deep links
- Shared VPC/ALB/RDS terraform (`infra/terraform-dev/`)

## Non-negotiables

- Never rebuild Studio flows in RazzlApi or Shopify embedded UI beyond connector surfaces
- Schema changes → branch in **Studio** repo first
- Commerce code changes → branch in **RazzlApi** repo
- Use `launchsource=shopify` for storefront CTA URLs
- Stripe customers do not get paid Shopify-billed features (OQ-020)

## Slices and git

- One branch per slice: `slice-NNN-description`
- Merge to `origin/main` when slice is validated or handoff requested
- Update this repo's `CONTINUE-HERE.md` and Studio's when work spans both

## Stack

Next.js on ECS Fargate (port 8080, health `/health`), `mysql2`, shared RDS, Secrets Manager.

See Studio `AGENTS.md` for general Razzl conventions.
