# Commerce Integration — Security & Compliance

**Status:** Slice 0 — requirements baseline  
**Applies to:** Commerce Core, Shopify adapter, storefront CTA

## Security requirements

### Secrets and credentials

- Encrypt platform access tokens at rest (`access_token_encrypted`, `refresh_token_encrypted`)
- Never log access tokens, refresh tokens, OAuth codes, HMAC secrets, or webhook raw bodies containing secrets
- Store Shopify API key/secret in ECS Secrets Manager / env — follow `.env.example` pattern
- Do not commit secrets; do not hardcode in source

### Authentication and authorization

- Validate Shopify OAuth callback HMAC
- Validate webhook `X-Shopify-Hmac-Sha256` against raw request body
- Commerce admin APIs require authenticated Shopify session + linked tenant
- Studio APIs continue using `getSessionFromCookies()` — do not bypass tenant scoping
- Public CTA resolver: shop-scoped, rate-limited, no tenant-wide data leakage

### Idempotency

- All webhook processing uses `commerce_platform_event.idempotency_key` UNIQUE constraint
- Duplicate deliveries return 200 without double-applying side effects

### Scope minimization (v1)

- **Do not request** customer, order, or protected customer data scopes
- Product/catalog + app billing scopes only unless ADR approves expansion

### Rate limiting

- Handle Shopify Admin API rate limits (429) with exponential backoff
- Rate limit public CTA resolver by shop domain + IP

### Error logging

- Use structured logging via `traceLog()` / `errorLog()` — redact tokens
- Record sync/webhook errors in `commerce_platform_sync_run` / `commerce_platform_event`

## Privacy requirements

### End customers (storefront)

- **Do not pass** end-customer PII from Shopify to Razzl Chat in MVP
- No purchase history, email, or customer ID in launch URL
- Copilot is free for end customers; setup help does not require identity

### Merchants

- Store only merchant shop metadata and product catalog needed for connector
- Support email from tenant profile already exists in Studio — do not duplicate unnecessarily

### Compliance webhooks (public app — Slice 11)

Implement Shopify mandatory compliance webhooks:

| Webhook | Purpose |
|---------|---------|
| `customers/data_request` | Acknowledge data request |
| `customers/redact` | Redact customer-related data if any stored |
| `shop/redact` | Delete/anonymize shop data after uninstall |

Exact handler behavior subject to legal review — see OQ-060 in OPEN-QUESTIONS.md.

### Uninstall

On `app/uninstalled`:

1. Mark `install_status = uninstalled`, set `uninstalled_at`
2. Revoke/delete access tokens
3. Stop sync and CTA resolution for shop
4. Apply data retention policy (delete vs anonymize)

## App Store review requirements

Prepare before Slice 12 submission:

- [ ] Working embedded admin UI matching listing description
- [ ] Shopify Billing for app charges (Shopify-acquired paid path)
- [ ] Mandatory compliance webhooks
- [ ] Privacy policy URL
- [ ] Terms of service URL
- [ ] Support contact (e.g. contact@razzl.com)
- [ ] Demo store with theme app block
- [ ] Accurate app categorization (setup/product help, not generic chatbot)
- [ ] Minimal justified scopes documented
- [ ] No off-platform billing for App Store-distributed charges (unless Shopify exception)

## Revenue share awareness

- Shopify App Store: 0% on first $1M USD app revenue, then 15% + processing
- Price Shopify plans to preserve margin after threshold
- Do not blend platform fees into direct Stripe pricing silently
- Record `acquisition_source` and `billing_source` for financial reporting

## Terraform / infrastructure

- Do not change production Terraform without explicit slice scope and review
- New secrets (Shopify API credentials) added via existing IaC patterns
- Webhook endpoints must be reachable from Shopify (public HTTPS)

## Security testing (required per slice)

| Slice | Security tests |
|-------|----------------|
| 3 | OAuth HMAC, token encryption |
| 8 | CTA resolver — no unauthorized cross-shop access |
| 10 | Billing session tampering rejected |
| 11 | Webhook HMAC invalid → 401; replay idempotency |

See [`TESTING.md`](./TESTING.md).

## References

- [Shopify protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)
- [Shopify privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)
- [Shopify App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
