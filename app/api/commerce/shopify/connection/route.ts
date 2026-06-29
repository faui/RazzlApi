import { NextResponse } from "next/server";

import { getConnectionStatusByStoreDomain } from "@/lib/commerce/core/connections/platform-connection-repo";
import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";

/** Connection status for embedded admin (no token exposure). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  if (!shopParam) {
    return NextResponse.json({ ok: false, error: "Missing shop parameter" }, { status: 400 });
  }

  const shopDomain = normalizeShopDomain(shopParam);
  if (!shopDomain) {
    return NextResponse.json({ ok: false, error: "Invalid shop domain" }, { status: 400 });
  }

  const status = await getConnectionStatusByStoreDomain(shopDomain);
  if (!status) {
    return NextResponse.json({
      ok: true,
      connected: false,
      shop: shopDomain
    });
  }

  return NextResponse.json({
    ok: true,
    connected: status.installStatus === "installed" || status.installStatus === "connected",
    shop: status.storeDomain,
    storeDisplayName: status.storeDisplayName,
    installStatus: status.installStatus,
    tenantLinked: status.tenantLinked,
    installedAt: status.installedAt
  });
}
