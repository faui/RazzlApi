import { NextResponse } from "next/server";

import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import { requireLinkedShopConnection } from "@/lib/commerce/core/connections/adapter-context";
import { getBillingStatusSummary } from "@/lib/commerce/core/billing/billing-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  const shop = shopParam ? normalizeShopDomain(shopParam) : null;
  if (!shop) {
    return NextResponse.json({ ok: false, error: "shop is required" }, { status: 400 });
  }

  try {
    const { connection } = await requireLinkedShopConnection(shop);
    const tenantPk = connection.tenant_fk;
    if (!tenantPk) {
      return NextResponse.json({ ok: false, error: "Tenant is not linked" }, { status: 400 });
    }

    const summary = await getBillingStatusSummary(connection, tenantPk);
    return NextResponse.json({
      ok: true,
      billingSource: summary.billingSource,
      platformBillingStatus: summary.platformBillingStatus,
      hasEntitlement: summary.hasEntitlement,
      requiresShopifyBilling: summary.requiresShopifyBilling,
      currentTierCode: summary.currentTierCode,
      shopifyManageMessage: summary.shopifyManageMessage,
      plans: summary.plans.map((plan) => ({
        tierCode: plan.tierCode,
        tierName: plan.tierName,
        tierFamilyCode: plan.tierFamilyCode,
        price: plan.recurringPriceAmount,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        billingIntervalCount: plan.billingIntervalCount,
        maxProducts: plan.tierLimitMaxProducts,
        maxSessionsMonthly: plan.tierLimitMaxChatsessionMonthly
      }))
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to load billing status" }, { status: 500 });
  }
}
