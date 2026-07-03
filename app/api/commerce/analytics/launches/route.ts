import { NextResponse } from "next/server";

import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import { CommerceSyncError } from "@/lib/commerce/core/connections/adapter-context";
import {
  CommerceLaunchTrackingError,
  getLaunchAnalyticsSummary
} from "@/lib/commerce/core/analytics/launch-tracking-service";

function parseShop(request: Request): string | null {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  if (!shopParam) {
    return null;
  }
  return normalizeShopDomain(shopParam);
}

/** Merchant-facing launch analytics summary for Shopify admin. */
export async function GET(request: Request) {
  const shop = parseShop(request);
  if (!shop) {
    return NextResponse.json({ ok: false, error: "Missing or invalid shop parameter" }, { status: 400 });
  }

  try {
    const summary = await getLaunchAnalyticsSummary(shop);
    return NextResponse.json({
      ok: true,
      shop,
      totals: {
        totalClicks: summary.totalClicks,
        clicksLast7Days: summary.clicksLast7Days,
        clicksLast30Days: summary.clicksLast30Days
      },
      products: summary.products.map((row) => ({
        externalProductId: row.externalProductId,
        title: row.title,
        clickCount: row.clickCount,
        lastClickAt: row.lastClickAt
      }))
    });
  } catch (error) {
    if (error instanceof CommerceLaunchTrackingError) {
      const httpStatus = error.code === "NOT_LINKED" ? 409 : 400;
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: httpStatus });
    }
    if (error instanceof CommerceSyncError) {
      const httpStatus = error.code === "NOT_INSTALLED" ? 404 : 400;
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Failed to load launch analytics" }, { status: 500 });
  }
}
