import { NextResponse } from "next/server";

import { exchangeShopifySessionToken } from "@/lib/commerce/adapters/shopify/oauth";
import { mapOAuthCallbackFailure } from "@/lib/commerce/adapters/shopify/oauth-errors";
import {
  buildPersistPayloadFromOfflineTokenResult,
  deriveTokenStatus
} from "@/lib/commerce/adapters/shopify/shopify-token-service";
import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import {
  findConnectionByStoreDomain,
  persistShopifyOAuthTokens
} from "@/lib/commerce/core/connections/platform-connection-repo";
import { traceLog } from "@/lib/logger";

type SessionTokenExchangeBody = {
  shop?: string;
  sessionToken?: string;
};

/** Exchange App Bridge session token for refreshed expiring offline tokens. */
export async function POST(request: Request) {
  let body: SessionTokenExchangeBody;
  try {
    body = (await request.json()) as SessionTokenExchangeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const shop = body.shop ? normalizeShopDomain(body.shop) : null;
  const sessionToken = body.sessionToken?.trim();

  if (!shop || !sessionToken) {
    return NextResponse.json(
      { ok: false, error: "shop and sessionToken are required" },
      { status: 400 }
    );
  }

  const connection = await findConnectionByStoreDomain(shop);
  if (!connection || connection.install_status === "uninstalled") {
    return NextResponse.json({ ok: false, error: "Shopify store is not installed" }, { status: 404 });
  }

  try {
    const tokenResult = await exchangeShopifySessionToken(shop, sessionToken);
    const persistPayload = buildPersistPayloadFromOfflineTokenResult({
      connection,
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      scopes: tokenResult.scopes,
      scopeHeader: tokenResult.scopeHeader,
      accessExpiresAt: tokenResult.accessTokenExpiresAt,
      refreshExpiresAt: tokenResult.refreshTokenExpiresAt
    });

    await persistShopifyOAuthTokens({
      connectionId: connection.commerce_platform_connection_pk,
      accessTokenEncrypted: persistPayload.accessTokenEncrypted,
      refreshTokenEncrypted: persistPayload.refreshTokenEncrypted,
      scopes: persistPayload.scopes,
      rawPlatformPayload: persistPayload.rawPlatformPayload
    });

    const refreshedConnection = await findConnectionByStoreDomain(shop);
    const tokenStatus = refreshedConnection ? deriveTokenStatus(refreshedConnection) : "ok";

    return NextResponse.json({
      ok: true,
      tokenStatus
    });
  } catch (error) {
    const mapped = mapOAuthCallbackFailure(error);
    traceLog(1, "shopify:session_token:exchange_failed", {
      shop,
      code: mapped.body.code,
      error: mapped.body.error
    });
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
