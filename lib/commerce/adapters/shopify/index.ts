import {
  CommerceAdapterError,
  type CommercePlatformAdapter,
  type CtaPlacementInstructions,
  type CtaPlacementInstructionsInput,
  type ExchangeAuthCodeInput,
  type FetchProductByIdInput,
  type FetchProductsInput,
  type NormalizeWebhookInput,
  type ValidateConnectionInput,
  type VerifyWebhookSignatureInput
} from "@/lib/commerce/adapters/types";
import { normalizeShopifyWebhook, verifyShopifyWebhookSignature } from "@/lib/commerce/adapters/shopify/webhooks";
import { exchangeShopifyAuthCode } from "@/lib/commerce/adapters/shopify/oauth";

function notImplemented(method: string): never {
  throw new CommerceAdapterError("NOT_IMPLEMENTED", `${method} is not implemented yet`);
}

export const shopifyAdapter: CommercePlatformAdapter = {
  platformType: "shopify",

  async validateConnection(input: ValidateConnectionInput) {
    void input.context.connectionId;
    notImplemented("validateConnection");
  },

  async exchangeAuthCode(input: ExchangeAuthCodeInput) {
    return exchangeShopifyAuthCode({
      shopDomain: input.context.storeDomain,
      authCode: input.authCode
    });
  },

  async fetchProducts(input: FetchProductsInput) {
    void input.context.connectionId;
    notImplemented("fetchProducts");
  },

  async fetchProductById(input: FetchProductByIdInput) {
    void input.externalProductId;
    notImplemented("fetchProductById");
  },

  async registerWebhooks() {
    notImplemented("registerWebhooks");
  },

  async verifyWebhookSignature(input: VerifyWebhookSignatureInput): Promise<boolean> {
    return verifyShopifyWebhookSignature(
      input.rawBody,
      input.webhookSecret,
      input.signatureHeader
    );
  },

  async normalizeWebhook(input: NormalizeWebhookInput) {
    return normalizeShopifyWebhook(input.topic, input.rawBody);
  },

  async getBillingStatus() {
    notImplemented("getBillingStatus");
  },

  async createBillingSession() {
    notImplemented("createBillingSession");
  },

  async getStorefrontCtaPlacementInstructions(
    input: CtaPlacementInstructionsInput
  ): Promise<CtaPlacementInstructions> {
    const shop = input.context.storeDomain.replace(/\.myshopify\.com$/i, "");
    return {
      placementType: "theme_app_block",
      title: "Add Razzl Setup Help to your product page",
      steps: [
        "Open the Shopify theme editor for your live theme.",
        "Navigate to a product template (e.g. Default product).",
        "Click Add block and choose Razzl Setup Help under Apps.",
        "Save the theme. The block appears only for mapped, published copilots."
      ],
      deepLinkUrl: `https://${shop}.myshopify.com/admin/themes/current/editor?context=apps`
    };
  }
};
