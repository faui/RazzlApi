import type { CommerceAdapterContext } from "@/lib/commerce/adapters/types";
import { CommerceAdapterError } from "@/lib/commerce/adapters/types";
import { getShopifyApiVersion } from "@/lib/commerce/config/shopify-env";

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function shopifyAdminGraphql<T>(
  context: CommerceAdapterContext,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const apiVersion = getShopifyApiVersion();
  const url = `https://${context.storeDomain}/admin/api/${apiVersion}/graphql.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": context.accessToken,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ query, variables })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new CommerceAdapterError(
      response.status === 429 ? "RATE_LIMITED" : "SHOPIFY_API_ERROR",
      `Shopify GraphQL ${response.status}: ${body.slice(0, 300)}`,
      response.status === 429,
      body
    );
  }

  const payload = (await response.json()) as GraphqlResponse<T>;
  if (payload.errors?.length) {
    throw new CommerceAdapterError(
      "SHOPIFY_GRAPHQL_ERROR",
      payload.errors.map((error) => error.message).join("; "),
      false,
      payload.errors
    );
  }

  if (!payload.data) {
    throw new CommerceAdapterError("SHOPIFY_GRAPHQL_ERROR", "GraphQL response missing data");
  }

  return payload.data;
}
