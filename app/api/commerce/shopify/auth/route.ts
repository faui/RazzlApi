import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildShopifyAuthorizeUrl,
  generateOAuthState,
  SHOPIFY_OAUTH_STATE_COOKIE
} from "@/lib/commerce/adapters/shopify/oauth";
import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";

const OAUTH_STATE_MAX_AGE = 600;

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

  const state = generateOAuthState();
  const cookieStore = await cookies();
  cookieStore.set(SHOPIFY_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: OAUTH_STATE_MAX_AGE,
    path: "/"
  });

  const authorizeUrl = buildShopifyAuthorizeUrl(shopDomain, state);
  return NextResponse.redirect(authorizeUrl);
}
