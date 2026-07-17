# Shopify App — Dev & Production Deployment

**Applies to:** RazzlApi (`api.razzl.com` / `api-dev.razzl.com`)  
**Related:** [`SHOPIFY-SPEC.md`](./SHOPIFY-SPEC.md), [`api/.github/DEPLOYMENT.md`](../../api/.github/DEPLOYMENT.md)

## Overview

Shopify OAuth credentials and the commerce token encryption key live in **AWS Secrets Manager** and are injected into the API ECS task. Non-secret config (`RAZZL_PUBLIC_ORIGIN`, `SHOPIFY_SCOPES`) is set as plain environment variables in Terraform.

| Environment | API host | Secrets Manager secret |
|-------------|----------|------------------------|
| **Dev** | `https://api-dev.razzl.com` | `dev/shopify/razzl_api` |
| **Prod** | `https://api.razzl.com` | `prod/shopify/razzl_api` |

Secret JSON shape:

```json
{
  "api_key": "<Shopify Client ID>",
  "api_secret": "<Shopify Client secret>",
  "token_encryption_key": "<base64 32-byte AES key>",
  "studio_link_secret": "<shared HMAC secret for Studio ↔ API tenant linking>"
}
```

Generate encryption key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Dev setup (current)

### 1. Partner app URLs

In Shopify Partner Dashboard → your app → **Configuration**:

| Field | Value |
|-------|--------|
| App URL | `https://api-dev.razzl.com/shopify` |
| Allowed redirection URL | `https://api-dev.razzl.com/api/commerce/shopify/auth/callback` |

Scopes: `read_products` (add billing scopes in Slice 10).

### 2. AWS Secrets Manager

From `studio/infra/terraform-dev`:

```powershell
.\scripts\create-dev-shopify-secrets.ps1
```

Reads `api/.env.local` by default, or pass `-ApiKey`, `-ApiSecret`, `-TokenEncryptionKey` explicitly.

### 3. Terraform dev

Secret name variable (default): `shopify_api_secret_name = "dev/shopify/razzl_api"`

```powershell
cd studio/infra/terraform-dev
terraform plan -out dev.tfplan
terraform apply dev.tfplan
```

This updates the **API task definition** with Shopify env vars and secrets. ECS service ignores Terraform task-definition drift after create; the **GitHub deploy workflow** registers a new revision from the latest task family on each push to `main`.

### 4. Deploy Slice 3+ code

Merge RazzlApi `slice-003-shopify-oauth` (or later) to `main`. The `deploy-api-dev.yml` workflow builds, pushes to `razzl-dev/api`, and updates the ECS service.

Ensure GitHub Environment **`dev`** has AWS deploy credentials (see `api/.github/DEPLOYMENT.md`).

### 5. Install on dev store

```text
https://api-dev.razzl.com/api/commerce/shopify/auth?shop=YOUR-DEV-STORE.myshopify.com
```

Verify:

```sql
SELECT store_domain, install_status, installed_at
FROM commerce_platform_connection
WHERE platform_type = 'shopify';
```

### 6. Slice 4 — tenant linking

After Slice 4 is deployed to **api-dev** and **studio-dev**:

| Service | Env var | Dev value |
|---------|---------|-----------|
| RazzlApi | `RAZZL_STUDIO_PUBLIC_ORIGIN` | `https://studio-dev.razzl.com` |
| RazzlApi + Studio | `COMMERCE_STUDIO_LINK_SECRET` | Same value (from Secrets Manager `studio_link_secret`) |
| Studio | `RAZZL_API_PUBLIC_ORIGIN` | `https://api-dev.razzl.com` |

**Test flow:**

1. Open the app from Shopify admin (`/shopify?shop=...`).
2. Click **Connect existing Razzl account** → Studio login in a new tab.
3. After login, Studio completes the link and redirects back to `/shopify?shop=...&linked=1`.
4. Confirm **Razzl account** shows your tenant name and onboarding step 1 is checked.

```sql
SELECT store_domain, install_status, tenant_fk, connected_at
FROM commerce_platform_connection
WHERE platform_type = 'shopify';
```

---

## Production setup (when ready)

Use a **separate Shopify app** (or a new app version) for production — do not reuse dev Client ID on a public listing without understanding Shopify’s release model.

### 1. Shopify Partner — production app version

| Field | Value |
|-------|--------|
| App URL | `https://api.razzl.com/shopify` |
| Allowed redirection URL | `https://api.razzl.com/api/commerce/shopify/auth/callback` |
| Embedded app | Yes |
| Scopes | `read_products` (+ billing when Slice 10 ships) |

Before App Store submission you will also need privacy policy URL, compliance webhooks (Slice 11), and billing configuration (Slice 10).

**Webhook URIs in `shopify.app.toml` must be absolute HTTPS URLs** (e.g. `https://api-dev.razzl.com/api/commerce/shopify/webhooks`). Relative paths resolve under `application_url` (`/shopify`) and return 404. See [`SLICE-10-E2E-VALIDATION.md`](./SLICE-10-E2E-VALIDATION.md).

### 2. AWS Secrets Manager — prod

Create `prod/shopify/razzl_api` with production Client ID, Client secret, and a **new** `token_encryption_key` (do not copy dev key — encrypted tokens are environment-specific).

Example (PowerShell):

```powershell
$payload = @{
  api_key              = "<prod Client ID>"
  api_secret           = "<prod Client secret>"
  token_encryption_key = "<new base64 32-byte key>"
} | ConvertTo-Json -Compress

aws secretsmanager create-secret `
  --region us-east-2 `
  --name prod/shopify/razzl_api `
  --secret-string $payload
```

### 3. Terraform prod

In `studio/infra/terraform`:

1. Set `shopify_api_secret_name = "prod/shopify/razzl_api"` in `terraform.tfvars` (when added).
2. Set `api_service_enabled = true` and `api_container_image` to a prod ECR image.
3. `terraform plan` / `apply` — prod `ecs_api.tf` injects the same env vars using `local.api_host` (`api.razzl.com`).

Prod API task receives:

- `RAZZL_PUBLIC_ORIGIN=https://api.razzl.com`
- `RAZZL_STUDIO_PUBLIC_ORIGIN=https://studio.razzl.com`
- `SHOPIFY_*`, `COMMERCE_TOKEN_ENCRYPTION_KEY`, and `COMMERCE_STUDIO_LINK_SECRET` from Secrets Manager

Prod Studio task receives:

- `RAZZL_API_PUBLIC_ORIGIN=https://api.razzl.com`
- `COMMERCE_STUDIO_LINK_SECRET` from Secrets Manager (same `studio_link_secret` key)

### 4. GitHub Environment — prod

Configure `prod` environment in RazzlApi repo (`deploy-api-prod.yml` — manual dispatch). Same ECS/ECR variable pattern as dev; see `terraform output github_actions_api`.

### 5. Deploy and validate

1. Run prod deploy workflow after merge to `main`.
2. Install on a **production test store** before App Store release:

   ```text
   https://api.razzl.com/api/commerce/shopify/auth?shop=YOUR-STORE.myshopify.com
   ```

3. Confirm connection row in **prod** database (`razzldbprod` / `app_prod`).

### 6. App Store / custom distribution

- **Custom app / single merchant:** install URL above is enough.
- **Public App Store:** complete listing, compliance webhooks, Shopify Billing (Slice 10–12), theme app extension, demo store.

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| OAuth route 404 | Old API image — redeploy RazzlApi with Slice 3+ |
| `Invalid HMAC` | Wrong `SHOPIFY_API_SECRET` in Secrets Manager vs Partner Dashboard |
| `Invalid OAuth state` | Stale callback URL or clock skew — click **Connect store** again |
| `{"ok":false,"error":"OAuth callback failed"}` (legacy) | Generic 500 — redeploy; callback now returns `code` (`TOKEN_EXCHANGE_FAILED`, `SHOP_FETCH_FAILED`, etc.) |
| `TOKEN_EXCHANGE_FAILED` / `invalid_grant` | Authorization code already used — start a fresh Connect flow; do not reload callback URL |
| `SHOP_FETCH_FAILED` | Shopify Admin API issue — verify `SHOPIFY_API_VERSION` (default `2026-01`) |
| `OAUTH_NOT_READY` / encryption check false | Missing or invalid `COMMERCE_TOKEN_ENCRYPTION_KEY` in `dev/shopify/razzl_api` |
| `COMMERCE_TOKEN_ENCRYPTION_KEY must be...` | Key not valid base64 32-byte; regenerate |
| Callback 500 on DB | API task missing DB secrets or RDS SG rules |
| Redirect URI mismatch | Partner redirect URL must exactly match `RAZZL_PUBLIC_ORIGIN` + `/api/commerce/shopify/auth/callback` |

Diagnostics: `GET /api/commerce/shopify/oauth/readiness` — checks Shopify env, token encryption round-trip, and DB ping.

---

## Local development (optional)

Use ngrok with `RAZZL_PUBLIC_ORIGIN=https://<tunnel>` and add the tunnel callback URL to Partner app. ECS/terraform not required for local OAuth testing.

See also: `studio/infra/terraform-dev/README.md` (Stripe secrets pattern).
