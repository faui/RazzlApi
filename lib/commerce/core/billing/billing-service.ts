import {
  getAdapterForConnection
} from "@/lib/commerce/core/connections/adapter-context";
import { resolveShopifyConnection } from "@/lib/commerce/adapters/shopify/shopify-token-service";
import type { CommercePlatformConnectionRow } from "@/lib/commerce/types/commerce-platform-connection";
import type { CommerceBillingSource } from "@/lib/commerce/types/enums";
import {
  findBillingAccountByConnectionId,
  tenantHasCurrentSubscription,
  tenantHasStripeCustomer,
  updateBillingAccount,
  upsertBillingAccountForConnection
} from "@/lib/commerce/core/billing/billing-account-repo";
import {
  findSubscriptionTierByCode,
  listActiveSubscriptionTiers,
  resolveTierFromShopifyPlanName,
  type CommerceSubscriptionTier
} from "@/lib/commerce/core/billing/subscription-tier-catalog";
import {
  isActiveShopifySubscriptionStatus,
  projectTenantSubscriptionFromShopify
} from "@/lib/commerce/core/billing/tenant-subscription-projection";
import {
  buildShopifyBillingReturnUrl,
  mapShopifyStatusToPlatformStatus,
  resolveShopifyBillingTestMode
} from "@/lib/commerce/adapters/shopify/billing";
import { getShopifyEnvConfig } from "@/lib/commerce/config/shopify-env";
import { commerceQuery } from "@/lib/commerce/core/db/query";
import { COMMERCE_TABLES } from "@/lib/commerce/types/enums";
import { traceLog } from "@/lib/logger";

export class CommerceBillingError extends Error {
  constructor(
    public code: string,
    message: string,
    public confirmationUrl?: string
  ) {
    super(message);
    this.name = "CommerceBillingError";
  }
}

export type BillingStatusSummary = {
  billingSource: CommerceBillingSource;
  platformBillingStatus: string;
  shopifyManageMessage: string | null;
  hasEntitlement: boolean;
  requiresShopifyBilling: boolean;
  currentTierCode: string | null;
  plans: CommerceSubscriptionTier[];
};

export async function resolveBillingLane(
  connection: CommercePlatformConnectionRow,
  tenantPk: number
): Promise<CommerceBillingSource> {
  const account = await findBillingAccountByConnectionId(connection.commerce_platform_connection_pk);
  if (account?.billing_source === "stripe") {
    return "stripe";
  }
  if (account?.billing_source === "shopify_billing") {
    return "shopify_billing";
  }

  const hasStripe = await tenantHasStripeCustomer(tenantPk);
  if (hasStripe) {
    return "stripe";
  }

  return "shopify_billing";
}

export async function initializeBillingOnTenantLink(
  connection: CommercePlatformConnectionRow,
  tenantPk: number
): Promise<void> {
  const hasStripe = await tenantHasStripeCustomer(tenantPk);
  const billingSource: CommerceBillingSource = hasStripe ? "stripe" : "shopify_billing";
  const platformBillingStatus = hasStripe ? "not_required" : "pending";

  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.platformConnection}
     SET billing_source = ?,
         platform_billing_status = ?,
         updated_on = NOW()
     WHERE commerce_platform_connection_pk = ?`,
    [billingSource, platformBillingStatus, connection.commerce_platform_connection_pk]
  );

  await upsertBillingAccountForConnection({
    tenantPk,
    connectionId: connection.commerce_platform_connection_pk,
    billingSource,
    acquisitionSource: connection.acquisition_source,
    platformBillingStatus
  });
}

export async function getBillingStatusSummary(
  connection: CommercePlatformConnectionRow,
  tenantPk: number
): Promise<BillingStatusSummary> {
  const billingSource = await resolveBillingLane(connection, tenantPk);
  const account = await findBillingAccountByConnectionId(connection.commerce_platform_connection_pk);
  const hasEntitlement = await tenantHasCurrentSubscription(tenantPk);
  const requiresShopifyBilling = billingSource === "shopify_billing";

  let currentTierCode = account?.billing_plan_external_id ?? null;
  if (!currentTierCode && hasEntitlement) {
    const subRows = await commerceQuery<Array<{ tier_code: string }>>(
      `SELECT mst.tier_code
       FROM tenant_subscription ts
       INNER JOIN master_subscription_tier mst ON mst.subscription_tier_pk = ts.subscription_tier_fk
       WHERE ts.tenant_fk = ? AND ts.is_current = 1
       LIMIT 1`,
      [tenantPk]
    );
    currentTierCode = subRows[0]?.tier_code ?? null;
  }

  return {
    billingSource,
    platformBillingStatus: account?.platform_billing_status ?? connection.platform_billing_status ?? "pending",
    shopifyManageMessage:
      billingSource === "shopify_billing"
        ? "Change plans from the Razzl app. Shopify will ask you to approve the replacement subscription."
        : null,
    hasEntitlement,
    requiresShopifyBilling,
    currentTierCode,
    plans: requiresShopifyBilling ? await listActiveSubscriptionTiers() : []
  };
}

export async function assertCommerceFeatureEntitlement(
  connection: CommercePlatformConnectionRow,
  tenantPk: number,
  feature: "map" | "sync" | "cta"
): Promise<void> {
  const billingSource = await resolveBillingLane(connection, tenantPk);
  if (billingSource === "stripe") {
    if (!(await tenantHasCurrentSubscription(tenantPk))) {
      throw new CommerceBillingError(
        "STRIPE_SUBSCRIPTION_REQUIRED",
        "An active Razzl subscription is required before using Shopify connector features."
      );
    }
    return;
  }

  const account = await findBillingAccountByConnectionId(connection.commerce_platform_connection_pk);
  const status = account?.platform_billing_status ?? connection.platform_billing_status;
  if (status === "active" || (await tenantHasCurrentSubscription(tenantPk))) {
    return;
  }

  throw new CommerceBillingError(
    "BILLING_REQUIRED",
    feature === "map"
      ? "Choose a plan and approve Shopify billing before mapping your first copilot."
      : "Approve Shopify billing before using this feature."
  );
}

export async function createShopifyBillingSession(
  connection: CommercePlatformConnectionRow,
  tenantPk: number,
  tierCode: string
): Promise<{ confirmationUrl: string; chargeId: string }> {
  const billingSource = await resolveBillingLane(connection, tenantPk);
  if (billingSource !== "shopify_billing") {
    throw new CommerceBillingError(
      "STRIPE_BILLING_LANE",
      "This account uses Stripe billing. Manage your subscription in Razzl Studio."
    );
  }

  const tier = await findSubscriptionTierByCode(tierCode);
  if (!tier) {
    throw new CommerceBillingError("INVALID_TIER", "Unknown subscription tier");
  }

  const adapter = getAdapterForConnection(connection);
  if (!adapter.createBillingSession) {
    throw new CommerceBillingError("NOT_SUPPORTED", "Billing is not supported for this platform");
  }

  const { context } = await resolveShopifyConnection(connection);
  const config = getShopifyEnvConfig();
  const returnUrl = buildShopifyBillingReturnUrl(connection.store_domain ?? "", config.publicOrigin);

  const session = await adapter.createBillingSession({
    context,
    planExternalId: tier.tierCode,
    returnUrl,
    test: resolveShopifyBillingTestMode()
  });

  const billingAccountPk =
    (await findBillingAccountByConnectionId(connection.commerce_platform_connection_pk))
      ?.commerce_billing_account_pk ??
    (await upsertBillingAccountForConnection({
      tenantPk,
      connectionId: connection.commerce_platform_connection_pk,
      billingSource: "shopify_billing",
      acquisitionSource: connection.acquisition_source,
      platformBillingStatus: "pending"
    }));

  await updateBillingAccount(billingAccountPk, {
    billing_source: "shopify_billing",
    billing_plan_external_id: tier.tierCode,
    platform_billing_charge_id: session.chargeId ?? null,
    platform_billing_subscription_id: session.chargeId ?? null,
    platform_billing_status: "pending"
  });

  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.platformConnection}
     SET billing_source = 'shopify_billing',
         platform_billing_status = 'pending',
         updated_on = NOW()
     WHERE commerce_platform_connection_pk = ?`,
    [connection.commerce_platform_connection_pk]
  );

  if (!session.confirmationUrl) {
    throw new CommerceBillingError("SHOPIFY_BILLING_ERROR", "Shopify did not return a confirmation URL");
  }

  traceLog(2, "shopify:billing:session_created", {
    shop: connection.store_domain,
    tenantPk,
    tierCode,
    chargeId: session.chargeId
  });

  return {
    confirmationUrl: session.confirmationUrl,
    chargeId: session.chargeId ?? ""
  };
}

export type ShopifyAppSubscriptionWebhookPayload = {
  admin_graphql_api_id?: string;
  name?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  currency?: string;
};

export async function applyShopifySubscriptionWebhook(
  shopDomain: string,
  topic: "app_subscriptions/update",
  payload: ShopifyAppSubscriptionWebhookPayload
): Promise<void> {
  const { findConnectionByStoreDomain } = await import(
    "@/lib/commerce/core/connections/platform-connection-repo"
  );
  const connection = await findConnectionByStoreDomain(shopDomain);
  if (!connection?.tenant_fk) {
    traceLog(2, "shopify:billing:webhook:no_tenant", { shop: shopDomain, topic });
    return;
  }

  const tenantPk = connection.tenant_fk;
  const subscriptionId = payload.admin_graphql_api_id ?? null;
  const platformStatus = mapShopifyStatusToPlatformStatus(payload.status);
  const cancelled = platformStatus === "cancelled";

  const tier = await resolveTierFromShopifyPlanName(
    payload.name ?? "",
    (await findBillingAccountByConnectionId(connection.commerce_platform_connection_pk))
      ?.billing_plan_external_id
  );

  const billingAccount =
    (await findBillingAccountByConnectionId(connection.commerce_platform_connection_pk)) ??
    null;

  if (billingAccount) {
    await updateBillingAccount(billingAccount.commerce_billing_account_pk, {
      platform_billing_charge_id: subscriptionId,
      platform_billing_subscription_id: subscriptionId,
      platform_billing_status: cancelled ? "cancelled" : platformStatus,
      billing_plan_external_id: tier?.tierCode ?? billingAccount.billing_plan_external_id,
      billing_effective_at: isActiveShopifySubscriptionStatus(payload.status) ? new Date() : null,
      billing_cancelled_at: cancelled ? new Date() : null
    });
  }

  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.platformConnection}
     SET billing_source = 'shopify_billing',
         platform_billing_status = ?,
         updated_on = NOW()
     WHERE commerce_platform_connection_pk = ?`,
    [cancelled ? "cancelled" : platformStatus, connection.commerce_platform_connection_pk]
  );

  await projectTenantSubscriptionFromShopify({
    tenantPk,
    tierPk: tier?.subscriptionTierPk ?? null,
    shopifySubscriptionId: subscriptionId,
    shopifySubscriptionStatus: payload.status ?? null,
    updatedBy: "shopify_billing_webhook"
  });

  traceLog(2, "shopify:billing:webhook:applied", {
    shop: shopDomain,
    topic,
    tenantPk,
    status: payload.status,
    tierCode: tier?.tierCode ?? null
  });
}

export async function markBillingCancelledOnUninstall(connectionId: number): Promise<void> {
  const account = await findBillingAccountByConnectionId(connectionId);
  if (!account) {
    return;
  }

  await updateBillingAccount(account.commerce_billing_account_pk, {
    platform_billing_status: "cancelled",
    billing_cancelled_at: new Date()
  });

  if (account.tenant_fk) {
    await projectTenantSubscriptionFromShopify({
      tenantPk: account.tenant_fk,
      tierPk: null,
      shopifySubscriptionId: account.platform_billing_subscription_id,
      shopifySubscriptionStatus: "CANCELLED",
      updatedBy: "shopify_uninstall"
    });
  }
}
