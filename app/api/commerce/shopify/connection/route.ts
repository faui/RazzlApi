import { NextResponse } from "next/server";

import {
  CommerceConnectionError,
  getShopConnectionStatus
} from "@/lib/commerce/core/connections/connection-service";
import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";

/** Connection status for embedded admin (no token exposure). */
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
    const status = await getShopConnectionStatus(shop);
    if (!status) {
      return NextResponse.json({
        ok: true,
        connected: false,
        shop
      });
    }

    return NextResponse.json({
      ok: true,
      connected: status.installStatus === "installed" || status.installStatus === "connected",
      shop: status.storeDomain,
      storeDisplayName: status.storeDisplayName,
      installStatus: status.installStatus,
      tenantLinked: status.tenantLinked,
      tenantPk: status.tenantPk,
      tenantName: status.tenantName,
      connectedAt: status.connectedAt,
      installedAt: status.installedAt
    });
  } catch (error) {
    if (error instanceof CommerceConnectionError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Failed to load connection status" }, { status: 500 });
  }
}
