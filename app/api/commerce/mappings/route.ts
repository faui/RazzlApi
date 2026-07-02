import { NextResponse } from "next/server";

import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import {
  CommerceMappingError,
  mapExternalProductToRazzlProduct,
  toggleExternalProductCta,
  unmapExternalProduct,
  type ProductMappingListItem
} from "@/lib/commerce/core/mapping/mapping-service";

type MapBody = {
  shop?: string;
  externalProductId?: string;
  productPk?: number;
};

type CtaBody = {
  shop?: string;
  externalProductId?: string;
  enabled?: boolean;
};

function mapItems(items: ProductMappingListItem[]) {
  return items.map((item) => ({
    externalProductId: item.external_product_id,
    title: item.title,
    mappingStatus: item.mapping_status ?? "unmapped",
    productPk: item.product_fk,
    mappedModelName: item.mapped_model_name,
    copilotStatus: item.product_status_snapshot,
    launchUrl: item.launch_url_snapshot,
    editUrl: item.edit_url_snapshot,
    storefrontCtaEnabled: Boolean(item.storefront_cta_enabled)
  }));
}

export async function POST(request: Request) {
  let body: MapBody;
  try {
    body = (await request.json()) as MapBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const shop = body.shop ? normalizeShopDomain(body.shop) : null;
  const externalProductId = body.externalProductId?.trim();
  const productPk = body.productPk;

  if (!shop || !externalProductId || typeof productPk !== "number") {
    return NextResponse.json(
      { ok: false, error: "shop, externalProductId, and productPk are required" },
      { status: 400 }
    );
  }

  try {
    const items = await mapExternalProductToRazzlProduct(shop, externalProductId, productPk);
    return NextResponse.json({ ok: true, items: mapItems(items) });
  } catch (error) {
    if (error instanceof CommerceMappingError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Failed to map product" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const externalProductId = url.searchParams.get("externalProductId");
  const normalizedShop = shop ? normalizeShopDomain(shop) : null;

  if (!normalizedShop || !externalProductId) {
    return NextResponse.json(
      { ok: false, error: "shop and externalProductId are required" },
      { status: 400 }
    );
  }

  try {
    const items = await unmapExternalProduct(normalizedShop, externalProductId);
    return NextResponse.json({ ok: true, items: mapItems(items) });
  } catch (error) {
    if (error instanceof CommerceMappingError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Failed to unmap product" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let body: CtaBody;
  try {
    body = (await request.json()) as CtaBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const shop = body.shop ? normalizeShopDomain(body.shop) : null;
  const externalProductId = body.externalProductId?.trim();
  if (!shop || !externalProductId || typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "shop, externalProductId, and enabled are required" },
      { status: 400 }
    );
  }

  try {
    const items = await toggleExternalProductCta(shop, externalProductId, body.enabled);
    return NextResponse.json({ ok: true, items: mapItems(items) });
  } catch (error) {
    if (error instanceof CommerceMappingError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Failed to update CTA" }, { status: 500 });
  }
}
