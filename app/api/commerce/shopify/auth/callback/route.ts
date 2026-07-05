import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  exchangeShopifyAuthCode,
  SHOPIFY_OAUTH_STATE_COOKIE,
  verifyShopifyOAuthHmac
} from "@/lib/commerce/adapters/shopify/oauth";
import { getShopifyEnvConfig, normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import { upsertShopifyInstall } from "@/lib/commerce/core/connections/platform-connection-repo";
import { encryptPlatformToken } from "@/lib/commerce/core/crypto/token-crypto";
import { registerWebhooksForShop } from "@/lib/commerce/core/events/webhook-processor-service";
import { traceLog } from "@/lib/logger";

function queryParamsFromUrl(url: URL): Record<string, string> {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

/** Shopify OAuth callback — validate HMAC, store encrypted token, redirect to embedded home. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = queryParamsFromUrl(url);

  const { code, state, shop, hmac } = params;
  if (!code || !state || !shop || !hmac) {
    return NextResponse.json({ ok: false, error: "Missing OAuth parameters" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(SHOPIFY_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(SHOPIFY_OAUTH_STATE_COOKIE);

  if (!expectedState || expectedState !== state) {
    traceLog(1, "shopify:oauth:invalid_state", { shop });
    return NextResponse.json({ ok: false, error: "Invalid OAuth state" }, { status: 403 });
  }

  const config = getShopifyEnvConfig();
  if (!verifyShopifyOAuthHmac(params, config.apiSecret)) {
    traceLog(1, "shopify:oauth:invalid_hmac", { shop });
    return NextResponse.json({ ok: false, error: "Invalid HMAC" }, { status: 401 });
  }

  const shopDomain = normalizeShopDomain(shop);
  if (!shopDomain) {
    return NextResponse.json({ ok: false, error: "Invalid shop domain" }, { status: 400 });
  }

  try {
    const authResult = await exchangeShopifyAuthCode({ shopDomain, authCode: code });
    const accessTokenEncrypted = encryptPlatformToken(authResult.accessToken);

    await upsertShopifyInstall({
      externalStoreId: authResult.externalStoreId,
      storeDomain: authResult.storeDomain,
      storeDisplayName: authResult.storeDisplayName ?? null,
      accessTokenEncrypted,
      scopes: authResult.scopes,
      acquisitionSource: "shopify_app_store",
      rawPlatformPayload: authResult.rawPayload
    });

    try {
      await registerWebhooksForShop(shopDomain);
    } catch (registerError) {
      traceLog(1, "shopify:webhooks:register_failed", {
        shop: shopDomain,
        error: registerError instanceof Error ? registerError.message : String(registerError)
      });
    }

    const redirectUrl = new URL("/shopify", config.publicOrigin);
    redirectUrl.searchParams.set("shop", shopDomain);
    return NextResponse.redirect(redirectUrl.toString());
  } catch (error) {
    traceLog(1, "shopify:oauth:callback_failed", {
      shop: shopDomain,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ ok: false, error: "OAuth callback failed" }, { status: 500 });
  }
}
