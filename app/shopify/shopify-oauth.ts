/** Build OAuth install URL for a Shopify store domain. */
export function buildShopifyOAuthInstallUrl(apiPublicOrigin: string, shop: string): string {
  const origin = apiPublicOrigin.replace(/\/$/, "");
  return `${origin}/api/commerce/shopify/auth?shop=${encodeURIComponent(shop)}`;
}

/** Break out of the embedded admin iframe to start Shopify OAuth. */
export function startShopifyOAuthInstall(apiPublicOrigin: string, shop: string): void {
  const url = buildShopifyOAuthInstallUrl(apiPublicOrigin, shop);
  if (typeof window !== "undefined" && window.top) {
    window.top.location.href = url;
    return;
  }
  window.location.href = url;
}
