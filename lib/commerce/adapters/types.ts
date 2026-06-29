import type { CommercePlatformType } from "@/lib/commerce/types/enums";

/** Decrypted connection context passed to every adapter method. */
export type CommerceAdapterContext = {
  connectionId: number;
  tenantId: number | null;
  externalStoreId: string;
  storeDomain: string;
  accessToken: string;
  scopes: string[];
};

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

export type CtaPlacementInstructions = {
  placementType: "theme_app_block" | "script_tag" | "shortcode" | "manual";
  title: string;
  steps: string[];
  deepLinkUrl?: string;
};

export type NormalizedCommerceProductPage = {
  products: NormalizedCommerceProduct[];
  nextPageCursor: string | null;
};

export type AuthResult = {
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  externalStoreId: string;
  storeDomain: string;
  storeDisplayName?: string | null;
  rawPayload?: unknown;
};

export type WebhookRegistrationResult = {
  registeredTopics: string[];
  rawPayload?: unknown;
};

export type PlatformBillingSession = {
  confirmationUrl: string;
  chargeId?: string;
  rawPayload?: unknown;
};

export type ValidateConnectionInput = {
  context: CommerceAdapterContext;
};

export type ExchangeAuthCodeInput = {
  context: CommerceAdapterContext;
  authCode: string;
  redirectUri: string;
};

export type FetchProductsInput = {
  context: CommerceAdapterContext;
  pageCursor?: string | null;
  pageSize?: number;
};

export type FetchProductByIdInput = {
  context: CommerceAdapterContext;
  externalProductId: string;
};

export type RegisterWebhooksInput = {
  context: CommerceAdapterContext;
  callbackBaseUrl: string;
  topics: string[];
};

export type VerifyWebhookSignatureInput = {
  context: CommerceAdapterContext;
  rawBody: string | Buffer;
  signatureHeader: string;
  webhookSecret: string;
};

export type NormalizeWebhookInput = {
  context: CommerceAdapterContext;
  topic: string;
  rawBody: string;
  headers: Record<string, string>;
};

export type GetBillingStatusInput = {
  context: CommerceAdapterContext;
};

export type CreateBillingSessionInput = {
  context: CommerceAdapterContext;
  planExternalId: string;
  returnUrl: string;
  test?: boolean;
};

export type CtaPlacementInstructionsInput = {
  context: CommerceAdapterContext;
};

export class CommerceAdapterError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean = false,
    public raw?: unknown
  ) {
    super(message);
    this.name = "CommerceAdapterError";
  }
}

export interface CommercePlatformAdapter {
  readonly platformType: CommercePlatformType;

  validateConnection(input: ValidateConnectionInput): Promise<ConnectionValidationResult>;

  exchangeAuthCode?(input: ExchangeAuthCodeInput): Promise<AuthResult>;

  fetchProducts(input: FetchProductsInput): Promise<NormalizedCommerceProductPage>;

  fetchProductById(input: FetchProductByIdInput): Promise<NormalizedCommerceProduct | null>;

  registerWebhooks?(input: RegisterWebhooksInput): Promise<WebhookRegistrationResult>;

  verifyWebhookSignature(input: VerifyWebhookSignatureInput): Promise<boolean>;

  normalizeWebhook(input: NormalizeWebhookInput): Promise<NormalizedCommerceEvent>;

  getBillingStatus?(input: GetBillingStatusInput): Promise<PlatformBillingStatus>;

  createBillingSession?(input: CreateBillingSessionInput): Promise<PlatformBillingSession>;

  getStorefrontCtaPlacementInstructions(
    input: CtaPlacementInstructionsInput
  ): Promise<CtaPlacementInstructions>;
}
