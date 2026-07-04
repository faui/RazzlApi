# Razzl Commerce Integration — Source of Truth

This directory holds the **authoritative documentation** for the Commerce Integration Core + Shopify-first Acquisition Connector initiative.

**Location:** RazzlApi repo (`api/docs/commerce/`). Studio repo keeps MySQL DDL only — see [`../../../studio/db/migrations/`](../../../studio/db/migrations/).

## Start here

1. Read the strategy document: [`razzl_shopify_presence_integration_initiative.md`](./razzl_shopify_presence_integration_initiative.md)
2. Read [`STUDIO-CONTRACT.md`](./STUDIO-CONTRACT.md) before touching Studio integration or deep links
3. Read [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md) for the current slice
4. Check [`/CONTINUE-HERE.md`](../../CONTINUE-HERE.md) for session handoff state (RazzlApi)

## Document index

| Document | Purpose |
|----------|---------|
| [STUDIO-CONTRACT.md](./STUDIO-CONTRACT.md) | Actual Studio routes, tables, APIs, and deep-link contracts (from source code) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Target architecture: Commerce Core + platform adapters |
| [DATA-MODEL.md](./DATA-MODEL.md) | Generic `commerce_*` schema (DDL applied in Studio repo) |
| [API-REPO.md](./API-REPO.md) | **RazzlApi** — api.razzl.com, terraform, CI/CD, Composer |
| [ADAPTER-CONTRACT.md](./ADAPTER-CONTRACT.md) | Platform adapter interface (RazzlApi) |
| [SHOPIFY-SPEC.md](./SHOPIFY-SPEC.md) | Shopify layer — OAuth, sync, CTA, billing |
| [SHOPIFY-DEPLOYMENT.md](./SHOPIFY-DEPLOYMENT.md) | Dev/prod deploy checklist for API + Shopify CLI |
| [STYLEGUIDE.md](./STYLEGUIDE.md) | Shopify admin + storefront CTA styling |
| [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md) | Slices, repo split, merge-to-main policy |
| [SECURITY-COMPLIANCE.md](./SECURITY-COMPLIANCE.md) | Security, privacy, App Store compliance |
| [TESTING.md](./TESTING.md) | Test strategy (Studio + RazzlApi) |
| [OPEN-QUESTIONS.md](./OPEN-QUESTIONS.md) | Resolved decisions (2026-06-28) |
| [SLICE-9B-UX-GAP-REVIEW.md](./SLICE-9B-UX-GAP-REVIEW.md) | Embedded admin UX gap review |

Studio-only references (not duplicated here):

| Document | Path |
|----------|------|
| Release backlog | `studio/docs/NEXT-RELEASE-FEATURES.md` |
| ADRs | `studio/docs/adr/` |

## Non-negotiables

1. **Razzl Studio is the system of record** for tenant profile, direct Stripe billing, products, manuals, copilot editing, publishing, and Launch Copilot URLs.
2. **Do not rebuild Studio flows inside Shopify** (dashboard, profile, billing, product creation, manual upload, copilot editing, publishing).
3. **Shopify is the first adapter**, not the architecture. Use generic `commerce_*` naming in core schema and services.
4. **Direct Razzl customers stay on Stripe.** Shopify-acquired customers use Shopify Billing/App Pricing.
5. **Do not invent routes, DB fields, or API contracts.** Inspect Studio source and update `STUDIO-CONTRACT.md` when behavior changes.

## Source-of-truth hierarchy

1. Current code on `origin/main`
2. `STUDIO-CONTRACT.md`
3. `IMPLEMENTATION-PLAN.md`
4. `ARCHITECTURE.md`, `DATA-MODEL.md`, `ADAPTER-CONTRACT.md`, `SHOPIFY-SPEC.md`
5. Tests
6. Terraform / IaC
7. Chat transcripts (not authoritative)

## Interim code layout

| Repo | Path |
|------|------|
| **RazzlApi** (primary) | `lib/commerce/core/`, `lib/commerce/adapters/shopify/`, `app/api/commerce/` |
| **Studio** (schema only) | `db/migrations/`, `db/database_schema_*_ddl.sql` |

See [`API-REPO.md`](./API-REPO.md) for full RazzlApi layout and Composer multi-root workspace setup.

## Related repo areas

| Area | Path |
|------|------|
| Studio dashboard | `studio/app/app/dashboard/page.tsx` |
| Product editor | `studio/app/app/products/[productPk]/edit/page.tsx` |
| DB schema (DDL owner) | `studio/db/migrations/` |
| RazzlApi commerce code | `lib/commerce/`, `app/api/commerce/`, `app/shopify/` |
| Session auth (Studio) | `studio/lib/session.ts` |
