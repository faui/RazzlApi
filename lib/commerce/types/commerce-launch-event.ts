import type { CommerceLaunchSource, CommercePlatformType, CommerceTimestamp } from "./enums";

export type CommerceLaunchEventRow = {
  commerce_launch_event_pk: number;
  tenant_fk: number;
  commerce_platform_connection_fk: number;
  platform_type: CommercePlatformType;
  external_product_id: string;
  external_variant_id: string | null;
  product_fk: number | null;
  razzl_code: string | null;
  source: CommerceLaunchSource;
  launch_url: string | null;
  session_id: string | null;
  anonymous_visitor_id: string | null;
  metadata_json: unknown | null;
  created_on: CommerceTimestamp;
};

export type CommerceLaunchEventInsert = Omit<
  CommerceLaunchEventRow,
  "commerce_launch_event_pk" | "created_on"
>;
