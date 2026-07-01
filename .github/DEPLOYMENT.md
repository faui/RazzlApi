# GitHub Actions deployment setup (RazzlApi)

RazzlApi follows the same pattern as **RazzlStudio** and **RazzlChat**:

| Environment | Workflow | Trigger |
|-------------|----------|---------|
| `dev` | `deploy-api-dev.yml` | Push to `main` (and manual dispatch) |
| `prod` | `deploy-api-prod.yml` | Manual only (`workflow_dispatch`) |

Configure **GitHub Environments** named exactly `dev` and `prod` in this repo  
(**Settings → Environments**). Variables and secrets are **per environment**, not repository-level.

## Workflows

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | Lint + build on PR and `main` |
| `.github/workflows/deploy-api-dev.yml` | Build → ECR → ECS **dev** |
| `.github/workflows/deploy-api-prod.yml` | Build → ECR → ECS **prod** (manual) |

## Terraform outputs (source of truth)

From the **Studio** repo:

```powershell
# Dev
cd ..\studio\infra\terraform-dev
terraform output github_actions_api_dev

# Prod (after api_service_enabled = true in prod terraform)
cd ..\studio\infra\terraform
terraform output github_actions_api
```

## Environment variables (both `dev` and `prod`)

Set these as **Environment variables** (not repository variables):

| Variable | Dev value | Prod value |
|----------|-----------|------------|
| `AWS_REGION` | `us-east-2` | `us-east-2` |
| `AWS_ECR_REPOSITORY` | `razzl-dev/api` | `razzl-prod/api` |
| `ECS_CLUSTER` | `razzl-dev-cluster` | `razzl-prod-cluster` |
| `ECS_SERVICE` | `razzl-dev-api` | `razzl-prod-api` |
| `ECS_TASK_FAMILY` | `razzl-dev-api` | `razzl-prod-api` |
| `ECS_CONTAINER_NAME` | `api_app` | `api_app` |

## Environment secrets (both `dev` and `prod`)

| Secret | Notes |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | Same IAM deploy user as Studio/Chat (copy from their `dev` / `prod` environments) |
| `AWS_SECRET_ACCESS_KEY` | Same IAM deploy user secret |

RazzlApi has **no** Stripe or ChatKit variables — only AWS deploy credentials and ECS/ECR names.

Shopify OAuth and token encryption for the API container are **not** in GitHub Actions — they are injected via ECS task definition from AWS Secrets Manager (`dev/shopify/razzl_api` or `prod/shopify/razzl_api`). See `studio/docs/commerce/SHOPIFY-DEPLOYMENT.md`.

## Quick setup with GitHub CLI

Create `prod` environment and set **dev** variables (secrets must be copied from Studio/Chat UI):

```powershell
gh api --method PUT repos/faui/RazzlApi/environments/prod

gh variable set AWS_REGION --env dev --repo faui/RazzlApi --body "us-east-2"
gh variable set AWS_ECR_REPOSITORY --env dev --repo faui/RazzlApi --body "razzl-dev/api"
gh variable set ECS_CLUSTER --env dev --repo faui/RazzlApi --body "razzl-dev-cluster"
gh variable set ECS_SERVICE --env dev --repo faui/RazzlApi --body "razzl-dev-api"
gh variable set ECS_TASK_FAMILY --env dev --repo faui/RazzlApi --body "razzl-dev-api"
gh variable set ECS_CONTAINER_NAME --env dev --repo faui/RazzlApi --body "api_app"

gh variable set AWS_REGION --env prod --repo faui/RazzlApi --body "us-east-2"
gh variable set AWS_ECR_REPOSITORY --env prod --repo faui/RazzlApi --body "razzl-prod/api"
gh variable set ECS_CLUSTER --env prod --repo faui/RazzlApi --body "razzl-prod-cluster"
gh variable set ECS_SERVICE --env prod --repo faui/RazzlApi --body "razzl-prod-api"
gh variable set ECS_TASK_FAMILY --env prod --repo faui/RazzlApi --body "razzl-prod-api"
gh variable set ECS_CONTAINER_NAME --env prod --repo faui/RazzlApi --body "api_app"
```

Then add `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as **environment secrets** in the GitHub UI for each environment (or `gh secret set ... --env dev` if you have the values locally).

## Before first deploy succeeds

ECS task definition and service must exist in AWS:

1. Push an image to the target ECR repo (workflow build step, or manual `docker push`).
2. In Studio terraform, set `api_service_enabled = true` and `api_container_image` to that URI.
3. Run `terraform apply` in `infra/terraform-dev` (dev) or `infra/terraform` (prod).

Until then, workflows may fail at `describe-task-definition` because the task family does not exist yet.

## Prod protection (recommended)

On the `prod` environment in GitHub: enable **Required reviewers** so production deploys need approval (same as Studio).

See also: `../studio/infra/terraform/docs/GITHUB_ACTIONS.md`
