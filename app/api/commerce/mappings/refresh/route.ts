import { NextResponse } from "next/server";

import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import { CommerceSyncError } from "@/lib/commerce/core/connections/adapter-context";
import { CommerceMappingError } from "@/lib/commerce/core/mapping/mapping-service";
import { refreshProductMappingSnapshots } from "@/lib/commerce/core/mapping/status-sync";

type RefreshBody = {
  shop?: string;
  externalProductId?: string;
};

/** Refresh Copilot status snapshots from live Razzl product rows. */
export async function POST(request: Request) {
  let body: RefreshBody = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as RefreshBody;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const url = new URL(request.url);
  const shopParam = body.shop ?? url.searchParams.get("shop");
  const externalProductId =
    body.externalProductId?.trim() ?? url.searchParams.get("externalProductId")?.trim() ?? undefined;

  const shop = shopParam ? normalizeShopDomain(shopParam) : null;
  if (!shop) {
    return NextResponse.json({ ok: false, error: "shop is required" }, { status: 400 });
  }

  try {
    const result = await refreshProductMappingSnapshots(shop, externalProductId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof CommerceMappingError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 400 });
    }
    if (error instanceof CommerceSyncError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Failed to refresh mapping snapshots" }, { status: 500 });
  }
}
