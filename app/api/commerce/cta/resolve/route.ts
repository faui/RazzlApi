import { NextResponse } from "next/server";

import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import { resolveStorefrontCta } from "@/lib/commerce/core/cta/cta-resolver-service";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

/** Public storefront CTA resolver — returns launch URL when mapping + CTA preconditions pass. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  const productId = url.searchParams.get("productId")?.trim();

  const shop = shopParam ? normalizeShopDomain(shopParam) : null;
  if (!shop || !productId) {
    return NextResponse.json(
      { ok: false, error: "shop and productId are required" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const result = await resolveStorefrontCta(shop, productId);
  return NextResponse.json(
    {
      ok: true,
      visible: result.visible,
      label: result.label ?? null,
      launchUrl: result.launchUrl ?? null,
      openMode: result.openMode ?? null,
      styleMode: result.styleMode ?? null,
      showPoweredByRazzl: result.showPoweredByRazzl ?? false
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
