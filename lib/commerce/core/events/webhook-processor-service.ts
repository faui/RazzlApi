import type { NormalizedCommerceEvent } from "@/lib/commerce/adapters/types";
import { getAdapter } from "@/lib/commerce/adapters/registry";
import {
  DEFAULT_SHOPIFY_WEBHOOK_TOPICS,
  registerShopifyWebhooks
} from "@/lib/commerce/adapters/shopify/webhook-register";
import {
  SHOPIFY_COMPLIANCE_WEBHOOK_TOPICS,
  SHOPIFY_BILLING_WEBHOOK_TOPICS,
  SHOPIFY_PRODUCT_WEBHOOK_TOPICS
} from "@/lib/commerce/adapters/shopify/webhooks";
import { getShopifyEnvConfig } from "@/lib/commerce/config/shopify-env";
import {
  applyShopifySubscriptionWebhook,
  markBillingCancelledOnUninstall
} from "@/lib/commerce/core/billing/billing-service";
import { ensureFreshShopifyConnection } from "@/lib/commerce/adapters/shopify/shopify-token-service";
import { buildAdapterContextFromConnection } from "@/lib/commerce/core/connections/adapter-context";
import {
  findConnectionByStoreDomain,
  markShopUninstalled
} from "@/lib/commerce/core/connections/platform-connection-repo";
import {
  DuplicatePlatformEventError,
  insertPlatformEvent,
  updatePlatformEventStatus
} from "@/lib/commerce/core/events/platform-event-repo";
import { applyWebhookProductEvent } from "@/lib/commerce/core/sync/sync-service";
import { traceLog } from "@/lib/logger";

export type ProcessShopifyWebhookInput = {
  shopDomain: string;
  topic: string;
  rawBody: string;
  signatureHeader: string;
};

export type ProcessShopifyWebhookResult = {
  duplicate: boolean;
  eventPk: number | null;
  processingStatus: "processed" | "ignored" | "failed";
};

export { DEFAULT_SHOPIFY_WEBHOOK_TOPICS };

export async function registerWebhooksForShop(shopDomain: string): Promise<void> {
  const connection = await findConnectionByStoreDomain(shopDomain);
  if (!connection || connection.install_status === "uninstalled") {
    return;
  }

  const freshConnection = await ensureFreshShopifyConnection(connection);
  const context = buildAdapterContextFromConnection(freshConnection);
  const config = getShopifyEnvConfig();
  const callbackUrl = `${config.publicOrigin}/api/commerce/shopify/webhooks`;

  await registerShopifyWebhooks(context, callbackUrl, [...DEFAULT_SHOPIFY_WEBHOOK_TOPICS]);

  traceLog(2, "shopify:webhooks:registered", {
    shop: shopDomain,
    topics: DEFAULT_SHOPIFY_WEBHOOK_TOPICS.length
  });
}

export async function processShopifyWebhook(
  input: ProcessShopifyWebhookInput
): Promise<ProcessShopifyWebhookResult> {
  const config = getShopifyEnvConfig();
  const adapter = getAdapter("shopify");
  const connection = await findConnectionByStoreDomain(input.shopDomain);

  const verified = await adapter.verifyWebhookSignature({
    context: {
      connectionId: connection?.commerce_platform_connection_pk ?? 0,
      tenantId: connection?.tenant_fk ?? null,
      externalStoreId: connection?.external_store_id ?? "",
      storeDomain: input.shopDomain,
      accessToken: "",
      scopes: []
    },
    rawBody: input.rawBody,
    signatureHeader: input.signatureHeader,
    webhookSecret: config.apiSecret
  });

  if (!verified) {
    throw new WebhookVerificationError("Invalid webhook signature");
  }

  const normalized = await adapter.normalizeWebhook({
    context: {
      connectionId: connection?.commerce_platform_connection_pk ?? 0,
      tenantId: connection?.tenant_fk ?? null,
      externalStoreId: connection?.external_store_id ?? "",
      storeDomain: input.shopDomain,
      accessToken: "",
      scopes: []
    },
    topic: input.topic,
    rawBody: input.rawBody,
    headers: {}
  });

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(input.rawBody) as unknown;
  } catch {
    rawPayload = input.rawBody;
  }

  let eventPk: number;
  try {
    eventPk = await insertPlatformEvent({
      connectionId: connection?.commerce_platform_connection_pk ?? null,
      platformType: "shopify",
      eventType: normalized.eventType,
      externalEventId: normalized.externalEventId,
      idempotencyKey: normalized.idempotencyKey,
      rawEventJson: rawPayload,
      normalizedEventJson: normalized
    });
  } catch (error) {
    if (error instanceof DuplicatePlatformEventError) {
      return { duplicate: true, eventPk: null, processingStatus: "processed" };
    }
    throw error;
  }

  try {
    const status = await dispatchWebhookEvent(
      input.shopDomain,
      connection?.commerce_platform_connection_pk ?? null,
      connection?.install_status ?? null,
      rawPayload,
      normalized
    );
    await updatePlatformEventStatus(eventPk, status);
    return { duplicate: false, eventPk, processingStatus: status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    await updatePlatformEventStatus(eventPk, "failed", message);
    throw error;
  }
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

async function dispatchWebhookEvent(
  shopDomain: string,
  connectionId: number | null,
  installStatus: string | null,
  rawPayload: unknown,
  event: NormalizedCommerceEvent
): Promise<"processed" | "ignored"> {
  if (SHOPIFY_COMPLIANCE_WEBHOOK_TOPICS.has(event.eventType)) {
    return "processed";
  }

  if (event.eventType === "app/uninstalled") {
    if (connectionId) {
      await markShopUninstalled(connectionId);
      await markBillingCancelledOnUninstall(connectionId);
    }
    return "processed";
  }

  if (SHOPIFY_BILLING_WEBHOOK_TOPICS.has(event.eventType)) {
    const envelope =
      typeof rawPayload === "object" && rawPayload !== null
        ? (rawPayload as { app_subscription?: Record<string, unknown> })
        : {};
    const subscriptionPayload = envelope.app_subscription ?? {};
    await applyShopifySubscriptionWebhook(
      shopDomain,
      "app_subscriptions/update",
      subscriptionPayload as Parameters<typeof applyShopifySubscriptionWebhook>[2]
    );
    return "processed";
  }

  if (SHOPIFY_PRODUCT_WEBHOOK_TOPICS.has(event.eventType)) {
    if (!connectionId || installStatus === "uninstalled") {
      return "ignored";
    }
    await applyWebhookProductEvent(connectionId, event);
    return "processed";
  }

  return "ignored";
}
