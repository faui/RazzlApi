# Continue Here — Razzl API

## Current status

**Slice 11 implemented** — Shopify webhooks (HMAC, idempotency, product sync, uninstall, compliance acks). Commerce docs consolidated under `docs/commerce/`.

## Current branch

Merge to `main` and deploy api-dev. Re-run OAuth or `shopify app deploy` to register webhook subscriptions.

## Last completed slice

**Slice 11** — webhook route, event processor, platform event repo, OAuth webhook registration, `shopify.app.toml` subscriptions

## Next slice

**Slice 10** — Shopify Billing / App Pricing

## Exact next steps

1. Push to `main` — confirm `Deploy API to Dev` succeeds
2. Deploy Shopify app config: `shopify app deploy` from `api/` (webhook URIs)
3. Trigger test webhook from Shopify admin or reinstall app on dev store
4. Validate `commerce_platform_event` rows and product incremental updates
5. Start Slice 10 when billing policy confirmed (see OPEN-QUESTIONS.md OQ-020)

## Files changed (Slice 11)

| Path | Purpose |
|------|---------|
| `app/api/commerce/shopify/webhooks/route.ts` | Webhook receiver (raw body + HMAC) |
| `lib/commerce/core/events/platform-event-repo.ts` | Idempotent event log |
| `lib/commerce/core/events/webhook-processor-service.ts` | Dispatch + compliance |
| `lib/commerce/adapters/shopify/webhook-register.ts` | REST webhook registration |
| `lib/commerce/core/sync/sync-service.ts` | `applyWebhookProductEvent` |
| `lib/commerce/core/connections/platform-connection-repo.ts` | `markShopUninstalled` |
| `shopify.app.toml` | Webhook subscription URIs |

## Files changed (doc consolidation)

| Path | Purpose |
|------|---------|
| `docs/commerce/*` | Authoritative commerce docs (moved from Studio) |
| `AGENTS.md` | Points to `docs/commerce/` |

## Validation status

- [ ] api-dev deployed with Slice 11
- [ ] Webhook delivery 200 from Shopify
- [ ] Duplicate webhook ignored (idempotency)
- [ ] `app/uninstalled` marks connection uninstalled
- [ ] Lint + tests pass locally

## Recommended next Composer prompt

```text
Implement Slice 10: Shopify Billing / App Pricing per IMPLEMENTATION-PLAN.md. Update CONTINUE-HERE.md.
```
