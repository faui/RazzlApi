/** Shared commerce column enums — see studio/docs/commerce/DATA-MODEL.md */

export type CommercePlatformType =
  | "shopify"
  | "woocommerce"
  | "bigcommerce"
  | "magento"
  | "custom"
  | "manual";

export type CommerceInstallStatus =
  | "installed"
  | "connected"
  | "disconnected"
  | "uninstalled"
  | "error";

export type CommerceAuthType = "oauth" | "api_key" | "app_password" | "manual";

export type CommerceAcquisitionSource =
  | "direct"
  | "shopify_app_store"
  | "outbound"
  | "partner"
  | "unknown";

export type CommerceBillingSource =
  | "stripe"
  | "shopify_billing"
  | "platform_billing"
  | "manual"
  | "none";

export type CommercePlatformBillingStatus =
  | "not_required"
  | "pending"
  | "active"
  | "cancelled"
  | "failed";

export type CommerceMappingStatus = "unmapped" | "mapped" | "stale" | "error" | "disabled";

export type CommerceCtaOpenMode = "same_tab" | "new_tab";

export type CommerceCtaStyleMode = "inherit_theme" | "button" | "link" | "badge";

export type CommerceFallbackBehavior = "hide" | "disabled" | "support_link";

export type CommerceSyncType = "full" | "incremental" | "webhook" | "manual";

export type CommerceSyncRunStatus = "running" | "succeeded" | "failed" | "partial";

export type CommerceEventProcessingStatus = "pending" | "processed" | "ignored" | "failed";

/** MySQL timestamp columns as returned by mysql2. */
export type CommerceTimestamp = Date | string;

/** MySQL tinyint(1) boolean columns. */
export type CommerceBoolean = 0 | 1 | boolean;

export const COMMERCE_TABLES = {
  platformConnection: "commerce_platform_connection",
  externalProduct: "commerce_external_product",
  externalVariant: "commerce_external_variant",
  razzlProductMapping: "commerce_razzl_product_mapping",
  storefrontCtaConfig: "commerce_storefront_cta_config",
  platformSyncRun: "commerce_platform_sync_run",
  platformEvent: "commerce_platform_event",
  billingAccount: "commerce_billing_account"
} as const;

export type CommerceTableName = (typeof COMMERCE_TABLES)[keyof typeof COMMERCE_TABLES];
