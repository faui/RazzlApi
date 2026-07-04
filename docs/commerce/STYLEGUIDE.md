# Commerce Integration Style Guide

**Status:** Slice 0  
**Applies to:** Shopify embedded admin UI, storefront CTA, and deep-link labeling

## Three visual contexts

| Context | Style rule |
|---------|------------|
| **Shopify embedded admin** | Native to Shopify admin (Polaris); Razzl brand as accent only |
| **Razzl Studio** | Existing Studio styles unchanged — do not modify for Shopify |
| **Storefront CTA** | Inherit merchant theme; minimal Razzl branding |

## Shopify admin principles

1. **Clear boundary** — Always distinguish "Shopify connector" from "Razzl Studio". Never imply the full product lives in Shopify.
2. **Deep links over duplication** — Primary authoring actions open Studio in a new tab.
3. **Simple onboarding checklist** — Install → Connect account → Sync → Map → Enable CTA.
4. **Status at a glance** — Badges for mapping and copilot state.
5. **Fail closed** — No broken CTAs, no empty launch URLs, no confusing partial states.
6. **Merchant-friendly copy** — Avoid internal IDs in default views.

## Relationship to Studio styles

| Element | Shopify admin | Studio |
|---------|---------------|--------|
| Component library | Shopify Polaris | shadcn/ui + Tailwind |
| Primary color | Polaris default + Razzl accent where allowed | `#0074FF` / HSL primary |
| Typography | Polaris | Studio system font stack |
| Icons | Polaris icons | lucide-react |

Do not port shadcn components into Shopify embedded app. Do not port Polaris into Studio.

## Product mapping table layout

### Columns

| Column | Width priority | Content |
|--------|----------------|---------|
| Commerce product | High | Title + thumbnail from Shopify |
| Razzl product | High | Mapped name or "—" |
| Copilot status | Medium | Badge |
| CTA | Narrow | On/Off toggle or badge |
| Actions | Medium | Overflow menu |

### Row states

| State | Visual |
|-------|--------|
| Unmapped | Neutral row; primary action "Create in Razzl Studio" or "Map product" |
| Mapped, draft/in-progress | Warning badge; Edit in Studio emphasized |
| Mapped, published | Success badge; Enable CTA emphasized |
| Stale | Subtle warning icon + "Refresh status" |
| Error | Critical badge + inline error message |

### Actions menu (consistent order)

1. Launch Copilot (if launchable)
2. Edit Copilot in Studio
3. Map / Change mapping
4. Enable / Disable CTA
5. Resync product
6. Open in Razzl Studio

## Status badges

| Badge | Color (Polaris tone) | When |
|-------|---------------------|------|
| Unmapped | Subdued | No Razzl product linked |
| Draft | Warning | Razzl product not launchable |
| Processing | Info | `in-progress` |
| Published | Success | Launchable copilot |
| CTA On | Success | Storefront CTA enabled |
| CTA Off | Subdued | CTA disabled |
| Error | Critical | Sync or mapping error |
| Stale | Warning | Snapshot needs refresh |

Map Studio `status_code` values per [`STUDIO-CONTRACT.md`](./STUDIO-CONTRACT.md).

## CTA setup screen

### Sections

1. **Defaults** — Label, open mode, style mode
2. **Theme block** — Instructions to add app block to product template
3. **Per-product overrides** — Link to Products table (not duplicate full editor)

### Fields

| Field | Default | Options |
|-------|---------|---------|
| Default label | Setup help | Assembly help, Installation help, Ask setup copilot, Product setup help |
| Open mode | new_tab | same_tab, new_tab |
| Style mode | inherit_theme | inherit_theme, button, link, badge |
| Show "Powered by Razzl" | Off | On/Off |
| Fallback when unmapped | hide | hide, disabled, support_link |

## Empty states

| Screen | Heading | Body | Primary action |
|--------|---------|------|----------------|
| Products (pre-sync) | No products imported yet | Import your Shopify products, then connect them to Razzl copilots. | Sync products |
| Products (post-sync, no mappings) | Connect products to Razzl | Map Shopify products to copilots you've created in Razzl Studio. | Create in Razzl Studio |
| Analytics | No launch data yet | Enable the product-page CTA to start tracking setup help usage. | CTA Settings |
| Onboarding | Welcome to Razzl | Add AI setup help to your Shopify product pages. | Connect Razzl account |

## Error states

| Scenario | Message pattern | Recovery action |
|----------|-----------------|-----------------|
| OAuth failed | We couldn't connect your Shopify store. | Try again |
| Sync failed | Product sync failed. {short reason} | Retry sync |
| Studio unreachable | Razzl Studio is temporarily unavailable. | Retry / Status page |
| Mapping stale | Copilot status may be outdated. | Refresh status |
| Billing required | Accept a plan to enable product mapping and CTA. | View plans |
| Token revoked | Shopify connection expired. | Reinstall / Reauthorize |

Never expose stack traces or token values.

## Button / label terminology

| Use | Avoid |
|-----|-------|
| Open in Razzl Studio | Open dashboard |
| Edit Copilot | Edit product |
| Launch Copilot | Open chat |
| Create in Razzl Studio | Add product here |
| Setup help (CTA default) | Chat now, AI assistant |
| Sync products | Import catalog |
| Enable product-page CTA | Turn on widget |
| Map to Razzl product | Link SKU |

## Storefront CTA defaults and rules

### Rendering rules

1. Render **only** on product pages where app block is placed
2. Render **only** if mapping exists and Razzl product is launchable
3. Render **only** if CTA enabled for product (or default on + no override off)
4. Use configured label or default "Setup help"
5. Track click before navigation (Slice 9)

### Visual defaults

- `inherit_theme`: use theme button classes / minimal wrapper
- No fixed Razzl blue on storefront unless merchant chooses `button` style mode
- Mobile-first tap target (min 44px height)
- Optional subtle "Powered by Razzl" below button when enabled

### Accessibility

- Button must have accessible name matching visible label
- `new_tab` opens with `rel="noopener noreferrer"` and screen-reader hint if required by theme

## Copy reference

| Context | Copy |
|---------|------|
| App title | Razzl Product Setup Copilot |
| Tagline | Add AI setup help to your product pages. |
| CTA default | Setup help |
| Support link | contact@razzl.com (from runtime config) |
