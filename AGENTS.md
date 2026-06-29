# AGENTS.md — Razzl API (api.razzl.com)

## Required reading (Studio repo docs)

Commerce source-of-truth lives in the **Studio** repository:

1. [`../studio/docs/commerce/README.md`](../studio/docs/commerce/README.md)
2. [`../studio/docs/commerce/API-REPO.md`](../studio/docs/commerce/API-REPO.md)
3. [`../studio/docs/commerce/STUDIO-CONTRACT.md`](../studio/docs/commerce/STUDIO-CONTRACT.md)
4. [`../studio/docs/commerce/IMPLEMENTATION-PLAN.md`](../studio/docs/commerce/IMPLEMENTATION-PLAN.md)
5. [`../studio/CONTINUE-HERE.md`](../studio/CONTINUE-HERE.md) (schema slices)

## This repo owns

- Commerce Integration Core (`lib/commerce/core/`)
- Platform adapters (`lib/commerce/adapters/shopify/`)
- Shopify OAuth, webhooks, billing API
- CTA resolver (`api.razzl.com`)
- Shopify theme app extension
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
