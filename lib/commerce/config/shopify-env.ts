/** Shopify app configuration from environment. */

export type ShopifyEnvConfig = {
  apiKey: string;
  apiSecret: string;
  scopes: string[];
  apiVersion: string;
  publicOrigin: string;
  oauthCallbackPath: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getShopifyEnvConfig(): ShopifyEnvConfig {
  const publicOrigin = requireEnv("RAZZL_PUBLIC_ORIGIN").replace(/\/$/, "");
  const oauthCallbackPath =
    process.env.SHOPIFY_OAUTH_CALLBACK_PATH?.trim() ?? "/api/commerce/shopify/auth/callback";

  return {
    apiKey: requireEnv("SHOPIFY_API_KEY"),
    apiSecret: requireEnv("SHOPIFY_API_SECRET"),
    scopes: (process.env.SHOPIFY_SCOPES ?? "read_products").split(",").map((s) => s.trim()).filter(Boolean),
    apiVersion: process.env.SHOPIFY_API_VERSION?.trim() ?? "2026-01",
    publicOrigin,
    oauthCallbackPath
  };
}

export function getShopifyOAuthRedirectUri(): string {
  const config = getShopifyEnvConfig();
  return `${config.publicOrigin}${config.oauthCallbackPath}`;
}

/** Normalize shop param to `{slug}.myshopify.com`. */
export function normalizeShopDomain(shop: string): string | null {
  const trimmed = shop.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const withDomain = trimmed.endsWith(".myshopify.com") ? trimmed : `${trimmed}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(withDomain)) {
    return null;
  }

  return withDomain;
}
