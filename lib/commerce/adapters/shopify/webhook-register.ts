import type {
  CommerceAdapterContext,
  WebhookRegistrationResult
} from "@/lib/commerce/adapters/types";
import { CommerceAdapterError } from "@/lib/commerce/adapters/types";

export const DEFAULT_SHOPIFY_WEBHOOK_TOPICS = [
  "products/create",
  "products/update",
  "products/delete",
  "app/uninstalled",
  "app_subscriptions/update",
  "app_subscriptions/cancelled",
  "customers/data_request",
  "customers/redact",
  "shop/redact"
] as const;

function getShopifyApiVersion(): string {
  return process.env.SHOPIFY_API_VERSION?.trim() ?? "2024-10";
}

async function registerSingleWebhook(
  context: CommerceAdapterContext,
  topic: string,
  callbackUrl: string
): Promise<void> {
  const apiVersion = getShopifyApiVersion();
  const url = `https://${context.storeDomain}/admin/api/${apiVersion}/webhooks.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": context.accessToken,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      webhook: {
        topic,
        address: callbackUrl,
        format: "json"
      }
    })
  });

  if (response.ok) {
    return;
  }

  const body = await response.text();
  if (response.status === 422 && /already been taken|already exists/i.test(body)) {
    return;
  }

  throw new CommerceAdapterError(
    response.status === 429 ? "RATE_LIMITED" : "SHOPIFY_API_ERROR",
    `Failed to register webhook ${topic}: ${response.status} ${body.slice(0, 300)}`,
    response.status === 429,
    body
  );
}

export async function registerShopifyWebhooks(
  context: CommerceAdapterContext,
  callbackUrl: string,
  topics: string[]
): Promise<WebhookRegistrationResult> {
  const registeredTopics: string[] = [];

  for (const topic of topics) {
    await registerSingleWebhook(context, topic, callbackUrl);
    registeredTopics.push(topic);
  }

  return { registeredTopics };
}
