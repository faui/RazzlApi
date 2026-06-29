# Terraform / infrastructure

**Shared infrastructure (VPC, ALB, ECS cluster, ECR, RDS) is owned by the Studio repo.**

| Environment | Studio path |
|-------------|-------------|
| Dev | `../studio/infra/terraform-dev/` |
| Prod | `../studio/infra/terraform/` |

RazzlApi owns application code and `.github/workflows/deploy-api-dev.yml`.

Configure GitHub Environment `dev` from:

```bash
cd ../studio/infra/terraform-dev
terraform output github_actions_api_dev
```

Set `api_service_enabled = true` and `api_container_image` in `terraform-dev/terraform.tfvars` when ready to run the ECS service.

See [`../studio/docs/commerce/API-REPO.md`](../studio/docs/commerce/API-REPO.md).
