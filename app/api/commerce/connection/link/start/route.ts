import { NextResponse } from "next/server";

import {
  CommerceConnectionError,
  startTenantLink
} from "@/lib/commerce/core/connections/connection-service";
import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";

/** Start Studio login/signup flow to link a Shopify store to a Razzl tenant. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  if (!shopParam) {
    return NextResponse.json({ ok: false, error: "Missing shop parameter" }, { status: 400 });
  }

  const shop = normalizeShopDomain(shopParam);
  if (!shop) {
    return NextResponse.json({ ok: false, error: "Invalid shop domain" }, { status: 400 });
  }

  try {
    const result = await startTenantLink(shop);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CommerceConnectionError) {
      const status = error.code === "NOT_INSTALLED" ? 404 : 400;
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ ok: false, error: "Failed to start tenant link" }, { status: 500 });
  }
}
