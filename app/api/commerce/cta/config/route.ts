import { NextResponse } from "next/server";

import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import { CommerceSyncError, requireLinkedShopConnection } from "@/lib/commerce/core/connections/adapter-context";
import {
  getOrCreateStorefrontCtaConfig,
  updateStorefrontCtaConfig
} from "@/lib/commerce/core/cta/cta-config-repo";
import { shopifyAdapter } from "@/lib/commerce/adapters/shopify";
import type { CommerceCtaOpenMode, CommerceCtaStyleMode } from "@/lib/commerce/types/enums";

function serializeConfig(row: Awaited<ReturnType<typeof getOrCreateStorefrontCtaConfig>>) {
  return {
    ctaEnabledDefault: Boolean(row.cta_enabled_default),
    ctaLabelDefault: row.cta_label_default,
    ctaOpenMode: row.cta_open_mode,
    ctaStyleMode: row.cta_style_mode,
    showPoweredByRazzl: Boolean(row.show_powered_by_razzl),
    fallbackBehavior: row.fallback_behavior
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  const shop = shopParam ? normalizeShopDomain(shopParam) : null;
  if (!shop) {
    return NextResponse.json({ ok: false, error: "Missing shop parameter" }, { status: 400 });
  }

  try {
    const { connection, context } = await requireLinkedShopConnection(shop);
    const config = await getOrCreateStorefrontCtaConfig(
      connection.commerce_platform_connection_pk,
      connection.platform_type
    );
    const themeInstructions = await shopifyAdapter.getStorefrontCtaPlacementInstructions({
      context
    });

    return NextResponse.json({
      ok: true,
      config: serializeConfig(config),
      themeInstructions
    });
  } catch (error) {
    if (error instanceof CommerceSyncError) {
      const httpStatus = error.code === "NOT_INSTALLED" ? 404 : error.code === "TENANT_NOT_LINKED" ? 409 : 400;
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Failed to load CTA settings" }, { status: 500 });
  }
}

type PatchBody = {
  shop?: string;
  ctaLabelDefault?: string;
  ctaOpenMode?: CommerceCtaOpenMode;
  ctaStyleMode?: CommerceCtaStyleMode;
  showPoweredByRazzl?: boolean;
};

export async function PATCH(request: Request) {
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const shop = body.shop ? normalizeShopDomain(body.shop) : null;
  if (!shop) {
    return NextResponse.json({ ok: false, error: "shop is required" }, { status: 400 });
  }

  try {
    const { connection } = await requireLinkedShopConnection(shop);
    await getOrCreateStorefrontCtaConfig(
      connection.commerce_platform_connection_pk,
      connection.platform_type
    );

    const updated = await updateStorefrontCtaConfig(connection.commerce_platform_connection_pk, {
      ...(body.ctaLabelDefault !== undefined ? { cta_label_default: body.ctaLabelDefault.trim() } : {}),
      ...(body.ctaOpenMode !== undefined ? { cta_open_mode: body.ctaOpenMode } : {}),
      ...(body.ctaStyleMode !== undefined ? { cta_style_mode: body.ctaStyleMode } : {}),
      ...(body.showPoweredByRazzl !== undefined
        ? { show_powered_by_razzl: body.showPoweredByRazzl ? 1 : 0 }
        : {})
    });

    return NextResponse.json({ ok: true, config: serializeConfig(updated) });
  } catch (error) {
    if (error instanceof CommerceSyncError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Failed to update CTA settings" }, { status: 500 });
  }
}
