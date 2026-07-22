# Continue Here — Razzl API

## Current status

**Slice 13 Shopify merchant UX uplift and follow-up audit deployed and live-validated on 2026-07-21.**

The embedded app now separates the three merchant decisions that were previously
hidden in one status dropdown: connect a setup copilot, publish setup help, and
disconnect a copilot. The product board uses explicit controls, plain-language
states, a compact readiness summary, safer destructive copy, per-row loading
locks, and network-failure recovery. Technical `CTA` and `mapping` language is
removed from the active merchant workflow.

One Razzl copilot remains intentionally connectable to multiple Shopify products.
Studio shows the first Shopify title plus `+N other title(s)`, while its tooltip
and accessible label contain every connected title.

The follow-up removes technical OAuth language from the normal first-install
state, renames the product columns to `Razzl Copilot` and `Setup help visibility`,
rebalances appearance and theme-placement settings into full-width sequential
sections, and collapses the customer experience preview by default. A live audit
also found and fixed the `Connected` filter so it includes connected products
whether setup help is hidden or live; `Live on storefront` remains the narrower
subset.

## Deployed revisions

| Surface | Deployed merge commit | Dev ECS revision | Status |
|---|---|---|---|
| Razzl API | `d572f30` | `razzl-dev-api:40` | rollout completed, 1/1 running |
| Studio | `a89d28a` | `razzl-dev-studio:39` | rollout completed, 1/1 running |

The deployed ECR image tags exactly match those merge commits.

## Verification completed

- API tests: 90 passed (24 files)
- API lint: clean
- API production build: passed
- Studio modified-file lint: passed
- Studio production build: passed
- Studio repo-wide lint: still blocked by five unrelated pre-existing errors in
  `lib/3d-asset/*` and `lib/filerobot-crop-geometry.ts`
- API and Studio health endpoints: HTTP 200
- ECS: both services `COMPLETED`, desired 1, running 1, pending 0
- CloudWatch post-deploy error scan: no API or Studio error/exception/failed events
- Signed-in dev-store sync: 10 seen, 10 visible, 2 connected, 1 live
- Mapping lifecycle: same copilot connected to Ashford and Beckett; Beckett
  disconnect reduced Studio to one title; reconnect restored two titles
- Studio indicator: `+1 other title`; accessible label lists both Shopify titles
- Storefront resolver: Ashford visible with label `Setup help` and
  `launchsource=shopify`; Beckett hidden while its setup help is off
- Launch tracking: synthetic dev QA event recorded and analytics total updated
- Appearance settings: unchanged save/read round trip passed; theme-editor deep
  link is available
- Final embedded layout: computed heading position and screenshots confirm the
  Setup help heading/subtitle, full-width appearance controls, horizontal theme
  placement step, and collapsed customer preview
- Final product controls: Connected filter returns the one connected/live product;
  All products restores 10 rows; search, sorting, analytics refresh, appearance
  controls/save, preview show/hide, connection refresh, catalog sync, mapping
  dialog/cancel, and action-menu destinations were exercised
- Final catalog sync: `Sync complete — 10 products processed`; the table remained
  populated with all 10 products and no stale-list warning
- Final CI and deploy workflows: passed; API health returned `{"ok":true}`; ECS
  desired 1, running 1, pending 0; post-deploy CloudWatch error scan was empty

## Remaining optional visual check

All synced dev-store products are drafts. A literal customer storefront rendering
of the theme app block was not published during QA. The resolver, launch URL,
visibility rules, analytics event, configuration save, and theme-editor deep link
were all verified without changing Shopify product publication state.

The first-install connection CTA was not re-exercised on the connected dev store,
because doing so would require uninstalling or revoking a healthy store connection.
Subscription checkout approval, permanent copilot disconnection, and product
publication were intentionally not submitted during the safe-action audit.

Do not store Shopify credentials, session tokens, access tokens, or refresh tokens
in repository files, commands, screenshots, or logs.

## Ownership reminders

- Commerce code and Shopify adapter changes belong in Razzl API.
- Schema migrations and shared ECS Terraform belong in Studio.
- Storefront launch URLs use `launchsource=shopify`.
- Stripe customers do not receive paid Shopify-billed features (OQ-020).
