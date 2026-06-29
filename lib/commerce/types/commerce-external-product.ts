import type { CommercePlatformType, CommerceTimestamp } from "./enums";

export type CommerceExternalProductRow = {
  commerce_external_product_pk: number;
  commerce_platform_connection_fk: number;
  platform_type: CommercePlatformType;
  external_product_id: string;
  external_handle: string | null;
  title: string;
  vendor_or_brand: string | null;
  product_type: string | null;
  status: string | null;
  primary_image_url: string | null;
  tags_json: unknown | null;
  sku_summary: string | null;
  raw_platform_payload_json: unknown | null;
  first_seen_at: CommerceTimestamp;
  last_synced_at: CommerceTimestamp | null;
  deleted_on_platform_at: CommerceTimestamp | null;
  created_on: CommerceTimestamp;
  updated_on: CommerceTimestamp;
};

export type CommerceExternalProductInsert = Omit<
  CommerceExternalProductRow,
  "commerce_external_product_pk" | "created_on" | "updated_on" | "first_seen_at"
> & {
  commerce_external_product_pk?: number;
  first_seen_at?: CommerceTimestamp;
};

export type CommerceExternalProductUpdate = Partial<
  Omit<CommerceExternalProductRow, "commerce_external_product_pk" | "created_on" | "first_seen_at">
>;
