# Commerce Platform Adapter Contract

**Status:** Slice 0 — interface design; **implementation in RazzlApi repo**  
**Location:** `RazzlApi/lib/commerce/adapters/` (not Studio)

## Purpose

Define a **thin adapter interface** that isolates platform-specific auth, catalog APIs, webhooks, billing, and storefront mechanics from Razzl's generic commerce workflow.

Adapters **normalize outward** to Razzl commerce types. They do not contain Studio product/copilot business logic.

## Platform types

```typescript
export type CommercePlatformType =
  | "shopify"
  | "woocommerce"
  | "bigcommerce"
  | "magento"
  | "custom"
  | "manual";
```

Only `shopify` is implemented initially.

## Normalized types (summary)

```typescript
export type NormalizedCommerceProduct = {
  externalProductId: string;
  externalHandle: string | null;
  title: string;
  vendorOrBrand: string | null;
  productType: string | null;
  status: string;
  primaryImageUrl: string | null;
  tags: string[];
  variants: NormalizedCommerceVariant[];
  rawPayload: unknown;
};

export type NormalizedCommerceVariant = {
  externalVariantId: string;
  externalProductId: string;
  title: string | null;
  sku: string | null;
  barcode: string | null;
  status: string | null;
  optionValues: Record<string, string>;
  rawPayload: unknown;
};

export type NormalizedCommerceEvent = {
  eventType: string;
  externalEventId: string | null;
  idempotencyKey: string;
  externalProductId?: string;
  payload: unknown;
};

export type ConnectionValidationResult = {
  valid: boolean;
  storeDisplayName?: string;
  externalStoreId?: string;
  scopes?: string[];
  errorCode?: string;
  errorMessage?: string;
};

export type PlatformBillingStatus = {
  status: "not_required" | "pending" | "active" | "cancelled" | "failed";
  planExternalId?: string;
  chargeId?: string;
  subscriptionId?: string;
  rawPayload?: unknown;
};
```

Full types to be added in `lib/commerce/types/` during Slice 2.

## Adapter interface

```typescript
export interface CommercePlatformAdapter {
  readonly platformType: CommercePlatformType;

  /** Validate stored credentials / connection health */
  validateConnection(input: ValidateConnectionInput): Promise<ConnectionValidationResult>;

  /** OAuth code exchange — optional for API-key platforms */
  exchangeAuthCode?(input: ExchangeAuthCodeInput): Promise<AuthResult>;

  /** Paginated product import */
  fetchProducts(input: FetchProductsInput): Promise<NormalizedCommerceProductPage>;

  /** Single product fetch (webhook follow-up) */
  fetchProductById(input: FetchProductByIdInput): Promise<NormalizedCommerceProduct | null>;

  /** Register platform webhooks after install */
  registerWebhooks?(input: RegisterWebhooksInput): Promise<WebhookRegistrationResult>;

  /** Verify webhook authenticity (HMAC, signature header, etc.) */
  verifyWebhookSignature(input: VerifyWebhookSignatureInput): Promise<boolean>;

  /** Map raw webhook to normalized event */
  normalizeWebhook(input: NormalizeWebhookInput): Promise<NormalizedCommerceEvent>;

  /** Read platform billing state */
  getBillingStatus?(input: GetBillingStatusInput): Promise<PlatformBillingStatus>;

  /** Create billing acceptance session (Shopify Billing API) */
  createBillingSession?(input: CreateBillingSessionInput): Promise<PlatformBillingSession>;

  /** Instructions for merchant CTA placement (theme block, shortcode, script) */
  getStorefrontCtaPlacementInstructions(
    input: CtaPlacementInstructionsInput
  ): Promise<CtaPlacementInstructions>;
}
```

## Method scope rules

| Method | Required for Shopify | Notes |
|--------|---------------------|-------|
| `validateConnection` | Yes | Token + shop domain |
| `exchangeAuthCode` | Yes | OAuth install |
| `fetchProducts` | Yes | Admin API catalog |
| `fetchProductById` | Yes | Incremental sync |
| `registerWebhooks` | Yes (Slice 11) | Product update, uninstall, compliance |
| `verifyWebhookSignature` | Yes | HMAC-SHA256 |
| `normalizeWebhook` | Yes | Event log pipeline |
| `getBillingStatus` | Yes (Slice 10) | App Pricing |
| `createBillingSession` | Yes (Slice 10) | Plan acceptance |
| `getStorefrontCtaPlacementInstructions` | Yes | Theme app extension docs |

**Do not add** order/customer sync, inventory, fulfillment, or discount methods unless a future ADR approves.

## Input context (all methods)

Adapters receive a `CommerceAdapterContext`:

```typescript
export type CommerceAdapterContext = {
  connectionId: number;
  tenantId: number | null;
  externalStoreId: string;
  storeDomain: string;
  accessToken: string; // decrypted by core layer, never logged
  scopes: string[];
};
```

Core layer decrypts tokens and passes plaintext to adapter in-process only.

## CTA placement instructions

Returns merchant-facing setup guidance without implementing storefront UI in adapter:

```typescript
export type CtaPlacementInstructions = {
  placementType: "theme_app_block" | "script_tag" | "shortcode" | "manual";
  title: string;
  steps: string[];
  deepLinkUrl?: string; // Theme editor deep link if platform supports
};
```

Shopify returns theme app extension / app block instructions. WooCommerce might return shortcode instructions later.

## Error handling

Adapters throw typed errors:

```typescript
export class CommerceAdapterError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean = false,
    public raw?: unknown
  ) {
    super(message);
  }
}
```

Core layer maps to `commerce_platform_sync_run.error_code` / event log.

## Registration pattern

```typescript
// lib/commerce/adapters/registry.ts (Slice 2)
export function getAdapter(platformType: CommercePlatformType): CommercePlatformAdapter {
  switch (platformType) {
    case "shopify":
      return shopifyAdapter;
    default:
      throw new Error(`Unsupported platform: ${platformType}`);
  }
}
```

## Testing contract

Each adapter method must have:

- Unit tests with **fixture JSON** from platform API docs
- Webhook signature tests (valid, invalid, replay)
- Normalization golden tests (Shopify product → `NormalizedCommerceProduct`)

See [`TESTING.md`](./TESTING.md).

## What adapters must NOT do

- Create/update Razzl `product` rows directly without commerce core orchestration
- Store Studio `guide_json` or copilot content
- Implement Stripe billing
- Render Studio UI
- Bypass commerce core for DB writes

## Related documents

- [`SHOPIFY-SPEC.md`](./SHOPIFY-SPEC.md) — Shopify adapter implementation details
- [`DATA-MODEL.md`](./DATA-MODEL.md) — persistence layer
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system boundaries
