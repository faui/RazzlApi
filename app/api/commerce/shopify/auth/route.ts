import { NextResponse } from "next/server";

import { prepareShopifyOAuthSession } from "@/lib/commerce/adapters/shopify/oauth";
import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";

function wantsJsonResponse(request: Request, url: URL): boolean {
  if (url.searchParams.get("format") === "json") {
    return true;
  }
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

/** Start Shopify OAuth install — redirect merchant to authorize URL. */
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

  const host = url.searchParams.get("host");
  const { authorizeUrl } = prepareShopifyOAuthSession(shopDomain, host);

  if (wantsJsonResponse(request, url)) {
    return NextResponse.json({ ok: true, authorizeUrl });
  }

  return NextResponse.redirect(authorizeUrl);
}
