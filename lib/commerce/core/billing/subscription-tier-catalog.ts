import { commerceQuery } from "@/lib/commerce/core/db/query";

export type CommerceSubscriptionTier = {
  subscriptionTierPk: number;
  tierCode: string;
  tierFamilyCode: string | null;
  tierName: string;
  recurringPriceAmount: number;
  currency: string;
  billingInterval: string;
  billingIntervalCount: number;
  displaySortOrder: number;
  tierLimitMaxProducts: number;
  tierLimitMaxChatsessionMonthly: number;
};

const TIER_SELECT = `
  subscription_tier_pk AS subscriptionTierPk,
  tier_code AS tierCode,
  tier_family_code AS tierFamilyCode,
  tier_name AS tierName,
  recurring_price_amount AS recurringPriceAmount,
  currency,
  billing_interval AS billingInterval,
  billing_interval_count AS billingIntervalCount,
  COALESCE(display_sort_order, 0) AS displaySortOrder,
  COALESCE(tier_limit_max_products, 0) AS tierLimitMaxProducts,
  COALESCE(tier_limit_max_chatsession_monthly, 0) AS tierLimitMaxChatsessionMonthly
`;

export async function listActiveSubscriptionTiers(): Promise<CommerceSubscriptionTier[]> {
  return commerceQuery<CommerceSubscriptionTier[]>(
    `SELECT ${TIER_SELECT}
     FROM master_subscription_tier
     WHERE effective_start_on <= CURDATE()
       AND (effective_end_on IS NULL OR effective_end_on >= CURDATE())
     ORDER BY COALESCE(display_sort_order, 0) ASC, recurring_price_amount ASC, tier_name ASC`
  );
}

export async function findSubscriptionTierByCode(
  tierCode: string
): Promise<CommerceSubscriptionTier | null> {
  const rows = await commerceQuery<CommerceSubscriptionTier[]>(
    `SELECT ${TIER_SELECT}
     FROM master_subscription_tier
     WHERE tier_code = ?
       AND effective_start_on <= CURDATE()
       AND (effective_end_on IS NULL OR effective_end_on >= CURDATE())
     ORDER BY effective_start_on DESC
     LIMIT 1`,
    [tierCode]
  );
  return rows[0] ?? null;
}

export async function findSubscriptionTierByPk(
  subscriptionTierPk: number
): Promise<CommerceSubscriptionTier | null> {
  const rows = await commerceQuery<CommerceSubscriptionTier[]>(
    `SELECT ${TIER_SELECT}
     FROM master_subscription_tier
     WHERE subscription_tier_pk = ?
     LIMIT 1`,
    [subscriptionTierPk]
  );
  return rows[0] ?? null;
}

/** Match Shopify subscription name to a tier (exact tier_name, then tier_code). */
export async function resolveTierFromShopifyPlanName(
  planName: string,
  planExternalId?: string | null
): Promise<CommerceSubscriptionTier | null> {
  if (planExternalId) {
    const byCode = await findSubscriptionTierByCode(planExternalId);
    if (byCode) {
      return byCode;
    }
  }

  const trimmed = planName.trim();
  if (!trimmed) {
    return null;
  }

  const byName = await commerceQuery<CommerceSubscriptionTier[]>(
    `SELECT ${TIER_SELECT}
     FROM master_subscription_tier
     WHERE tier_name = ?
       AND effective_start_on <= CURDATE()
       AND (effective_end_on IS NULL OR effective_end_on >= CURDATE())
     ORDER BY effective_start_on DESC
     LIMIT 1`,
    [trimmed]
  );
  return byName[0] ?? null;
}
