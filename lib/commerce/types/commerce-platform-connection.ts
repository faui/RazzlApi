import type {
  CommerceAcquisitionSource,
  CommerceAuthType,
  CommerceBillingSource,
  CommerceInstallStatus,
  CommercePlatformBillingStatus,
  CommercePlatformType,
  CommerceTimestamp
} from "./enums";

export type CommercePlatformConnectionRow = {
  commerce_platform_connection_pk: number;
  tenant_fk: number | null;
  platform_type: CommercePlatformType;
  external_store_id: string;
  store_domain: string | null;
  store_display_name: string | null;
  install_status: CommerceInstallStatus;
  auth_type: CommerceAuthType;
  access_token_encrypted: Buffer | null;
  refresh_token_encrypted: Buffer | null;
  scopes_json: unknown | null;
  acquisition_source: CommerceAcquisitionSource;
  billing_source: CommerceBillingSource;
  platform_billing_status: CommercePlatformBillingStatus | null;
  installed_at: CommerceTimestamp | null;
  connected_at: CommerceTimestamp | null;
  uninstalled_at: CommerceTimestamp | null;
  last_synced_at: CommerceTimestamp | null;
  raw_platform_payload_json: unknown | null;
  created_on: CommerceTimestamp;
  updated_on: CommerceTimestamp;
};

export type CommercePlatformConnectionInsert = Omit<
  CommercePlatformConnectionRow,
  "commerce_platform_connection_pk" | "created_on" | "updated_on"
> & {
  commerce_platform_connection_pk?: number;
};

export type CommercePlatformConnectionUpdate = Partial<
  Omit<CommercePlatformConnectionRow, "commerce_platform_connection_pk" | "created_on">
>;
