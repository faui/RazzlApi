# Slice 9B — Embedded Admin UX Gap Review

**App:** Razzl Product Setup Copilot (Shopify embedded, RazzlApi)  
**Purpose:** Original UX recommendations vs Slice 9B delivery — for team review / Slice 9B.1 planning  
**Related:** [`STYLEGUIDE.md`](./STYLEGUIDE.md), [`IMPLEMENTATION-PLAN.md`](./IMPLEMENTATION-PLAN.md)

## What shipped

Polaris + App Bridge shell, connection card, onboarding progress bar, products `IndexTable` (search, sort, kebab menus), CTA settings card (preview, toast), analytics stat cards + EmptyState, sync loader + last-synced timestamp, “+ Add Copilot” primary action.

## Top gaps (intentional or blocked)

1. **No in-app Disconnect** — Studio profile link only; unlink API is Studio/internal-secret today  
2. **CTA On/Off is a button, not a Toggle** — Polaris React has no first-class toggle  
3. **No sticky header, Razzl logo, or section nav** — Shopify-native `Page` per STYLEGUIDE  
4. **Admin CTA preview ≠ theme block styling** — two config surfaces (admin style mode vs theme editor colors)  
5. **No real analytics trends or full product table** — API returns counts only; UI shows top-8 list  
6. **Premium SaaS look deprioritized** — Polaris-native over Linear/Stripe-style custom chrome  

---

## Gaps by section

### Connection
| Rec | Status | Why |
|-----|--------|-----|
| Pulsing green dot | No | Static success indicator; pulsing felt non-Polaris |
| Store favicon avatar | No | Initials only; no favicon URL stored/fetched |
| Subtle border card | Partial | Default Polaris `Card` |
| In-app Disconnect | No | No merchant unlink API; deferred to Studio |

### Onboarding
| Rec | Status | Why |
|-----|--------|-----|
| Custom step circles | Partial | Polaris icons, not custom circles |
| Animated checkmarks | Partial | Light fade/scale only |
| Progress bar, collapse when done | Yes | — |

### Products table
| Rec | Status | Why |
|-----|--------|-----|
| 40×40 thumbnails | Partial | `Thumbnail size="small"`; empty = gray box |
| Outlined “Unmapped” pill | No | No outline `Badge` variant |
| CTA Toggle (green) | No | On/Off `Button` instead |
| Row hover | No | Default IndexTable only |
| `"16 products · 1 mapped"` | Partial | Two badges, not one string |
| Global Refresh button | Partial | Kept for discoverability |
| Kebab menu, search, sort, sync UI | Yes | — |

### CTA settings
| Rec | Status | Why |
|-----|--------|-----|
| Megaphone header icon | Partial | `CursorIcon` only |
| Preview beside dropdown | Partial | Preview below; narrow iframe |
| Icons on open-mode options | No | `Select` doesn’t support rich options |
| Modal open mode | No | API: `new_tab` / `same_tab` only |
| Powered by = Toggle | No | Checkbox (same toggle gap) |
| Full-width Save | Partial | Right-aligned primary |
| Preview = storefront block | Partial | Admin style only; note added |
| Card, swatches, toast, theme steps | Yes | — |

### Analytics
| Rec | Status | Why |
|-----|--------|-----|
| Trend indicators | Partial | Placeholder text; no prior-period API |
| Custom illustration | Partial | Generic Polaris empty image |
| Full clicks table | Partial | Top-8 list instead |
| Circular refresh | Partial | Icon button, not custom circle |
| Stat cards, EmptyState | Yes | — |

### Global
| Rec | Status | Why |
|-----|--------|-----|
| Sticky header + logo | No | STYLEGUIDE: native Shopify admin |
| Section navigation | No | Single scroll; routes deferred |
| 24px spacing | Partial | Polaris tokens (`gap="500"`) |
| IndexTable skeletons | Partial | `SkeletonBodyText` only |
| Linear/Stripe feel | Partial | Intentional Polaris-first |
| No hardcoded hex | Partial | Minor inline styles remain |
| Focus-ring audit | Not done | Polaris defaults only |

---

## Out of scope (Slice 9B)

Billing (Slice 10) · App Bridge session-token auth · Merchant disconnect API · Sub-routes (`/shopify/products`, etc.)

## Slice 9B.1 candidates

**High:** Toggle-style CTA · In-app disconnect + API  
**Medium:** IndexTable skeletons · Side-by-side CTA preview · Razzl logo in title · Full analytics table  
**Low:** Real trends (API) · Section tabs/routes · Razzl EmptyState art  

## Code (RazzlApi)

`app/shopify/` — `shopify-embedded-home.tsx`, `shopify-connection-card.tsx`, `shopify-onboarding-panel.tsx`, `shopify-products-panel.tsx`, `shopify-cta-settings-panel.tsx`, `shopify-launch-analytics-panel.tsx`, `layout.tsx`, `shopify-polaris-provider.tsx`

*Post–Slice 9B. Update when follow-ups land.*
