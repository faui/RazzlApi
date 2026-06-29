import type {
  CommerceBoolean,
  CommerceCtaOpenMode,
  CommerceCtaStyleMode,
  CommerceFallbackBehavior,
  CommercePlatformType,
  CommerceTimestamp
} from "./enums";

export type CommerceStorefrontCtaConfigRow = {
  commerce_storefront_cta_config_pk: number;
  commerce_platform_connection_fk: number;
  platform_type: CommercePlatformType;
  cta_enabled_default: CommerceBoolean;
  cta_label_default: string;
  cta_open_mode: CommerceCtaOpenMode;
  cta_style_mode: CommerceCtaStyleMode;
  show_powered_by_razzl: CommerceBoolean;
  fallback_behavior: CommerceFallbackBehavior;
  settings_json: unknown | null;
  created_on: CommerceTimestamp;
  updated_on: CommerceTimestamp;
};

export type CommerceStorefrontCtaConfigInsert = Omit<
  CommerceStorefrontCtaConfigRow,
  "commerce_storefront_cta_config_pk" | "created_on" | "updated_on"
> & {
  commerce_storefront_cta_config_pk?: number;
};

export type CommerceStorefrontCtaConfigUpdate = Partial<
  Omit<CommerceStorefrontCtaConfigRow, "commerce_storefront_cta_config_pk" | "created_on">
>;
