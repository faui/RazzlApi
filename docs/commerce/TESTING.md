# Commerce Integration — Testing Strategy

**Status:** Slice 0 — test plan baseline  
**Rule:** Add/update tests for every implementation slice (Slice 1+).

## Test categories

| Category | Scope | When |
|----------|-------|------|
| Unit | Normalizers, URL builders, mapping logic, billing state | Every slice with logic |
| DB | Migrations, uniqueness, FK constraints, idempotency | Slice 1, 11 |
| Integration | OAuth callback, sync with mocked API, billing flows | Slices 3, 5, 10 |
| Webhook | HMAC, replay, malformed payloads | Slice 11 |
| UI | Mapping table, empty/error states | Slices 6, 8 (manual or E2E) |
| E2E | Install → link → sync → map → CTA → launch | Slice 12 |
| Security | Token redaction, encryption, invalid signatures | Slices 3, 8, 11 |
| Regression | Studio dashboard/launch/edit/profile/billing unchanged | Every slice touching shared code |

## Repo test commands (existing)

| Command | Purpose |
|---------|---------|
| `npm run lint` | ESLint — run on every slice |
| `npm run build` | Next.js build verification |
| `npm run test:basepath-smoke` | Base path routing smoke (relevant Slice 7) |
| `npm run test:stripe-billing` | Stripe billing script (ensure no regression) |

## Repo-specific test commands

| Repo | Command |
|------|---------|
| Studio | `npm run lint`, `npm run build` |
| RazzlApi | `npm run lint`, `npm run build` (when scaffolded) |

Schema migration verify (Studio): apply `db/migrations/20260628_commerce_core_schema.sql` on dev DB.

```text
npm run test:commerce        # proposed — unit + integration
npm run test:commerce:shopify # proposed — Shopify adapter fixtures
```

## Must-have tests before App Store submission

- [ ] OAuth callback HMAC validation (valid + invalid)
- [ ] Token storage encryption path
- [ ] Expiring offline token refresh under row lock (`resolveShopifyConnection`)
- [ ] Session token exchange on embedded app mount
- [ ] `tokenStatus` on connection API (`ok` / `refresh_needed` / `reauth_required`)
- [ ] Product sync idempotency (same product twice → one row)
- [ ] Uninstall webhook deactivates connection
- [ ] Mandatory compliance webhooks acknowledge correctly
- [ ] Billing active/inactive feature gates
- [ ] Theme app block: mapped+published → renders; unmapped → hidden
- [ ] Launch tracking event recorded on CTA click
- [ ] Studio deep link URLs correct with and without `ROUTING_PATH_BASE`
- [ ] Cross-shop CTA resolver isolation

## Per-slice test expectations

| Slice | Minimum tests |
|-------|---------------|
| 1 | Migration apply; UNIQUE constraints |
| 2 | Shopify product normalization golden files |
| 3 | OAuth HMAC; encrypted token roundtrip; expiring token refresh + reauth |
| 4 | Tenant link authorized/unauthorized |
| 5 | Sync idempotency; archived product marking |
| 6 | Mapping CRUD; one-mapping-per-external-product |
| 7 | Launch URL matches dashboard output |
| 8 | Resolver fail-closed cases |
| 9 | Launch event insert + aggregate |
| 10 | Billing state transitions (mock API) |
| 11 | Webhook idempotency replay |
| 12 | E2E checklist script or manual test plan |

## Fixture strategy

Store Shopify API response fixtures under:

```text
lib/commerce/adapters/shopify/__fixtures__/
  product-single.json
  product-list-page.json
  webhook-product-update.json
  webhook-app-uninstalled.json
```

Never commit real shop tokens or PII in fixtures.

## Regression guardrails

After any commerce slice touching shared Studio code:

1. Manual smoke: `/app/dashboard` — Launch Copilot, Edit Copilot, Copy Link
2. Manual smoke: `/app/profile`, `/app/billing`
3. Run `npm run lint` and `npm run build`

Automated E2E for Studio flows is limited today — document manual steps in PR until E2E added.

## Rollback testing

Each slice IMPLEMENTATION-PLAN includes rollback steps. Verify:

- Migration down or table drop does not affect `product`, `tenant`, Stripe tables
- Feature flags or route disable leaves Studio functional
