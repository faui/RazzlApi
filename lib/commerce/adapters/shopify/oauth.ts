import { createHmac, randomBytes, timingSafeEqual } from "crypto";

import {
  getShopifyEnvConfig,
  getShopifyOAuthRedirectUri,
  normalizeShopDomain
} from "@/lib/commerce/config/shopify-env";
import type { AuthResult } from "@/lib/commerce/adapters/types";
import { CommerceAdapterError } from "@/lib/commerce/adapters/types";

export type ShopifyOAuthCallbackParams = Record<string, string>;

export type ShopifyShopIdentity = {
  externalStoreId: string;
  storeDomain: string;
  storeDisplayName: string | null;
  rawPayload: unknown;
};

export const SHOPIFY_OAUTH_STATE_COOKIE = "shopify_oauth_state";
export const SHOPIFY_OAUTH_HOST_COOKIE = "shopify_oauth_host";

export type PreparedShopifyOAuthSession = {
  state: string;
  authorizeUrl: string;
};

/** Generate OAuth state + Shopify authorize URL for a shop domain. */
export function prepareShopifyOAuthSession(shopDomain: string): PreparedShopifyOAuthSession {
  const state = generateOAuthState();
  const authorizeUrl = buildShopifyAuthorizeUrl(shopDomain, state);
  return { state, authorizeUrl };
}

export function generateOAuthState(): string {
  return randomBytes(16).toString("hex");
}

/** Build Shopify OAuth authorize URL for offline token install. */
export function buildShopifyAuthorizeUrl(shopDomain: string, state: string): string {
  const config = getShopifyEnvConfig();
  const redirectUri = getShopifyOAuthRedirectUri();
  const params = new URLSearchParams({
    client_id: config.apiKey,
    scope: config.scopes.join(","),
    redirect_uri: redirectUri,
    state
  });

  return `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;
}

/**
 * Verify Shopify OAuth callback HMAC (query string, hex digest).
 * @see https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
 */
export function verifyShopifyOAuthHmac(
  queryParams: ShopifyOAuthCallbackParams,
  apiSecret: string
): boolean {
  const hmac = queryParams.hmac;
  if (!hmac) {
    return false;
  }

  const message = Object.entries(queryParams)
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const computed = createHmac("sha256", apiSecret).update(message).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(computed, "utf8"), Buffer.from(hmac, "utf8"));
  } catch {
    return false;
  }
}

export type ExchangeAuthCodeInput = {
  shopDomain: string;
  authCode: string;
};

export type ShopifyAccessTokenResponse = {
  access_token: string;
  scope: string;
};

/** Exchange OAuth authorization code for offline access token. */
export async function exchangeShopifyAuthCode(
  input: ExchangeAuthCodeInput
): Promise<AuthResult> {
  const config = getShopifyEnvConfig();
  const shopDomain = normalizeShopDomain(input.shopDomain);
  if (!shopDomain) {
    throw new CommerceAdapterError("INVALID_SHOP", "Invalid shop domain", false);
  }

  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: config.apiKey,
      client_secret: config.apiSecret,
      code: input.authCode
    })
  });

  if (!response.ok) {
    throw new CommerceAdapterError(
      "TOKEN_EXCHANGE_FAILED",
      `Shopify token exchange failed (${response.status})`,
      response.status >= 500
    );
  }

  const body = (await response.json()) as ShopifyAccessTokenResponse;
  const scopes = body.scope.split(",").map((scope) => scope.trim()).filter(Boolean);

  const shop = await fetchShopifyShopIdentity(shopDomain, body.access_token);

  return {
    accessToken: body.access_token,
    scopes,
    externalStoreId: shop.externalStoreId,
    storeDomain: shop.storeDomain,
    storeDisplayName: shop.storeDisplayName,
    rawPayload: { token: { scope: body.scope }, shop: shop.rawPayload }
  };
}

/** Fetch shop identity via Admin REST API after token exchange. */
export async function fetchShopifyShopIdentity(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyShopIdentity> {
  const config = getShopifyEnvConfig();
  const response = await fetch(
    `https://${shopDomain}/admin/api/${config.apiVersion}/shop.json`,
    {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new CommerceAdapterError(
      "SHOP_FETCH_FAILED",
      `Failed to fetch shop identity (${response.status})`,
      response.status >= 500
    );
  }

  const body = (await response.json()) as { shop: { id: number | string; name?: string; myshopify_domain?: string } };
  const shop = body.shop;

  return {
    externalStoreId: String(shop.id),
    storeDomain: shop.myshopify_domain ?? shopDomain,
    storeDisplayName: shop.name ?? null,
    rawPayload: shop
  };
}
