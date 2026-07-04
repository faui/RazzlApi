import { NextResponse } from "next/server";

import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import {
  processShopifyWebhook,
  WebhookVerificationError
} from "@/lib/commerce/core/events/webhook-processor-service";
import { traceLog } from "@/lib/logger";

/** Shopify webhook receiver — raw body required for HMAC verification. */
export async function POST(request: Request) {
  const shopHeader = request.headers.get("x-shopify-shop-domain");
  const topic = request.headers.get("x-shopify-topic");
  const signatureHeader = request.headers.get("x-shopify-hmac-sha256");

  if (!shopHeader || !topic || !signatureHeader) {
    return NextResponse.json({ ok: false, error: "Missing Shopify webhook headers" }, { status: 400 });
  }

  const shop = normalizeShopDomain(shopHeader);
  if (!shop) {
    return NextResponse.json({ ok: false, error: "Invalid shop domain" }, { status: 400 });
  }

  const rawBody = await request.text();

  try {
    const result = await processShopifyWebhook({
      shopDomain: shop,
      topic,
      rawBody,
      signatureHeader
    });

    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      eventPk: result.eventPk,
      processingStatus: result.processingStatus
    });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      traceLog(1, "shopify:webhook:invalid_hmac", { shop, topic });
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    traceLog(1, "shopify:webhook:failed", {
      shop,
      topic,
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json({ ok: false, error: "Webhook processing failed" }, { status: 500 });
  }
}
