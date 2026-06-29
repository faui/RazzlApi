import type {
  CommerceBoolean,
  CommerceCtaOpenMode,
  CommerceMappingStatus,
  CommerceTimestamp
} from "./enums";

export type CommerceRazzlProductMappingRow = {
  commerce_razzl_product_mapping_pk: number;
  commerce_platform_connection_fk: number;
  commerce_external_product_fk: number;
  external_product_id: string;
  product_fk: number | null;
  razzl_code_snapshot: string | null;
  product_status_snapshot: string | null;
  launch_url_snapshot: string | null;
  edit_url_snapshot: string | null;
  mapping_status: CommerceMappingStatus;
  storefront_cta_enabled: CommerceBoolean;
  cta_label_override: string | null;
  cta_open_mode_override: CommerceCtaOpenMode | null;
  last_verified_at: CommerceTimestamp | null;
  created_on: CommerceTimestamp;
  updated_on: CommerceTimestamp;
};

export type CommerceRazzlProductMappingInsert = Omit<
  CommerceRazzlProductMappingRow,
  "commerce_razzl_product_mapping_pk" | "created_on" | "updated_on"
> & {
  commerce_razzl_product_mapping_pk?: number;
};

export type CommerceRazzlProductMappingUpdate = Partial<
  Omit<CommerceRazzlProductMappingRow, "commerce_razzl_product_mapping_pk" | "created_on">
>;
