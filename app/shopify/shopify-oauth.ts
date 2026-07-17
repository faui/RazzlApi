/** Normalize shop param to `{slug}.myshopify.com` (client-safe). */
export function normalizeShopDomainClient(shop: string): string | null {
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

/** Build OAuth session-start URL (sets cookies; use format=json for embedded clients). */
export function buildShopifyOAuthSessionUrl(
  apiPublicOrigin: string,
  shop: string,
  host?: string | null
): string {
  const origin = apiPublicOrigin.replace(/\/$/, "");
  const url = new URL(`${origin}/api/commerce/shopify/auth`);
  url.searchParams.set("shop", shop);
  url.searchParams.set("format", "json");
  if (host) {
    url.searchParams.set("host", host);
  }
  return url.toString();
}

const APP_BRIDGE_WAIT_MS = 5000;
const APP_BRIDGE_POLL_MS = 50;

/** Wait until App Bridge exposes redirect.remote (embedded admin iframe). */
export function whenAppBridgeReady(): Promise<boolean> {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (window.shopify?.redirect?.remote) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const started = Date.now();
    const poll = () => {
      if (window.shopify?.redirect?.remote) {
        resolve(true);
        return;
      }
      if (Date.now() - started >= APP_BRIDGE_WAIT_MS) {
        resolve(false);
        return;
      }
      window.setTimeout(poll, APP_BRIDGE_POLL_MS);
    };
    poll();
  });
}

async function fetchShopifyAuthorizeUrl(
  apiPublicOrigin: string,
  shop: string,
  host?: string | null
): Promise<string> {
  const sessionUrl = buildShopifyOAuthSessionUrl(apiPublicOrigin, shop, host);
  const response = await fetch(sessionUrl, {
    credentials: "include",
    headers: { Accept: "application/json" }
  });
  const data = (await response.json()) as { ok?: boolean; authorizeUrl?: string; error?: string };
  if (!response.ok || !data.ok || !data.authorizeUrl) {
    throw new Error(data.error ?? "Unable to start OAuth");
  }
  return data.authorizeUrl;
}

/** Navigate top-level window via anchor click (works with user gesture in some browsers). */
function navigateTopLevelViaAnchor(url: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_top";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * Start Shopify OAuth from embedded admin.
 * Must redirect directly to Shopify's authorize URL — never our API route inside the iframe.
 */
export async function startShopifyOAuthInstall(
  apiPublicOrigin: string,
  shop: string,
  host?: string | null,
  options?: { fromUserGesture?: boolean }
): Promise<boolean> {
  const authorizeUrl = await fetchShopifyAuthorizeUrl(apiPublicOrigin, shop, host);

  if (options?.fromUserGesture) {
    navigateTopLevelViaAnchor(authorizeUrl);
    return true;
  }

  const bridgeReady = await whenAppBridgeReady();
  if (bridgeReady && window.shopify?.redirect?.remote) {
    window.shopify.redirect.remote(authorizeUrl);
    return true;
  }

  navigateTopLevelViaAnchor(authorizeUrl);
  return true;
}

/** Resolve shop domain from URL params or App Bridge config. */
export function resolveEmbeddedShopDomain(initialShop: string | null): string | null {
  if (initialShop) {
    return normalizeShopDomainClient(initialShop);
  }

  if (typeof window === "undefined") {
    return null;
  }

  const fromUrl = new URLSearchParams(window.location.search).get("shop");
  if (fromUrl) {
    return normalizeShopDomainClient(fromUrl);
  }

  const fromBridge = window.shopify?.config?.shop;
  if (fromBridge) {
    return normalizeShopDomainClient(fromBridge);
  }

  return null;
}

/** Resolve host param from URL or App Bridge config. */
export function resolveEmbeddedHost(initialHost: string | null): string | null {
  if (initialHost) {
    return initialHost;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const fromUrl = new URLSearchParams(window.location.search).get("host");
  if (fromUrl) {
    return fromUrl;
  }

  return window.shopify?.config?.host ?? null;
}
