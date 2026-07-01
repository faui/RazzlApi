import { NextResponse } from "next/server";

import { verifyCommerceInternalLinkSecret } from "@/lib/commerce/config/studio-env";
import {
  CommerceConnectionError,
  completeTenantLink,
  unlinkTenantFromShop
} from "@/lib/commerce/core/connections/connection-service";
import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";

type LinkBody = {
  linkToken?: string;
  tenantPk?: number;
};

/** Complete tenant link (called from Studio with internal secret). */
export async function POST(request: Request) {
  if (!verifyCommerceInternalLinkSecret(request.headers.get("x-commerce-internal-key"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: LinkBody;
  try {
    body = (await request.json()) as LinkBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const linkToken = body.linkToken?.trim();
  const tenantPk = body.tenantPk;
  if (!linkToken || typeof tenantPk !== "number") {
    return NextResponse.json({ ok: false, error: "linkToken and tenantPk are required" }, { status: 400 });
  }

  try {
    const status = await completeTenantLink(linkToken, tenantPk);
    return NextResponse.json({ ok: true, connection: status });
  } catch (error) {
    if (error instanceof CommerceConnectionError) {
      const status =
        error.code === "ALREADY_LINKED" ? 409 : error.code === "INVALID_TOKEN" ? 401 : 400;
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ ok: false, error: "Failed to link tenant" }, { status: 500 });
  }
}

/** Unlink tenant from Shopify store (Studio-authenticated via internal secret). */
export async function DELETE(request: Request) {
  if (!verifyCommerceInternalLinkSecret(request.headers.get("x-commerce-internal-key"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

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
    const status = await unlinkTenantFromShop(shop);
    return NextResponse.json({ ok: true, connection: status });
  } catch (error) {
    if (error instanceof CommerceConnectionError) {
      const status = error.code === "NOT_INSTALLED" ? 404 : 400;
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status });
    }
    return NextResponse.json({ ok: false, error: "Failed to unlink tenant" }, { status: 500 });
  }
}
