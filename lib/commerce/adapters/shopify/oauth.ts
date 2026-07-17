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

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthStatePayload = {
  n: string;
  shop: string;
  host: string | null;
  exp: number;
};

export type PreparedShopifyOAuthSession = {
  state: string;
  authorizeUrl: string;
};

/** @deprecated Cookie state is unreliable in embedded iframes — use signed state instead. */
export function generateOAuthState(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Signed OAuth state survives top-level callback redirects without cookies.
 * Embedded apps set cookies during iframe fetch, which browsers often drop before callback.
 */
export function createSignedOAuthState(shopDomain: string, host?: string | null): string {
  const payload: OAuthStatePayload = {
    n: randomBytes(16).toString("hex"),
    shop: shopDomain,
    host: host ?? null,
    exp: Date.now() + OAUTH_STATE_TTL_MS
  };
  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getShopifyEnvConfig().apiSecret)
    .update(payloadPart)
    .digest("base64url");
  return `${payloadPart}.${signature}`;
}

export function verifySignedOAuthState(state: string, shopDomain: string): OAuthStatePayload | null {
  const dotIndex = state.lastIndexOf(".");
  if (dotIndex <= 0) {
    return null;
  }

  const payloadPart = state.slice(0, dotIndex);
  const signature = state.slice(dotIndex + 1);
  const expected = createHmac("sha256", getShopifyEnvConfig().apiSecret)
    .update(payloadPart)
    .digest("base64url");

  try {
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as OAuthStatePayload;
  } catch {
    return null;
  }

  if (!payload.shop || payload.exp < Date.now() || payload.shop !== shopDomain) {
    return null;
  }

  return payload;
}

/** Generate OAuth state + Shopify authorize URL for a shop domain. */
export function prepareShopifyOAuthSession(
  shopDomain: string,
  host?: string | null
): PreparedShopifyOAuthSession {
  const state = createSignedOAuthState(shopDomain, host);
  const authorizeUrl = buildShopifyAuthorizeUrl(shopDomain, state);
  return { state, authorizeUrl };
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
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
};

export type ShopifyOfflineTokenResult = {
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  scopeHeader?: string;
};

function formatShopifyOAuthErrorBody(rawBody: string): string {
  if (!rawBody) {
    return "empty response body";
  }

  try {
    const parsed = JSON.parse(rawBody) as { error?: string; error_description?: string };
    const parts = [parsed.error, parsed.error_description].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(": ");
    }
  } catch {
    /* fall through to raw text */
  }

  return rawBody.slice(0, 300);
}

/** Exchange OAuth authorization code for offline access token. */
export async function exchangeShopifyAuthCode(
  input: ExchangeAuthCodeInput
): Promise<AuthResult> {
  const config = getShopifyEnvConfig();
  const shopDomain = normalizeShopDomain(input.shopDomain);
  if (!shopDomain) {
    throw new CommerceAdapterError("INVALID_SHOP", "Invalid shop domain", false);
  }

  const tokenRequestBody = new URLSearchParams({
    client_id: config.apiKey,
    client_secret: config.apiSecret,
    code: input.authCode,
    expiring: "1"
  });

  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: tokenRequestBody.toString()
  });

  const responseText = await response.text();
  if (!response.ok) {
    const detail = formatShopifyOAuthErrorBody(responseText);
    throw new CommerceAdapterError(
      "TOKEN_EXCHANGE_FAILED",
      `Shopify token exchange failed (${response.status}): ${detail}`,
      response.status >= 500,
      responseText
    );
  }

  let body: ShopifyAccessTokenResponse;
  try {
    body = JSON.parse(responseText) as ShopifyAccessTokenResponse;
  } catch {
    throw new CommerceAdapterError(
      "TOKEN_EXCHANGE_FAILED",
      "Shopify token exchange returned invalid JSON",
      false,
      responseText
    );
  }

  if (!body.access_token) {
    throw new CommerceAdapterError(
      "TOKEN_EXCHANGE_FAILED",
      "Shopify token exchange response missing access_token",
      false,
      body
    );
  }

  if (!body.refresh_token || !body.expires_in || !body.refresh_token_expires_in) {
    throw new CommerceAdapterError(
      "TOKEN_EXCHANGE_FAILED",
      "Shopify token exchange response missing expiring offline token fields (refresh_token, expires_in, refresh_token_expires_in)",
      false,
      body
    );
  }

  const tokenResult = parseShopifyOfflineTokenResponse(body);
  const shop = await fetchShopifyShopIdentity(shopDomain, tokenResult.accessToken);

  return {
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken,
    scopes: tokenResult.scopes,
    externalStoreId: shop.externalStoreId,
    storeDomain: shop.storeDomain,
    storeDisplayName: shop.storeDisplayName,
    rawPayload: {
      token: {
        scope: tokenResult.scopeHeader ?? "",
        accessExpiresAt: tokenResult.accessTokenExpiresAt,
        refreshExpiresAt: tokenResult.refreshTokenExpiresAt
      },
      shop: shop.rawPayload
    }
  };
}

function parseShopifyOfflineTokenResponse(body: ShopifyAccessTokenResponse): ShopifyOfflineTokenResult {
  const scopes = (body.scope ?? "")
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  const now = Date.now();
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token!,
    scopes,
    scopeHeader: body.scope,
    accessTokenExpiresAt: now + (body.expires_in ?? 0) * 1000,
    refreshTokenExpiresAt: now + (body.refresh_token_expires_in ?? 0) * 1000
  };
}

/** Refresh an expiring Shopify offline access token. */
export async function refreshShopifyOfflineAccessToken(
  shopDomainInput: string,
  refreshToken: string
): Promise<ShopifyOfflineTokenResult> {
  const config = getShopifyEnvConfig();
  const shopDomain = normalizeShopDomain(shopDomainInput);
  if (!shopDomain) {
    throw new CommerceAdapterError("INVALID_SHOP", "Invalid shop domain", false);
  }

  const tokenRequestBody = new URLSearchParams({
    client_id: config.apiKey,
    client_secret: config.apiSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });

  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: tokenRequestBody.toString()
  });

  const responseText = await response.text();
  if (!response.ok) {
    const detail = formatShopifyOAuthErrorBody(responseText);
    throw new CommerceAdapterError(
      "TOKEN_REFRESH_FAILED",
      `Shopify token refresh failed (${response.status}): ${detail}`,
      response.status >= 500 || response.status === 429,
      responseText
    );
  }

  let body: ShopifyAccessTokenResponse;
  try {
    body = JSON.parse(responseText) as ShopifyAccessTokenResponse;
  } catch {
    throw new CommerceAdapterError(
      "TOKEN_REFRESH_FAILED",
      "Shopify token refresh returned invalid JSON",
      false,
      responseText
    );
  }

  if (!body.access_token || !body.refresh_token || !body.expires_in || !body.refresh_token_expires_in) {
    throw new CommerceAdapterError(
      "TOKEN_REFRESH_FAILED",
      "Shopify token refresh response missing expiring offline token fields",
      false,
      body
    );
  }

  return parseShopifyOfflineTokenResponse(body);
}

type ShopifyGraphqlShopResponse = {
  data?: {
    shop?: {
      id: string;
      legacyResourceId: string;
      name: string;
      myshopifyDomain: string;
    };
  };
  errors?: Array<{ message: string }>;
};

/** Fetch shop identity via Admin GraphQL after token exchange. */
export async function fetchShopifyShopIdentity(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyShopIdentity> {
  const config = getShopifyEnvConfig();
  const response = await fetch(
    `https://${shopDomain}/admin/api/${config.apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        query: "query { shop { id legacyResourceId name myshopifyDomain } }"
      })
    }
  );

  const responseText = await response.text();
  if (!response.ok) {
    throw new CommerceAdapterError(
      "SHOP_FETCH_FAILED",
      `Failed to fetch shop identity (${response.status}): ${responseText.slice(0, 300)}`,
      response.status >= 500,
      responseText
    );
  }

  let payload: ShopifyGraphqlShopResponse;
  try {
    payload = JSON.parse(responseText) as ShopifyGraphqlShopResponse;
  } catch {
    throw new CommerceAdapterError(
      "SHOP_FETCH_FAILED",
      "Shopify shop identity response was not valid JSON",
      false,
      responseText
    );
  }

  if (payload.errors?.length) {
    throw new CommerceAdapterError(
      "SHOP_FETCH_FAILED",
      payload.errors.map((error) => error.message).join("; "),
      false,
      payload.errors
    );
  }

  const shop = payload.data?.shop;
  if (!shop?.legacyResourceId) {
    throw new CommerceAdapterError(
      "SHOP_FETCH_FAILED",
      "Shopify shop identity response missing shop data",
      false,
      payload
    );
  }

  return {
    externalStoreId: shop.legacyResourceId,
    storeDomain: shop.myshopifyDomain ?? shopDomain,
    storeDisplayName: shop.name ?? null,
    rawPayload: shop
  };
}
