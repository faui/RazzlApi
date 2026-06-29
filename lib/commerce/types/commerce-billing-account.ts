import type {
  CommerceAcquisitionSource,
  CommerceBillingSource,
  CommerceBoolean,
  CommercePlatformBillingStatus,
  CommerceTimestamp
} from "./enums";

export type CommerceBillingAccountRow = {
  commerce_billing_account_pk: number;
  tenant_fk: number;
  commerce_platform_connection_fk: number | null;
  billing_source: CommerceBillingSource;
  acquisition_source: CommerceAcquisitionSource;
  billing_plan_external_id: string | null;
  platform_billing_charge_id: string | null;
  platform_billing_subscription_id: string | null;
  platform_billing_status: CommercePlatformBillingStatus;
  trial_enabled: CommerceBoolean;
  trial_duration_days: number;
  trial_max_products: number;
  billing_effective_at: CommerceTimestamp | null;
  billing_cancelled_at: CommerceTimestamp | null;
  metadata_json: unknown | null;
  created_on: CommerceTimestamp;
  updated_on: CommerceTimestamp;
};

export type CommerceBillingAccountInsert = Omit<
  CommerceBillingAccountRow,
  "commerce_billing_account_pk" | "created_on" | "updated_on"
> & {
  commerce_billing_account_pk?: number;
};

export type CommerceBillingAccountUpdate = Partial<
  Omit<CommerceBillingAccountRow, "commerce_billing_account_pk" | "created_on">
>;
