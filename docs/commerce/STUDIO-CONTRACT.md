# Studio Contract — Commerce Integration

**Status:** Slice 0 discovery (source code inspection, 2026-06-28)  
**Authority:** This document reflects **actual Studio implementation**. Do not infer behavior from the initiative doc alone.

## Summary

Razzl Studio (this repo) is a Next.js 16 App Router application with custom session auth, MySQL via `mysql2`, and Stripe billing. Products belong to tenants. Launch Copilot URLs are built client-side from `product.razzl_code` and a runtime ChatKit base URL. Edit Copilot navigates to `/app/products/{productPk}/edit`. Commerce integrations must deep-link to these flows, not duplicate them.

---

## Product dashboard

### Route

| Item | Value |
|------|-------|
| **Page route** | `/app/dashboard` |
| **Page file** | `app/app/dashboard/page.tsx` |
| **Redirect** | `/app` → `/app/dashboard` (`app/app/page.tsx`) |
| **Auth guard** | `app/app/layout.tsx` — server redirect to `/auth/start` if no session |
| **Base path** | May be prefixed via `ROUTING_PATH_BASE` / `withBasePath()` — see [Routing](#routing-base-path) |

### List API

| Item | Value |
|------|-------|
| **Endpoint** | `GET /api/products` |
| **File** | `app/api/products/route.ts` |
| **Auth** | `getSessionFromCookies()` — 401 if missing |
| **Tenant scope** | `session.tenantPk` in SQL `WHERE p.tenant_fk = ?` |
| **Query params** | `page`, `pageSize`, `sortBy`, `sortDir`, `search`, `status[]`, `createdFrom`, `createdTo` |

### Dashboard component behavior

- Grid/list toggle, search, status/date filters, bulk actions (share, QR, JSON, delete)
- Per-product action menu via `DropdownMenu` (`components/ui/dropdown-menu.tsx`)
- Product creation via AppShell "+" → `ProductGuideDialog` → PDF upload pipeline

### Dashboard list fields (API → UI)

From `GET /api/products` and local `Product` type in `app/app/dashboard/page.tsx`:

| Field | Source | Notes |
|-------|--------|-------|
| `product_pk` | `product.product_pk` | Primary key |
| `model_number` | `product.model_number` | SKU/model |
| `model_name` | `product.model_name` | Display name |
| `thumbnail_url` | `product.thumbnail_url` | |
| `razzl_code` | `product.razzl_code` | **Launch URL key** — unique |
| `created_on` | `product.created_on` | |
| `status_code` | `master_product_status.status_code` | Join via FK |
| `accessed_count` | chat session aggregate | Usage metric |
| `last_accessed` | chat session aggregate | |
| `sqs_queue_temporary` | `product.sqs_queue_temporary` | In-progress pipeline |
| `sqs_message_runid` | `product.sqs_message_runid` | In-progress pipeline |
| `created_by` | `product.created_by` | Format: `user:{appUserPk}` |

---

## Product entity / table

| Item | Value |
|------|-------|
| **Table** | `product` |
| **Primary key** | `product_pk` (bigint) |
| **Tenant FK** | `tenant_fk` → `tenant.tenant_pk` |
| **Status FK** | `master_product_status_fk` → `master_product_status` |
| **Launch identifier** | `razzl_code` (varchar, unique) |
| **Copilot content** | `guide_json` (JSON) |
| **Schema file** | `db/database_schema_20260617_ddl.sql` (~line 1004) |

### Product status (`master_product_status`)

There is **no separate `copilot_status` column**. UI "copilot status" maps to `master_product_status.status_code`.

| `status_code` | UI meaning |
|---------------|------------|
| `active` | Published/launchable |
| `in-progress` | PDF→copilot creation running |
| `inactive` | Grayed out, not selectable |
| `processing-error` | Creation failed |
| `suspend`, `marktodelete` | Also in master data |

**API:** `GET /api/master/product-status` (`app/api/master/product-status/route.ts`)

**Seed:** `db/seeddata/database_schema_20260617_seeddata_master_product_status.sql`

---

## Product action menu

**File:** `app/app/dashboard/page.tsx` (grid and list variants)

### In-progress products (`status_code === "in-progress"`)

| Action | Behavior |
|--------|----------|
| View Progress | Opens progress dialog; polls `GET /api/guides/progress` |
| Usage | Link to `/app/reports/chat-session-trends?product={product_pk}` |
| Cancel | `POST /api/guides/kill` |

### Normal products

| Action | Implementation |
|--------|----------------|
| **Launch Copilot** | `launchProduct(product)` — opens ChatKit URL in new tab |
| Usage | Link to chat session trends report |
| **Edit Copilot** | `openEditDialog(product_pk)` → `router.push('/app/products/{id}/edit')` |
| Copy Link | `buildLaunchUrl(product, "url")` → clipboard |
| Download QR | `buildLaunchUrl(product, "qrcode")` → QR PNG |
| Download JSON | `GET /api/products/{id}` |
| Delete | `DELETE /api/products/{id}` (role/creator gated) |

### Permissions

- **Edit/delete:** `admin` or `owner` role, OR `product.created_by === "user:{appUserPk}"`
- Roles loaded from `GET /api/user/profile`

---

## Launch Copilot URL generation

### Storage

Launch URLs are **not stored in the database**. They are **computed at runtime** from:

1. `runtimeConfig.chatKitBaseUrl` — from `master_app_config` key `admin.chatkit_base_url`, default `https://chat.razzl.com/razzlchatkit.html`
2. `product.razzl_code`

**Config chain:** `lib/master-app-config.ts` → `lib/runtime-app-config.ts` → `components/runtime-config-provider.tsx` → `useRuntimeAppConfig()`

### URL pattern

```
{chatKitBaseUrl}?razzl_code_product={razzl_code}&launchsource={launchsource}
```

If `chatKitBaseUrl` already contains `?`, use `&` as separator.

### `launchsource` values (dashboard)

| Value | Used by |
|-------|---------|
| `launchfromauthor` | Launch Copilot menu action (`launchProduct`) |
| `url` | Copy Link |
| `qrcode` | QR download |

Bulk share uses `{chatKitBaseUrl}?razzl_code_product={razzl_code}` without `launchsource`.

### Key functions (client-side)

| Function | File | Lines (approx) |
|----------|------|----------------|
| `buildLaunchUrl(product, launchsource)` | `app/app/dashboard/page.tsx` | 367–381 |
| `launchProduct(product)` | `app/app/dashboard/page.tsx` | 620–624 |

**Admin variant:** `app/razzladmin/product-admin/page.tsx` (~255–279)

### Commerce integration implication

- Storefront CTA and Shopify paths use **`launchsource=shopify`** (OQ-002). Dashboard continues to use `launchfromauthor`, `url`, `qrcode`.
- Canonical launch key is `razzl_code`, not `product_pk`.
- For server-side CTA resolution, use **`api.razzl.com`** commerce resolver (RazzlApi) reading `product.razzl_code` + `master_app_config.admin.chatkit_base_url` (OQ-003, OQ-031).

---

## Edit Copilot route

| Item | Value |
|------|-------|
| **Route** | `/app/products/[productPk]/edit` |
| **File** | `app/app/products/[productPk]/edit/page.tsx` |
| **Navigation** | Dashboard: `router.push('/app/products/${productId}/edit')` |
| **Save API** | `PUT /api/products/{productPk}` |
| **Load API** | `GET /api/products/{productPk}` |

### Deep link template (Studio)

```
{STUDIO_PUBLIC_ORIGIN}{BASE_PATH}/app/products/{product_pk}/edit
```

Use `withBasePath('/app/products/{product_pk}/edit')` on client; use `getPublicOrigin()` + base path for server-generated links.

### Product creation (not Edit)

| Flow | Entry | API |
|------|-------|-----|
| PDF → copilot | AppShell "+" / `ProductGuideDialog` | `POST /api/guides/create` or `POST /api/createManualFromPDF` |
| Eligibility | | `GET /api/guides/eligibility` |
| Progress | | `GET /api/guides/progress?runID=&queueUrl=` |

Commerce "Create in Razzl Studio" should deep-link to dashboard or trigger existing signup + product creation flow — **do not rebuild PDF upload in Shopify**.

---

## Tenant / profile

### UI routes

| Route | File | Purpose |
|-------|------|---------|
| `/app/profile` | `app/app/profile/page.tsx` | User + business (tenant) profile |
| `/app/accounts` | `app/app/accounts/page.tsx` | Tenant user management |
| `/app/settings` | `app/app/settings/page.tsx` | User preferences |

### APIs

| Method | Route | File |
|--------|-------|------|
| GET/PUT | `/api/user/profile` | `app/api/user/profile/route.ts` |
| GET/POST | `/api/tenant/profile` | `app/api/tenant/profile/route.ts` |
| GET | `/api/tenant/setup-status` | `app/api/tenant/setup-status/route.ts` |
| GET/POST | `/api/tenant/users` | `app/api/tenant/users/route.ts` |

### Tenant table

| Item | Value |
|------|-------|
| **Table** | `tenant` |
| **Primary key** | `tenant_pk` |
| **Status FK** | `master_tenant_status_fk` |
| **Key fields** | `tenant_name`, `tenant_legal_name`, `support_email`, address fields, `avatar_url` |
| **Schema** | `db/database_schema_20260617_ddl.sql` (~line 1181) |

### User ↔ tenant

| Table | Purpose |
|-------|---------|
| `app_user` | Email, username, password, display name |
| `tenant_user` | Membership + `master_role_fk` |
| `app_user_tenant` | Multi-tenant membership, default tenant |
| `master_role` | `owner`, `admin`, `agent`, `viewer` |

### Tenant creation

`lib/tenant.ts` → `ensureTenantForUser()` during signup/verify.

### Session tenant context

`Session.tenantPk` from `lib/session.ts` — all product APIs scope to this value.

---

## Billing / Stripe

### UI routes

| Route | File |
|-------|------|
| `/app/billing` | `app/app/billing/page.tsx` |
| `/app/subscription` | `app/app/subscription/page.tsx` |
| `/auth/stripe-complete` | `app/auth/stripe-complete/page.tsx` |

### Stripe API routes

| Route | File | Purpose |
|-------|------|---------|
| `POST /api/stripe/checkout` | `app/api/stripe/checkout/route.ts` | Checkout session |
| `POST /api/stripe/checkout/finalize` | `app/api/stripe/checkout/finalize/route.ts` | Post-checkout sync |
| `POST /api/stripe/portal` | `app/api/stripe/portal/route.ts` | Billing portal |
| `POST /api/stripe/webhook` | `app/api/stripe/webhook/route.ts` | Webhooks |
| `GET /api/subscription/summary` | `app/api/subscription/summary/route.ts` | Billing summary |
| `GET /api/stripe/public-config` | `app/api/stripe/public-config/route.ts` | Publishable key |

### Service layer

| Module | File |
|--------|------|
| Stripe client | `lib/stripe.ts` |
| Customer mapping | `lib/stripe-customer.ts` |
| Billing summary | `lib/subscription-billing-summary.ts` |
| Tier catalog | `lib/subscription-catalog.ts` |

### DB tables

| Table | Purpose |
|-------|---------|
| `tenant_stripe_customer` | `tenant_fk` → Stripe customer ID |
| `tenant_subscription` | Current subscription, tier limits |
| `master_subscription_tier` | Tier metadata + `stripe_price_id` |

### Commerce boundary

- **Direct Studio customers:** existing Stripe flow unchanged.
- **Shopify-acquired customers:** Shopify Billing (future slice) — record in `commerce_billing_account`, do not route through Studio Stripe checkout unless policy allows.
- Studio billing deep link: `{ORIGIN}{BASE_PATH}/app/billing` or `/app/subscription`

---

## Auth / session

| Item | Value |
|------|-------|
| **Framework** | Custom (not NextAuth/Clerk/Supabase Auth) |
| **Cookie** | `razzl_session` (`lib/session-constants.ts`) |
| **TTL** | 7 days, sliding refresh |
| **Storage** | `app_user_session` (SHA-256 hashed token) |
| **Server API** | `getSessionFromCookies()` in `lib/session.ts` |
| **Route protection** | `proxy.ts` (Next.js 16) + `app/app/layout.tsx` |

### Session shape

```typescript
{
  appUserPk: number;
  tenantPk: number;
  roleCode: string | null;
  platformRoles: string[];
  authProvider: string | null;
  samlNameId: string | null;
  samlSessionIndex: string | null;
}
```

### Auth entry routes

| Route | Purpose |
|-------|---------|
| `/auth/start` | Auth landing |
| `/auth/login` | Email/password |
| `/auth/verify` | OTP verify + signup |
| `/auth/complete-profile` | Profile completion |

### Deep link authentication

Studio deep links require an active `razzl_session` cookie. Shopify embedded app cannot rely on Studio cookie directly — account linking slice must establish tenant connection and use Studio SSO/deep-link pattern with login redirect. **See OPEN-QUESTIONS.md.**

---

## Database access pattern

| Item | Value |
|------|-------|
| **Driver** | `mysql2/promise` pool |
| **Module** | `lib/db.ts` |
| **Queries** | Raw SQL via `query<T>(sql, params)` |
| **Procedures** | `callProcedure()`, `spCreateUpdateProductWithTenant()` |
| **ORM** | None |

**Env vars:** `RAZZL_AUTH_DB_HOST`, `RAZZL_AUTH_DB_USER`, `RAZZL_AUTH_DB_PASSWORD`, `RAZZL_AUTH_DB_NAME`, `RAZZL_AUTH_DB_SSL`

---

## API conventions

- Location: `app/api/**/route.ts`
- Auth: `getSessionFromCookies()` → `{ ok: false, error: "Unauthorized" }` with 401
- Tenant scoping: `session.tenantPk` in SQL
- Response shape: `{ ok: true, ... }` or `{ ok: false, error: "..." }`
- Dynamic route `params`: Promise (Next.js 16 — await in handlers)
- Logging: `traceLog()` / `errorLog()` from `lib/logger.ts`

---

## UI conventions

| Area | Convention |
|------|------------|
| Styling | Tailwind + shadcn/ui (`components/ui/*`) |
| Icons | `lucide-react` |
| Toasts | `sonner` |
| Theming | `next-themes` |
| Class merge | `cn()` in `lib/utils.ts` |
| i18n | `lib/i18n/strings.ts` |

---

## Routing / base path

| Variable | Purpose |
|----------|---------|
| `ROUTING_PATH_BASE` / `NEXT_PUBLIC_ROUTING_PATH_BASE` | ALB path prefix (e.g. `/author`) |
| `withBasePath()` | Client-side path prefix (`lib/routing-path.ts`) |
| `getPublicOrigin()` | Server absolute URLs (`lib/routing-path-server.ts`) |

**Known issue:** Dashboard Edit Copilot uses `router.push('/app/products/...')` **without** `withBasePath()`, while other links use `withBasePath()`. May break when base path is set.

---

## Deployment / env (relevant to commerce)

| Item | Notes |
|------|-------|
| Local dev | `npm run dev` on port **4000**, `.env.local` from `.env.example` |
| Docker/ECS | `Dockerfile`, `.github/workflows/deploy-studio-dev.yml` |
| Health | `GET /api/health` (unauthenticated) |
| Secrets | Stripe, DB, OAuth via ECS/Secrets Manager — never commit |

---

## APIs/services future Shopify code should use

| Need | Studio surface |
|------|----------------|
| List tenant products | `GET /api/products` (session required) |
| Product detail + `razzl_code` | `GET /api/products/{productPk}` |
| Product status | `status_code` from products list or master API |
| Launch URL | Compute from `razzl_code` + `chatKitBaseUrl` (see above) |
| Edit copilot | Deep link to `/app/products/{productPk}/edit` |
| Create product | Deep link to `/app/dashboard` + existing PDF flow |
| Tenant profile | Deep link to `/app/profile` (read-only summary in Shopify OK) |
| Direct billing | Deep link to `/app/billing` (Stripe customers only) |
| Subscription state | `GET /api/subscription/summary` |
| Tenant setup completeness | `GET /api/tenant/setup-status` |
| Signup/login | `/auth/start`, `/auth/verify` |

**No commerce-specific APIs exist in Studio yet.** Commerce APIs live on **RazzlApi** (`api.razzl.com`). Studio may add a read-only product API for mapping status (see NEXT-RELEASE-FEATURES).

---

## Uncertainties / follow-up

| # | Area | Question |
|---|------|----------|
| 1 | Base path | Should all deep links use server-side `withBasePath` / `getPublicOrigin()` helpers exclusively? |
| 2 | `launchsource` | **Resolved:** Shopify uses `shopify`; dashboard uses `launchfromauthor`, `url`, `qrcode` |
| 3 | Published vs active | **Resolved:** `active` sufficient for CTA gating (OQ-001) |
| 4 | Deep link auth | **Resolved:** Standard Studio `razzl_session` login in new tab (OQ-010) |
| 5 | Cross-app API | **Resolved:** CTA resolver on RazzlApi (`api.razzl.com`) |
| 6 | Product API for storefront | Storefront CTA needs unauthenticated mapping→launch URL resolution — no public API exists today. |

See [`OPEN-QUESTIONS.md`](./OPEN-QUESTIONS.md) for full list.
