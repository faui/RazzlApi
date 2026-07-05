import { commerceQuery } from "@/lib/commerce/core/db/query";
import { COMMERCE_TABLES } from "@/lib/commerce/types/enums";
import type { CommerceBillingAccountRow, CommerceBillingAccountUpdate } from "@/lib/commerce/types/commerce-billing-account";
import type {
  CommerceAcquisitionSource,
  CommerceBillingSource,
  CommercePlatformBillingStatus
} from "@/lib/commerce/types/enums";

export async function findBillingAccountByConnectionId(
  connectionId: number
): Promise<CommerceBillingAccountRow | null> {
  const rows = await commerceQuery<CommerceBillingAccountRow[]>(
    `SELECT * FROM ${COMMERCE_TABLES.billingAccount}
     WHERE commerce_platform_connection_fk = ?
     LIMIT 1`,
    [connectionId]
  );
  return rows[0] ?? null;
}

export async function findBillingAccountByTenantId(
  tenantPk: number
): Promise<CommerceBillingAccountRow | null> {
  const rows = await commerceQuery<CommerceBillingAccountRow[]>(
    `SELECT * FROM ${COMMERCE_TABLES.billingAccount}
     WHERE tenant_fk = ?
     ORDER BY updated_on DESC
     LIMIT 1`,
    [tenantPk]
  );
  return rows[0] ?? null;
}

export async function upsertBillingAccountForConnection(input: {
  tenantPk: number;
  connectionId: number;
  billingSource: CommerceBillingSource;
  acquisitionSource: CommerceAcquisitionSource;
  platformBillingStatus?: CommercePlatformBillingStatus;
  trialEnabled?: boolean;
  trialDurationDays?: number;
  trialMaxProducts?: number;
}): Promise<number> {
  const existing = await findBillingAccountByConnectionId(input.connectionId);
  if (existing) {
    await commerceQuery(
      `UPDATE ${COMMERCE_TABLES.billingAccount}
       SET tenant_fk = ?,
           billing_source = ?,
           acquisition_source = ?,
           platform_billing_status = COALESCE(?, platform_billing_status),
           updated_on = NOW()
       WHERE commerce_billing_account_pk = ?`,
      [
        input.tenantPk,
        input.billingSource,
        input.acquisitionSource,
        input.platformBillingStatus ?? null,
        existing.commerce_billing_account_pk
      ]
    );
    return existing.commerce_billing_account_pk;
  }

  const result = await commerceQuery<{ insertId: number }>(
    `INSERT INTO ${COMMERCE_TABLES.billingAccount} (
       tenant_fk,
       commerce_platform_connection_fk,
       billing_source,
       acquisition_source,
       platform_billing_status,
       trial_enabled,
       trial_duration_days,
       trial_max_products
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.tenantPk,
      input.connectionId,
      input.billingSource,
      input.acquisitionSource,
      input.platformBillingStatus ?? "pending",
      input.trialEnabled === false ? 0 : 1,
      input.trialDurationDays ?? 7,
      input.trialMaxProducts ?? 1
    ]
  );
  return result.insertId;
}

export async function updateBillingAccount(
  billingAccountPk: number,
  patch: CommerceBillingAccountUpdate
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  const assign = (column: string, value: unknown) => {
    fields.push(`${column} = ?`);
    values.push(value);
  };

  if (patch.billing_source !== undefined) assign("billing_source", patch.billing_source);
  if (patch.acquisition_source !== undefined) assign("acquisition_source", patch.acquisition_source);
  if (patch.billing_plan_external_id !== undefined) {
    assign("billing_plan_external_id", patch.billing_plan_external_id);
  }
  if (patch.platform_billing_charge_id !== undefined) {
    assign("platform_billing_charge_id", patch.platform_billing_charge_id);
  }
  if (patch.platform_billing_subscription_id !== undefined) {
    assign("platform_billing_subscription_id", patch.platform_billing_subscription_id);
  }
  if (patch.platform_billing_status !== undefined) {
    assign("platform_billing_status", patch.platform_billing_status);
  }
  if (patch.billing_effective_at !== undefined) assign("billing_effective_at", patch.billing_effective_at);
  if (patch.billing_cancelled_at !== undefined) assign("billing_cancelled_at", patch.billing_cancelled_at);
  if (patch.metadata_json !== undefined) {
    assign("metadata_json", patch.metadata_json ? JSON.stringify(patch.metadata_json) : null);
  }

  if (!fields.length) {
    return;
  }

  fields.push("updated_on = NOW()");
  values.push(billingAccountPk);

  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.billingAccount} SET ${fields.join(", ")} WHERE commerce_billing_account_pk = ?`,
    values
  );
}

export async function tenantHasStripeCustomer(tenantPk: number): Promise<boolean> {
  const rows = await commerceQuery<Array<{ tenant_fk: number }>>(
    "SELECT tenant_fk FROM tenant_stripe_customer WHERE tenant_fk = ? LIMIT 1",
    [tenantPk]
  );
  return rows.length > 0;
}

export async function tenantHasCurrentSubscription(tenantPk: number): Promise<boolean> {
  const rows = await commerceQuery<Array<{ tenant_subscription_pk: number }>>(
    "SELECT tenant_subscription_pk FROM tenant_subscription WHERE tenant_fk = ? AND is_current = 1 LIMIT 1",
    [tenantPk]
  );
  return rows.length > 0;
}
