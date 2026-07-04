# Razzl API Repository (`api.razzl.com`)

**GitHub:** https://github.com/faui/RazzlApi.git  
**Local path:** `C:\venkat\razl\ai_dev\alaunch2026\api`  
**Status:** Approved architecture (2026-06-28) — repo scaffolding in progress

## Decision summary

**RazzlApi is a separate repository and separate Fargate service**, sibling to Studio and Chat — not a folder inside the Studio repo.

| Concern | Owner repo | Host |
|---------|------------|------|
| Product authoring, copilot edit, Stripe billing UI | **Studio** | `studio.razzl.com` |
| End-customer ChatKit | **Chat** | `chat.razzl.com` |
| Commerce integrations, Shopify OAuth/webhooks, CTA resolver, external APIs | **RazzlApi** | `api.razzl.com` |
| Shared MySQL schema (DDL + migrations) | **Studio** (source of truth) | RDS (shared) |
| Shared VPC / ECS cluster / ALB | **Studio terraform** (reference) + **RazzlApi terraform** (copy) | AWS |

This aligns with existing infrastructure: `infra/terraform/ecs_api.tf` in Studio already defines the API Fargate service placeholder.

## Is a separate repo wise?

**Yes — recommended for Razzl's situation.**

| Factor | Separate repo (chosen) | Commerce inside Studio repo |
|--------|------------------------|----------------------------|
| Team ownership | API/commerce team can ship independently | Couples commerce releases to Studio cadence |
| Runtime scaling | API CPU/memory tuned for webhooks + sync bursts | Studio sized for UI, not webhook load |
| Blast radius | Commerce bug less likely to take down Studio dashboard | Shared deploy risk |
| Shopify App Store | Cleaner app boundary for review and secrets | Blurs admin UI with connector |
| Friction today | Moderate — mitigated by shared DB schema in Studio | Lower initial setup cost |

**Friction is manageable today** because:

1. **One shared MySQL database** — schema migrations stay in Studio repo (`db/migrations/`, `db/database_schema_*_ddl.sql`). API repo consumes the schema; it does not fork migrations.
2. **Same VPC/cluster** — no cross-network latency between api, studio, chat.
3. **Terraform pattern copy** — RazzlApi gets its own `infra/terraform/` copied from Studio patterns (ECS service, ECR, secrets, ALB host rule for `api.razzl.com`).
4. **Documented contracts** — `docs/commerce/STUDIO-CONTRACT.md` defines Studio deep links; API implements commerce only.

**Do not duplicate** Studio product/copilot/billing UI in RazzlApi.

## RazzlApi repo layout (target)

```text
RazzlApi/
  app/                    # Next.js or Node API routes (match team choice; Next.js consistent with studio/chat)
  lib/
    commerce/
      core/               # generic commerce services
      adapters/
        shopify/          # Shopify-specific
  shopify/
    extensions/           # theme app extension (may live here or subfolder)
  infra/
    terraform/            # Same pattern as Studio — ECS, ECR, secrets, api.razzl.com ALB rule
  .github/
    workflows/            # ci.yml, deploy-api-dev.yml (mirror Studio)
  db/
    README.md             # Points to Studio repo for migrations — no duplicate DDL
  AGENTS.md
  CONTINUE-HERE.md
  .env.example
  Dockerfile
```

## Enabling Cursor Composer across repos

### Option A — Multi-root workspace (recommended)

Create `alaunch2026.code-workspace` at `C:\venkat\razl\ai_dev\alaunch2026\`:

```json
{
  "folders": [
    { "path": "studio", "name": "Razzl Studio" },
    { "path": "api", "name": "Razzl API" },
    { "path": "chat", "name": "Razzl Chat" }
  ],
  "settings": {}
}
```

Open this workspace in Cursor. Composer sessions can read/write both repos when the prompt scopes work correctly.

### Option B — Single-repo session with explicit paths

Prompt Composer with full paths:

```text
Schema/migrations: C:\venkat\razl\ai_dev\alaunch2026\studio\db\
Commerce API code: C:\venkat\razl\ai_dev\alaunch2026\api\
Read docs: api/docs/commerce/README.md first
```

### Composer rules for RazzlApi work

1. Read `docs/commerce/README.md` and `API-REPO.md` (this file)
2. Schema changes → **Studio repo** branch + migration
3. Commerce/API implementation → **RazzlApi repo** branch
4. Update both `CONTINUE-HERE.md` files when a slice spans repos
5. Never copy `product` / `guide_json` authoring into API

## Terraform and IaC ownership

**Recommendation: keep shared infrastructure in Studio repo** (`infra/terraform` prod, `infra/terraform-dev` dev). Do **not** split VPC/ALB/RDS/ECS cluster/terraform-dev into RazzlApi repo.

| Layer | Repo | Path |
|-------|------|------|
| **Shared infra** (VPC, ALB, ECS cluster, ECR repos, Route53 dev aliases, RDS SG rules) | **Studio** | `infra/terraform-dev/` |
| **Prod infra** (studio + chat + api services on prod cluster) | **Studio** | `infra/terraform/` |
| **API app code + deploy workflow** | **RazzlApi** | `.github/workflows/deploy-api-dev.yml`, `Dockerfile` |
| **API-specific task env/secrets** (Shopify keys later) | **RazzlApi docs + Studio terraform** | Extend `ecs_task_definition.api` in terraform-dev when API image exists |

RazzlApi repo owns **application code and its CI/CD pipeline**, not duplicate terraform for ALB/cluster/RDS. The dev stack **already provisions** `razzl-dev/api` ECR, API target group, `api-dev.razzl.com` DNS, and optional ECS service (`api_service_enabled`).

When RazzlApi matures:

1. Add deploy workflow in RazzlApi (mirror Studio's `deploy-studio-dev.yml`)
2. Set `api_service_enabled = true` and `api_container_image` in `terraform-dev/terraform.tfvars`
3. Add Shopify secrets to Secrets Manager; wire into API task definition in `terraform-dev/main.tf`

This gives **separate deployable apps** without **split-brain infrastructure**.

## Terraform and IaC (RazzlApi repo scope)

RazzlApi repo should include:

- `infra/terraform/README.md` — pointer to Studio repo for shared stacks
- Optional **api-only** terraform module later (e.g. Shopify-specific secrets) — not VPC/ALB/cluster

Copy **patterns** from Studio, not duplicate **state**.

## CI/CD (mirror Studio)

Target workflows in RazzlApi:

| Workflow | Trigger | Action |
|----------|---------|--------|
| `ci.yml` | PR | lint, build, test |
| `deploy-api-dev.yml` | push to `main` | ECR build → ECS deploy dev |
| `deploy.yml` | manual / prod tag | production deploy |

Copy structure from Studio `.github/workflows/deploy-studio-dev.yml`; replace ECS service/task/ECR vars with API GitHub Environment vars (`terraform output github_actions_api_dev`).

## Slice ownership split (updated)

| Slice | Primary repo |
|-------|--------------|
| 0 — Docs | Studio |
| 1 — Schema | **Studio** (migrations + DDL) |
| 2 — Adapter contract | **RazzlApi** (types can mirror; schema types generated from shared doc) |
| 3–11 — Shopify/commerce | **RazzlApi** |
| 7 — Studio deep links | Studio (URL helpers) + RazzlApi (link generation service) |
| Studio regression | Studio |

## Initial setup checklist

- [ ] Clone https://github.com/faui/RazzlApi.git to `C:\venkat\razl\ai_dev\alaunch2026\api`
- [ ] Add `README.md`, `AGENTS.md`, `.env.example`, `Dockerfile` skeleton
- [ ] Copy/adapt terraform from Studio `infra/terraform/` (api-focused subset)
- [ ] Add GitHub Actions deploy workflow
- [ ] Configure GitHub Environment vars for dev/prod ECS
- [ ] Enable `api_service_enabled` in terraform when image is ready
- [ ] Register Shopify app redirect URLs to `https://api.razzl.com/...`

## Related documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md)
- [`../adr/ADR-0002-razzl-api-separate-repo.md`](../adr/ADR-0002-razzl-api-separate-repo.md)
- Studio terraform: `infra/terraform/ecs_api.tf`
