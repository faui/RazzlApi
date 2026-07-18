import type {
  CommerceAdapterContext,
  CreateBillingSessionInput,
  PlatformBillingSession,
  PlatformBillingStatus
} from "@/lib/commerce/adapters/types";
import { CommerceAdapterError } from "@/lib/commerce/adapters/types";
import { shopifyAdminGraphql } from "@/lib/commerce/adapters/shopify/graphql-client";
import type { CommerceSubscriptionTier } from "@/lib/commerce/core/billing/subscription-tier-catalog";

export function resolveShopifyBillingTestMode(explicit?: boolean): boolean {
  if (explicit !== undefined) {
    return explicit;
  }
  if (process.env.SHOPIFY_BILLING_TEST === "true") {
    return true;
  }
  return process.env.RAZZL_DEPLOY_ENV === "dev";
}

function formatTierPriceAmount(tier: CommerceSubscriptionTier): string {
  const amount = Number(tier.recurringPriceAmount);
  if (!Number.isFinite(amount)) {
    throw new CommerceAdapterError(
      "INVALID_TIER",
      `Tier ${tier.tierCode} has invalid recurring price`
    );
  }
  return amount.toFixed(2);
}

type AppSubscriptionCreateResponse = {
  appSubscriptionCreate: {
    userErrors: Array<{ field: string[] | null; message: string }>;
    confirmationUrl: string | null;
    appSubscription: {
      id: string;
      status: string;
    } | null;
  };
};

type CurrentAppInstallationResponse = {
  currentAppInstallation: {
    activeSubscriptions: Array<{
      id: string;
      name: string;
      status: string;
      test: boolean;
      lineItems: Array<{
        plan: {
          pricingDetails: {
            __typename: string;
            interval?: string;
            price?: { amount: string; currencyCode: string };
          };
        };
      }>;
    }>;
  };
};

function toShopifyRecurringInterval(
  billingInterval: string,
  billingIntervalCount: number
): "EVERY_30_DAYS" | "ANNUAL" {
  if (billingInterval === "year" || (billingInterval === "month" && billingIntervalCount >= 12)) {
    return "ANNUAL";
  }
  return "EVERY_30_DAYS";
}

function mapShopifyStatusToPlatformStatus(status: string | null | undefined): PlatformBillingStatus["status"] {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "ACTIVE") return "active";
  if (normalized === "PENDING") return "pending";
  if (normalized === "CANCELLED" || normalized === "CANCELED" || normalized === "EXPIRED") {
    return "cancelled";
  }
  if (normalized === "DECLINED" || normalized === "FROZEN") return "failed";
  return "pending";
}

export function buildShopifyBillingReturnUrl(shopDomain: string, publicOrigin: string): string {
  const url = new URL("/shopify", publicOrigin);
  url.searchParams.set("shop", shopDomain);
  url.searchParams.set("billing", "return");
  return url.toString();
}

export async function createShopifyAppSubscription(
  context: CommerceAdapterContext,
  tier: CommerceSubscriptionTier,
  input: CreateBillingSessionInput
): Promise<PlatformBillingSession> {
  const interval = toShopifyRecurringInterval(tier.billingInterval, tier.billingIntervalCount);
  const amount = formatTierPriceAmount(tier);
  const testMode = resolveShopifyBillingTestMode(input.test);

  const mutation = `
    mutation AppSubscriptionCreate(
      $name: String!
      $returnUrl: URL!
      $test: Boolean
      $trialDays: Int
      $lineItems: [AppSubscriptionLineItemInput!]!
    ) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        test: $test
        trialDays: $trialDays
        lineItems: $lineItems
      ) {
        userErrors { field message }
        confirmationUrl
        appSubscription { id status }
      }
    }
  `;

  const trialDays = Number(process.env.SHOPIFY_BILLING_TRIAL_DAYS ?? "7");
  const data = await shopifyAdminGraphql<AppSubscriptionCreateResponse>(context, mutation, {
    name: tier.tierName,
    returnUrl: input.returnUrl,
    test: testMode,
    trialDays: Number.isFinite(trialDays) && trialDays > 0 ? trialDays : 0,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            interval,
            price: { amount, currencyCode: tier.currency || "USD" }
          }
        }
      }
    ]
  });

  const result = data.appSubscriptionCreate;
  if (result.userErrors.length) {
    throw new CommerceAdapterError(
      "SHOPIFY_BILLING_ERROR",
      result.userErrors.map((error) => error.message).join("; ")
    );
  }

  if (!result.confirmationUrl || !result.appSubscription?.id) {
    throw new CommerceAdapterError("SHOPIFY_BILLING_ERROR", "Shopify did not return a confirmation URL");
  }

  return {
    confirmationUrl: result.confirmationUrl,
    chargeId: result.appSubscription.id,
    rawPayload: result
  };
}

export async function getShopifyAppBillingStatus(
  context: CommerceAdapterContext
): Promise<PlatformBillingStatus> {
  const query = `
    query CurrentAppInstallationBilling {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
          test
        }
      }
    }
  `;

  const data = await shopifyAdminGraphql<CurrentAppInstallationResponse>(context, query);
  const active = data.currentAppInstallation.activeSubscriptions[0];
  if (!active) {
    return { status: "pending" };
  }

  return {
    status: mapShopifyStatusToPlatformStatus(active.status),
    planExternalId: active.name,
    subscriptionId: active.id,
    chargeId: active.id,
    rawPayload: active
  };
}

export { mapShopifyStatusToPlatformStatus };
