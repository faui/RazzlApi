import { NextResponse } from "next/server";

import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import { CommerceSyncError } from "@/lib/commerce/core/connections/adapter-context";
import {
  CommerceLaunchTrackingError,
  recordLaunchEvent
} from "@/lib/commerce/core/analytics/launch-tracking-service";
import { COMMERCE_LAUNCH_SOURCE_SHOPIFY_PRODUCT_PAGE_CTA } from "@/lib/commerce/types/enums";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

type LaunchEventBody = {
  shop?: string;
  productId?: string;
  variantId?: string;
  sessionId?: string;
  anonymousVisitorId?: string;
};

/** Public storefront launch/CTA click tracking — called before redirect from theme block. */
export async function POST(request: Request) {
  let body: LaunchEventBody = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as LaunchEventBody;
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const url = new URL(request.url);
  const shopParam = body.shop ?? url.searchParams.get("shop");
  const productId = body.productId?.trim() ?? url.searchParams.get("productId")?.trim();

  const shop = shopParam ? normalizeShopDomain(shopParam) : null;
  if (!shop || !productId) {
    return NextResponse.json(
      { ok: false, error: "shop and productId are required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  try {
    const result = await recordLaunchEvent({
      shop,
      externalProductId: productId,
      externalVariantId: body.variantId,
      source: COMMERCE_LAUNCH_SOURCE_SHOPIFY_PRODUCT_PAGE_CTA,
      sessionId: body.sessionId,
      anonymousVisitorId: body.anonymousVisitorId
    });
    return NextResponse.json({ ok: true, eventId: result.eventId }, { headers: CORS_HEADERS });
  } catch (error) {
    if (error instanceof CommerceLaunchTrackingError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    if (error instanceof CommerceSyncError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    return NextResponse.json(
      { ok: false, error: "Failed to record launch event" },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
