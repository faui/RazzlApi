import type {
  CommerceAdapterContext,
  NormalizedCommerceProduct,
  NormalizedCommerceProductPage
} from "@/lib/commerce/adapters/types";
import { CommerceAdapterError } from "@/lib/commerce/adapters/types";
import { getShopifyApiVersion } from "@/lib/commerce/config/shopify-env";
import {
  normalizeShopifyProduct,
  type ShopifyRestProduct
} from "@/lib/commerce/adapters/shopify/normalize";

type ShopifyProductsResponse = {
  products: ShopifyRestProduct[];
};

function parseNextPageCursor(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }

  for (const part of linkHeader.split(",")) {
    const trimmed = part.trim();
    if (!trimmed.endsWith('rel="next"')) {
      continue;
    }
    const match = trimmed.match(/<([^>]+)>/);
    if (!match) {
      continue;
    }
    const url = new URL(match[1]);
    return url.searchParams.get("page_info");
  }

  return null;
}

async function shopifyAdminFetch(
  context: CommerceAdapterContext,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const apiVersion = getShopifyApiVersion();
  const url = `https://${context.storeDomain}/admin/api/${apiVersion}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": context.accessToken,
      Accept: "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new CommerceAdapterError(
      response.status === 429 ? "RATE_LIMITED" : "SHOPIFY_API_ERROR",
      `Shopify API ${response.status}: ${body.slice(0, 300)}`,
      response.status === 429,
      body
    );
  }

  return response;
}

export async function fetchShopifyProductsPage(
  context: CommerceAdapterContext,
  options?: { pageCursor?: string | null; pageSize?: number }
): Promise<NormalizedCommerceProductPage> {
  const pageSize = Math.min(Math.max(options?.pageSize ?? 50, 1), 250);
  const params = new URLSearchParams({ limit: String(pageSize) });
  if (options?.pageCursor) {
    params.set("page_info", options.pageCursor);
  }

  const response = await shopifyAdminFetch(context, `/products.json?${params.toString()}`);
  const payload = (await response.json()) as ShopifyProductsResponse;
  const products = (payload.products ?? []).map((product) => normalizeShopifyProduct(product));

  return {
    products,
    nextPageCursor: parseNextPageCursor(response.headers.get("link"))
  };
}

export async function fetchShopifyProductById(
  context: CommerceAdapterContext,
  externalProductId: string
): Promise<NormalizedCommerceProduct | null> {
  try {
    const response = await shopifyAdminFetch(context, `/products/${externalProductId}.json`);
    const payload = (await response.json()) as { product?: ShopifyRestProduct };
    if (!payload.product) {
      return null;
    }
    return normalizeShopifyProduct(payload.product);
  } catch (error) {
    if (error instanceof CommerceAdapterError && error.code === "SHOPIFY_API_ERROR") {
      return null;
    }
    throw error;
  }
}
