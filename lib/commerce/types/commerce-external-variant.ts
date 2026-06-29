import type { CommerceTimestamp } from "./enums";

export type CommerceExternalVariantRow = {
  commerce_external_variant_pk: number;
  commerce_platform_connection_fk: number;
  commerce_external_product_fk: number;
  external_product_id: string;
  external_variant_id: string;
  title: string | null;
  sku: string | null;
  barcode: string | null;
  status: string | null;
  option_values_json: unknown | null;
  raw_platform_payload_json: unknown | null;
  last_synced_at: CommerceTimestamp | null;
  created_on: CommerceTimestamp;
  updated_on: CommerceTimestamp;
};

export type CommerceExternalVariantInsert = Omit<
  CommerceExternalVariantRow,
  "commerce_external_variant_pk" | "created_on" | "updated_on"
> & {
  commerce_external_variant_pk?: number;
};

export type CommerceExternalVariantUpdate = Partial<
  Omit<CommerceExternalVariantRow, "commerce_external_variant_pk" | "created_on">
>;
