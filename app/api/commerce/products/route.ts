import { NextResponse } from "next/server";

import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import {
  CommerceMappingError,
  getProductMappingBoard
} from "@/lib/commerce/core/mapping/mapping-service";
import { CommerceSyncError } from "@/lib/commerce/core/connections/adapter-context";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  if (!shopParam) {
    return NextResponse.json({ ok: false, error: "Missing shop parameter" }, { status: 400 });
  }

  const shop = normalizeShopDomain(shopParam);
  if (!shop) {
    return NextResponse.json({ ok: false, error: "Invalid shop domain" }, { status: 400 });
  }

  try {
    const board = await getProductMappingBoard(shop);
    return NextResponse.json({
      ok: true,
      shop,
      studioDashboardUrl: board.studioDashboardUrl,
      studioCreateCopilotUrl: board.studioCreateCopilotUrl,
      studioProducts: board.studioProducts,
      items: board.items.map((item) => ({
        externalProductId: item.external_product_id,
        title: item.title,
        handle: item.external_handle,
        imageUrl: item.primary_image_url,
        shopifyStatus: item.status,
        lastSyncedAt: item.last_synced_at,
        mappingStatus: item.mapping_status ?? "unmapped",
        productPk: item.product_fk,
        mappedModelName: item.mapped_model_name,
        razzlCode: item.razzl_code_snapshot,
        copilotStatus: item.product_status_snapshot,
        launchUrl: item.launch_url_snapshot,
        editUrl: item.edit_url_snapshot,
        storefrontCtaEnabled: Boolean(item.storefront_cta_enabled)
      }))
    });
  } catch (error) {
    if (error instanceof CommerceSyncError || error instanceof CommerceMappingError) {
      const code = error.code;
      const httpStatus =
        code === "NOT_INSTALLED" ? 404 : code === "TENANT_NOT_LINKED" ? 409 : 400;
      return NextResponse.json({ ok: false, error: error.message, code }, { status: httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Failed to load products" }, { status: 500 });
  }
}
