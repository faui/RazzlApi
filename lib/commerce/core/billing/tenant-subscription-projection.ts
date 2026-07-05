import { commerceQuery } from "@/lib/commerce/core/db/query";

export type TierLimitDefaults = {
  defaultOverageGracePercent: number;
  defaultOverageHardStopPercent: number;
  defaultAntiabuseMaxProductDaily: number;
  defaultAntiabuseMaxChatsessionDaily: number;
};

const FALLBACK_LIMIT_DEFAULTS: TierLimitDefaults = {
  defaultOverageGracePercent: 110,
  defaultOverageHardStopPercent: 120,
  defaultAntiabuseMaxProductDaily: 50,
  defaultAntiabuseMaxChatsessionDaily: 1000
};

function toFiniteOrFallback(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function loadTierLimitDefaults(subscriptionTierPk: number): Promise<TierLimitDefaults> {
  const rows = await commerceQuery<
    Array<{
      default_overage_grace_percent: number | null;
      default_overage_hard_stop_percent: number | null;
      default_antiabuse_max_product_daily: number | null;
      default_antiabuse_max_chatsession_daily: number | null;
    }>
  >(
    `SELECT
       default_overage_grace_percent,
       default_overage_hard_stop_percent,
       default_antiabuse_max_product_daily,
       default_antiabuse_max_chatsession_daily
     FROM master_subscription_tier
     WHERE subscription_tier_pk = ?
     LIMIT 1`,
    [subscriptionTierPk]
  );
  const tier = rows[0];
  if (!tier) return FALLBACK_LIMIT_DEFAULTS;
  return {
    defaultOverageGracePercent: toFiniteOrFallback(
      tier.default_overage_grace_percent,
      FALLBACK_LIMIT_DEFAULTS.defaultOverageGracePercent
    ),
    defaultOverageHardStopPercent: toFiniteOrFallback(
      tier.default_overage_hard_stop_percent,
      FALLBACK_LIMIT_DEFAULTS.defaultOverageHardStopPercent
    ),
    defaultAntiabuseMaxProductDaily: toFiniteOrFallback(
      tier.default_antiabuse_max_product_daily,
      FALLBACK_LIMIT_DEFAULTS.defaultAntiabuseMaxProductDaily
    ),
    defaultAntiabuseMaxChatsessionDaily: toFiniteOrFallback(
      tier.default_antiabuse_max_chatsession_daily,
      FALLBACK_LIMIT_DEFAULTS.defaultAntiabuseMaxChatsessionDaily
    )
  };
}

function toSqlTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
}

const ACTIVE_SHOPIFY_SUBSCRIPTION_STATUSES = new Set(["ACTIVE", "active"]);

export function isActiveShopifySubscriptionStatus(status: string | null | undefined): boolean {
  return status != null && ACTIVE_SHOPIFY_SUBSCRIPTION_STATUSES.has(status);
}

export type ShopifySubscriptionProjectionInput = {
  tenantPk: number;
  tierPk: number | null;
  shopifySubscriptionId: string | null;
  shopifySubscriptionStatus: string | null;
  currentPeriodStart?: string | Date | null;
  currentPeriodEnd?: string | Date | null;
  updatedBy?: string;
};

/** Project Shopify billing state into tenant_subscription (same table Stripe uses). */
export async function projectTenantSubscriptionFromShopify(
  input: ShopifySubscriptionProjectionInput
): Promise<void> {
  const updatedBy = input.updatedBy ?? "shopify_billing_webhook";
  const activeRows = await commerceQuery<
    Array<{ tenant_subscription_pk: number; subscription_tier_fk: number }>
  >(
    `SELECT tenant_subscription_pk, subscription_tier_fk
     FROM tenant_subscription
     WHERE tenant_fk = ? AND is_current = 1
     ORDER BY start_on DESC, tenant_subscription_pk DESC
     LIMIT 1`,
    [input.tenantPk]
  );
  const active = activeRows[0];
  const shouldBeActive =
    input.tierPk != null && isActiveShopifySubscriptionStatus(input.shopifySubscriptionStatus);
  const subscriptionId = input.shopifySubscriptionId;
  const subscriptionStatus = input.shopifySubscriptionStatus?.toLowerCase() ?? null;
  const currentPeriodStart = toSqlTimestamp(input.currentPeriodStart);
  const currentPeriodEnd = toSqlTimestamp(input.currentPeriodEnd);

  if (!shouldBeActive) {
    await commerceQuery(
      "UPDATE tenant_subscription SET is_current = 0, end_on = CURDATE(), updated_by = ? WHERE tenant_fk = ? AND is_current = 1",
      [updatedBy, input.tenantPk]
    );
    return;
  }

  if (active?.subscription_tier_fk === input.tierPk) {
    await commerceQuery(
      `UPDATE tenant_subscription
       SET stripe_subscription_id = ?,
           stripe_subscription_status = ?,
           current_period_start = ?,
           current_period_end = ?,
           updated_by = ?
       WHERE tenant_subscription_pk = ?`,
      [
        subscriptionId,
        subscriptionStatus,
        currentPeriodStart,
        currentPeriodEnd,
        updatedBy,
        active.tenant_subscription_pk
      ]
    );
    return;
  }

  await commerceQuery(
    "UPDATE tenant_subscription SET is_current = 0, end_on = CURDATE(), updated_by = ? WHERE tenant_fk = ? AND is_current = 1",
    [updatedBy, input.tenantPk]
  );

  const defaults = await loadTierLimitDefaults(input.tierPk!);
  await commerceQuery(
    `INSERT INTO tenant_subscription
     (tenant_fk, subscription_tier_fk, stripe_subscription_id, stripe_subscription_status, current_period_start, current_period_end, start_on, is_current, created_by, updated_by,
      tier_limit_overage_grace_percent, tier_limit_overage_hard_stop_percent, tier_limit_antiabuse_max_product_daily, tier_limit_antiabuse_max_chatsession_daily)
     VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 1, ?, ?, ?, ?, ?, ?)`,
    [
      input.tenantPk,
      input.tierPk,
      subscriptionId,
      subscriptionStatus,
      currentPeriodStart,
      currentPeriodEnd,
      updatedBy,
      updatedBy,
      defaults.defaultOverageGracePercent,
      defaults.defaultOverageHardStopPercent,
      defaults.defaultAntiabuseMaxProductDaily,
      defaults.defaultAntiabuseMaxChatsessionDaily
    ]
  );
}
