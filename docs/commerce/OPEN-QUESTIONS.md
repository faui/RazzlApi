# Commerce Integration — Open Questions

**Status:** All Slice 0 questions resolved (2026-06-28)  
**Rule:** Add new questions here rather than guessing. Move rows to **Resolved archive** when superseded.

---

## Studio integration

| ID | Question | Context | Owner | Answer |
|----|----------|---------|-------|--------|
| OQ-001 | Is `master_product_status.status_code = 'active'` sufficient to gate storefront CTA as "published"? | No separate publish flag found in schema | Product / Engineering | **Yes for now.** A formal product state machine may come later once we have more brand experience. At current scale, `active` is sufficient for CTA gating. |
| OQ-002 | What are the canonical accepted `launchsource` query param values for ChatKit analytics? | Dashboard uses `launchfromauthor`, `url`, `qrcode` | Chat team | Shopify storefront CTA and commerce paths use **`shopify`** as the `launchsource` value. |
| OQ-003 | Should commerce use `chatKitBaseUrl` from `master_app_config` at runtime for CTA resolver, or a separate public config endpoint? | Resolver may run outside merchant session | Engineering | **Use `chatKitBaseUrl` from `master_app_config` at runtime.** Database access is restricted to api, studio, and chat Fargate services only. |
| OQ-004 | Should dashboard Edit Copilot fix (`withBasePath`) be included in Slice 7 or a separate Studio bugfix PR? | Known base path inconsistency in `dashboard/page.tsx` | Engineering | **Defer.** Do not fix unless it blocks commerce or other Studio work. |
| OQ-005 | Is there an existing machine-to-machine API for reading tenant products without browser session? | Shopify sync/status may need server-side Studio reads | Engineering | **No.** Product creation also requires an assembly guide PDF. Commerce/API slices must add server-side product read APIs as needed (Slice 7+). |

---

## Auth and deep links

| ID | Question | Context | Owner | Answer |
|----|----------|---------|-------|--------|
| OQ-010 | How should Shopify embedded app authenticate merchants opening Studio deep links? | Studio uses `razzl_session` cookie; Shopify uses different session | Engineering | **Use standard Studio login (`razzl_session`) for deep links** to stay consistent with Razzl auth. Merchant opens Studio in a new tab and logs in if needed. **Downside:** extra login step when Studio session expired; acceptable for MVP. Revisit only if merchant friction or Shopify best-practice review requires embedded SSO. |
| OQ-011 | Should account linking use OAuth state parameter, one-time token, or email verification? | Security vs friction | Engineering / Security | **Bias toward lower friction** at current scale: OAuth state for install callback plus short-lived one-time link token for account linking confirmation. |
| OQ-012 | Can one Razzl tenant connect multiple Shopify stores? | Schema allows multiple connections per tenant | Product | **One Razzl tenant per Shopify store (1:1).** Schema allows multiple connections per tenant for future flexibility, but product policy is one store per tenant to keep billing, mapping, and support simple. |
| OQ-013 | Can one Shopify store link to multiple Razzl tenants? | Should be prevented | Product | **Must be prevented.** Enforced by UNIQUE `(platform_type, external_store_id)` on `commerce_platform_connection`. |

---

## Billing and App Store policy

| ID | Question | Context | Owner | Answer |
|----|----------|---------|-------|--------|
| OQ-020 | Can existing Stripe customers use paid Shopify connector features without Shopify Billing on public App Store listing? | Shopify policy vs revenue leakage | Legal / Product | **No paid Shopify features for Stripe-acquired customers.** Hard separation: Stripe lane vs Shopify App Store lane. Stripe customers may install connector for discovery/linking only if policy allows, but **no paid Shopify-billed features without Shopify acquisition billing.** |
| OQ-021 | What Shopify App Pricing tiers and prices account for revenue share and processing fees? | Pricing not defined | Product / Finance | **Mirror www.razzl.com tier structure** with chat-session entitlements enforced in Razzl (same entitlement engine). Model Shopify plans to map to equivalent session/product limits. Document tier mapping in Slice 10. Include admin-configurable free trial (see OQ-022). |
| OQ-022 | Is a free tier required for App Store listing, or trial-only? | Affects Slice 10 gating | Product | **Yes — free trial tier:** default **1 week**, **1 product**. Must be **admin-configurable** (on/off, duration, product count) via `commerce_billing_account.trial_*` columns. |
| OQ-023 | How do `tenant_subscription` (Stripe) and `commerce_billing_account` (Shopify) interact for entitlements? | Parallel billing records | Engineering | **Parallel billing lanes.** Stripe → `tenant_subscription`; Shopify → `commerce_billing_account`. **Entitlement enforcement is shared** in Razzl (single engine reads effective limits from the active billing source for the feature context). |

---

## Architecture and deployment

| ID | Question | Context | Owner | Answer |
|----|----------|---------|-------|--------|
| OQ-030 | Host Shopify embedded app inside Studio Next.js or separate deployable? | OAuth, scaling, team boundaries | Engineering | **`api.razzl.com` is a separate Fargate service and separate repo ([RazzlApi](https://github.com/faui/RazzlApi.git)).** Commerce core, Shopify adapter, webhooks, CTA resolver, and embedded admin API live in API repo. Studio remains authoring/billing UI. Same ECS cluster/VPC as studio and chat — latency is not a concern. Separate AWS service cost is acceptable. See [`API-REPO.md`](./API-REPO.md). |
| OQ-031 | Should public CTA resolver live on Studio, Chat, or API service? | Latency, caching, security | Engineering | **`api.razzl.com`** (RazzlApi service). |
| OQ-032 | Token encryption: app-level AES key vs AWS KMS vs Secrets Manager pattern? | Security conventions | Security | **Follow existing repo secrets conventions** (Secrets Manager for keys; same pattern as Studio/Chat). |
| OQ-033 | GraphQL vs REST for Shopify Admin product API? | Slice 5 implementation | Engineering | **Prefer REST** to avoid introducing GraphQL as a new stack component. Shopify REST Products API is sufficient for catalog import MVP. Revisit GraphQL only if REST pagination/rate limits block scale. |

---

## Data model

| ID | Question | Context | Owner | Answer |
|----|----------|---------|-------|--------|
| OQ-040 | Per-product CTA override: column on mapping vs JSON in `commerce_storefront_cta_config`? | Slice 6/8 design | Engineering | **Structured columns** for predictable fields (`storefront_cta_enabled`, `cta_label_override`, `cta_open_mode_override` on mapping). **`settings_json`** for extensibility and future platforms. |
| OQ-041 | On tenant delete, cascade or preserve commerce connection audit rows? | FK policy | Engineering / Legal | **Preserve audit rows.** `commerce_platform_connection.tenant_fk` uses ON DELETE SET NULL. Do not CASCADE-delete commerce history. Anonymize on uninstall/compliance (OQ-060). |
| OQ-042 | Snapshot fields on mapping: required for MVP or live-only reads? | Staleness vs performance | Engineering | **Live-only reads for MVP.** Prioritize performance and simplicity; merchants get a **manual refresh** path. Snapshot columns exist in schema for optional future caching but are not required for MVP logic. |
| OQ-043 | Variant-level mapping needed for MVP, or product-level only? | SKU-level merchants | Product | **Product-level mapping only for MVP.** Variant rows synced for catalog context; mapping is at external product level. |

---

## Storefront and CTA

| ID | Question | Context | Owner | Answer |
|----|----------|---------|-------|--------|
| OQ-050 | Signed launch URL parameters required for MVP, or plain `razzl_code` sufficient? | Security vs simplicity | Security / Product | **`razzl_code` sufficient for MVP.** Signed launch parameters are **post-MVP** — track in [`NEXT-RELEASE-FEATURES.md`](../../NEXT-RELEASE-FEATURES.md). |
| OQ-051 | CTA impression tracking feasible without performance impact? | Slice 9 scope | Engineering | **Leverage existing `chat_session` / turn tracking** for session value. Optional lightweight CTA click event in Slice 9; do not duplicate full analytics pipeline in Shopify admin. |
| OQ-052 | Which Shopify themes must be tested for app block compatibility? | QA matrix for Slice 12 | QA | **Priority themes:** Dawn (baseline OS 2.0), Craft, Capital, Stockholm, Stiletto. **Scenarios:** variant selector updates, quick-view modals, accordion/tab placement, mobile keyboard shift, expanding copilot answers, inline media in chat block. Document full matrix in Slice 12 QA checklist. |

---

## Compliance

| ID | Question | Context | Owner | Answer |
|----|----------|---------|-------|--------|
| OQ-060 | Data retention policy on uninstall — delete all commerce rows or anonymize? | GDPR / Shopify compliance | Legal | **Anonymize** shop/token PII; retain anonymized audit/sync statistics per legal policy. |
| OQ-061 | Privacy policy URL for App Store listing — existing or new? | App Store requirement | Legal / Marketing | **Use https://www.razzl.com/privacy** unless legal requires a Shopify-specific addendum page. |

---

## Resolved archive

All questions above were resolved on **2026-06-28** during Slice 0 architecture review. New questions use the next available OQ-XXX ID.

When superseding a decision, add a row here:

```text
| OQ-XXX | Original question | New decision | Date |
```
