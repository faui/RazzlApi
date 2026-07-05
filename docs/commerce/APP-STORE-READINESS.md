# App Store Readiness Checklist (Slice 12)

**App name:** Razzl Product Setup Copilot  
**Category target:** Store design / product setup (not generic chatbot)  
**Support:** contact@razzl.com  
**Privacy policy:** https://www.razzl.com/privacy-policy (OQ-061; confirm with legal)  
**Terms:** https://www.razzl.com/terms (confirm URL with legal/marketing)

Related: [`SECURITY-COMPLIANCE.md`](./SECURITY-COMPLIANCE.md), [`SHOPIFY-SPEC.md`](./SHOPIFY-SPEC.md), [`SHOPIFY-DEPLOYMENT.md`](./SHOPIFY-DEPLOYMENT.md)

---

## 1. Technical readiness

| Item | Status | Owner / notes |
|------|--------|---------------|
| Embedded admin loads (`/shopify`) | ✅ Built | Slice 9B |
| OAuth install + tenant link | ✅ Built | Slice 4 |
| Product sync + mapping + CTA | ✅ Built | Slices 5–8 |
| Theme app extension (`razzl-setup-help`) | ✅ Built | Slice 8 |
| Launch analytics MVP | ✅ Built | Slice 9 |
| Compliance webhooks | ✅ Built | Slice 11 |
| Shopify Billing (`appSubscriptionCreate`) | ✅ Built | Slice 10 |
| Webhook URIs absolute HTTPS (not under `/shopify`) | ✅ Fixed | Re-deploy with `shopify app deploy` |
| `app_subscriptions/update` only (no cancelled topic) | ✅ Fixed | Cancellations via update payload |
| Billing E2E on dev store | ⬜ Pending | See [`SLICE-10-E2E-VALIDATION.md`](./SLICE-10-E2E-VALIDATION.md) |

---

## 2. Shopify Partner configuration

| Item | Status | Action |
|------|--------|--------|
| **Public distribution** enabled | ⬜ Verify | Required for Billing API on dev stores |
| **Manual pricing** (not managed) | ⬜ Verify | Managed pricing blocks `appSubscriptionCreate` |
| App URL matches deploy env | ⬜ Dev | `https://api-dev.razzl.com/shopify` |
| Redirect URL exact match | ⬜ Dev | `.../api/commerce/shopify/auth/callback` |
| Scopes minimal | ✅ | `read_products` only (v1) |
| Scope justification documented | ✅ | [`SECURITY-COMPLIANCE.md`](./SECURITY-COMPLIANCE.md) |
| `shopify app deploy` after webhook URI fix | ⬜ Required | Registers correct webhook URLs |
| Production app + secrets (`prod/shopify/razzl_api`) | ⬜ Before listing | Separate from dev Client ID |

### Production `shopify.app.toml` (before public listing)

Create `shopify.app.prod.toml` (or update deploy target) with:

- `application_url = "https://api.razzl.com/shopify"`
- Webhook `uri = "https://api.razzl.com/api/commerce/shopify/webhooks"`
- OAuth redirect `https://api.razzl.com/api/commerce/shopify/auth/callback`

---

## 3. App Store listing (Partner Dashboard submission form)

| Field | Draft content | Status |
|-------|---------------|--------|
| **App name** | Razzl Product Setup Copilot | ⬜ Enter |
| **Tagline** | AI setup help on your Shopify product pages | ⬜ Enter |
| **Detailed description** | See [Listing copy](#listing-copy-draft) below | ⬜ Enter |
| **Search keywords** | product setup, assembly help, installation guide, copilot, customer support | ⬜ Enter |
| **Primary category** | Store design / Customer support (pick closest fit) | ⬜ Select |
| **Online Store required** | Yes — theme app block on product pages | ⬜ Select |
| **Pricing** | Mirror www.razzl.com tiers via Shopify Billing | ⬜ Configure in Partner |
| **Privacy policy URL** | https://www.razzl.com/privacy-policy | ⬜ Enter |
| **Terms of service URL** | https://www.razzl.com/terms | ⬜ Confirm URL |
| **Support email** | contact@razzl.com | ⬜ Enter |
| **Demo store URL** | ⬜ TBD | Merchant-facing demo with block enabled |
| **Screenshots (min 3)** | ⬜ Capture | Embedded admin + theme block + copilot |
| **Optional video** | ⬜ Capture | 30–60s install → map → CTA flow |

### Listing copy (draft)

**Short:** Connect Razzl to Shopify, map products to AI setup copilots, and add a product-page CTA so customers get step-by-step assembly and installation help.

**Long:**

- Install the app and link your Razzl Studio account.
- Sync Shopify products and map each product to a published Razzl copilot (from PDF guides or templates).
- Enable the **Razzl Setup Help** theme app block on product pages.
- Customers tap the CTA to open conversational setup help — no account required for shoppers.
- Billing through Shopify for merchants who join via the App Store; existing Razzl Studio (Stripe) customers can link stores without duplicate billing (OQ-020).

**Do not claim:** generic chatbot, order tracking, customer data access, or features not in v1.

---

## 4. Demo store setup

| Step | Status |
|------|--------|
| Dev/prod store with 3+ products | ⬜ |
| At least one product mapped + copilot published | ⬜ |
| Theme app block added to product template | ⬜ |
| CTA visible on live product page (mapped + active) | ⬜ |
| Sample launch URL works (`launchsource=shopify`) | ⬜ |
| Billing active or trial documented for reviewers | ⬜ |

Theme editor deep link (from embedded CTA settings): add **Razzl Setup Help** block under Apps on product template.

---

## 5. Security & compliance

| Item | Status | Reference |
|------|--------|-----------|
| OAuth HMAC tests | ✅ | Slice 3 |
| Webhook HMAC + idempotency | ✅ | Slice 11 |
| No customer/order scopes | ✅ | `read_products` only |
| Compliance webhooks ack | ✅ | Slice 11 |
| Privacy policy linked | ⬜ Listing + optional in-app footer |
| Uninstall token cleanup | ✅ | `app/uninstalled` |
| Off-platform billing policy | ✅ | Shopify lane only for App Store charges |

---

## 6. UI polish (Slice 12 scope)

| Item | Status | Notes |
|------|--------|-------|
| Support + privacy links in embedded footer | ⬜ This slice | `shopify-app-footer.tsx` |
| Billing panel copy reviewed | ✅ | Slice 10 |
| Error states for billing gate | ✅ | Products panel + API 402 |
| App name consistent (TOML = listing) | ⬜ Verify at submit |

---

## 7. Pre-submission test plan

Run before clicking **Submit for review**:

1. Fresh install on clean dev store → OAuth → link Studio → sync → map → enable CTA → theme block → storefront click → launch event.
2. Shopify Billing: select plan → approve → map succeeds.
3. Uninstall → connection `uninstalled`, CTA hidden.
4. Compliance webhook test from Partner Dashboard (or Shopify CLI).
5. Studio regression: dashboard Launch/Edit Copilot, `/app/billing`, `/app/subscription`.
6. `npm run lint` + `npm run test:commerce` in RazzlApi.
7. `node scripts/slice-10-e2e-smoke.mjs YOUR-STORE.myshopify.com`

---

## 8. Open items before submit

| ID | Item |
|----|------|
| OQ-061 | Confirm privacy URL (`/privacy-policy` vs `/privacy`) |
| OQ-020 | Legal sign-off on Stripe vs Shopify lane policy text in listing |
| OQ-021 | Finance sign-off on Shopify tier prices vs Stripe parity |
| — | Production terraform + `prod/shopify/razzl_api` secret |
| — | Screenshot/video assets |
| — | Demo store URL for listing |

---

## 9. Submission workflow

1. Complete checklist above (all ✅ or documented exceptions).
2. `shopify app deploy` on production app config.
3. Partner Dashboard → **App Store listing** → fill all fields.
4. **Submit for review**.
5. Monitor review feedback; respond within SLA.

---

## References

- [Shopify App Store requirements](https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements)
- [App Store best practices](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices)
- [Privacy requirements](https://shopify.dev/docs/apps/launch/privacy-requirements)
