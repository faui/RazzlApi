import { commerceQuery } from "@/lib/commerce/core/db/query";
import type { NormalizedCommerceProduct } from "@/lib/commerce/adapters/types";
import { COMMERCE_TABLES } from "@/lib/commerce/types/enums";
import type { CommerceExternalProductRow } from "@/lib/commerce/types/commerce-external-product";

function buildSkuSummary(product: NormalizedCommerceProduct): string | null {
  const skus = product.variants
    .map((variant) => variant.sku?.trim())
    .filter((sku): sku is string => Boolean(sku));
  if (!skus.length) {
    return null;
  }
  const unique = [...new Set(skus)];
  return unique.slice(0, 3).join(", ") + (unique.length > 3 ? "…" : "");
}

export type UpsertExternalProductResult = {
  productPk: number;
  created: boolean;
};

export async function upsertExternalProduct(
  connectionId: number,
  platformType: "shopify",
  product: NormalizedCommerceProduct,
  syncedAt: Date
): Promise<UpsertExternalProductResult> {
  const existing = await findExternalProductByExternalId(connectionId, product.externalProductId);
  const tagsJson = product.tags.length ? JSON.stringify(product.tags) : null;
  const rawJson = JSON.stringify(product.rawPayload);
  const skuSummary = buildSkuSummary(product);
  const deletedAt = product.status === "archived" ? syncedAt : null;

  await commerceQuery(
    `INSERT INTO ${COMMERCE_TABLES.externalProduct} (
       commerce_platform_connection_fk,
       platform_type,
       external_product_id,
       external_handle,
       title,
       vendor_or_brand,
       product_type,
       status,
       primary_image_url,
       tags_json,
       sku_summary,
       raw_platform_payload_json,
       last_synced_at,
       deleted_on_platform_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       external_handle = VALUES(external_handle),
       title = VALUES(title),
       vendor_or_brand = VALUES(vendor_or_brand),
       product_type = VALUES(product_type),
       status = VALUES(status),
       primary_image_url = VALUES(primary_image_url),
       tags_json = VALUES(tags_json),
       sku_summary = VALUES(sku_summary),
       raw_platform_payload_json = VALUES(raw_platform_payload_json),
       last_synced_at = VALUES(last_synced_at),
       deleted_on_platform_at = VALUES(deleted_on_platform_at),
       updated_on = NOW()`,
    [
      connectionId,
      platformType,
      product.externalProductId,
      product.externalHandle,
      product.title,
      product.vendorOrBrand,
      product.productType,
      product.status,
      product.primaryImageUrl,
      tagsJson,
      skuSummary,
      rawJson,
      syncedAt,
      deletedAt
    ]
  );

  const rows = await commerceQuery<Array<{ commerce_external_product_pk: number }>>(
    `SELECT commerce_external_product_pk
     FROM ${COMMERCE_TABLES.externalProduct}
     WHERE commerce_platform_connection_fk = ? AND external_product_id = ?
     LIMIT 1`,
    [connectionId, product.externalProductId]
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to load external product after upsert");
  }

  return { productPk: row.commerce_external_product_pk, created: !existing };
}

export async function upsertExternalVariants(
  connectionId: number,
  externalProductPk: number,
  product: NormalizedCommerceProduct,
  syncedAt: Date
): Promise<number> {
  let count = 0;
  for (const variant of product.variants) {
    await commerceQuery(
      `INSERT INTO ${COMMERCE_TABLES.externalVariant} (
         commerce_platform_connection_fk,
         commerce_external_product_fk,
         external_product_id,
         external_variant_id,
         title,
         sku,
         barcode,
         status,
         option_values_json,
         raw_platform_payload_json,
         last_synced_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         title = VALUES(title),
         sku = VALUES(sku),
         barcode = VALUES(barcode),
         status = VALUES(status),
         option_values_json = VALUES(option_values_json),
         raw_platform_payload_json = VALUES(raw_platform_payload_json),
         last_synced_at = VALUES(last_synced_at),
         updated_on = NOW()`,
      [
        connectionId,
        externalProductPk,
        variant.externalProductId,
        variant.externalVariantId,
        variant.title,
        variant.sku,
        variant.barcode,
        variant.status,
        JSON.stringify(variant.optionValues),
        JSON.stringify(variant.rawPayload),
        syncedAt
      ]
    );
    count += 1;
  }
  return count;
}

export async function markExternalProductsAbsentSince(
  connectionId: number,
  syncStartedAt: Date
): Promise<number> {
  const stale = await commerceQuery<Array<{ commerce_external_product_pk: number }>>(
    `SELECT commerce_external_product_pk
     FROM ${COMMERCE_TABLES.externalProduct}
     WHERE commerce_platform_connection_fk = ?
       AND (last_synced_at IS NULL OR last_synced_at < ?)
       AND deleted_on_platform_at IS NULL`,
    [connectionId, syncStartedAt]
  );

  if (!stale.length) {
    return 0;
  }

  const ids = stale.map((row) => row.commerce_external_product_pk);
  const placeholders = ids.map(() => "?").join(",");
  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.externalProduct}
     SET deleted_on_platform_at = NOW(), updated_on = NOW()
     WHERE commerce_external_product_pk IN (${placeholders})`,
    ids
  );

  return stale.length;
}

export async function markExternalProductDeletedByExternalId(
  connectionId: number,
  externalProductId: string
): Promise<void> {
  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.externalProduct}
     SET deleted_on_platform_at = NOW(), updated_on = NOW()
     WHERE commerce_platform_connection_fk = ?
       AND external_product_id = ?
       AND deleted_on_platform_at IS NULL`,
    [connectionId, externalProductId]
  );
}

export async function findExternalProductByExternalId(
  connectionId: number,
  externalProductId: string
): Promise<CommerceExternalProductRow | null> {
  const rows = await commerceQuery<CommerceExternalProductRow[]>(
    `SELECT * FROM ${COMMERCE_TABLES.externalProduct}
     WHERE commerce_platform_connection_fk = ? AND external_product_id = ?
     LIMIT 1`,
    [connectionId, externalProductId]
  );
  return rows[0] ?? null;
}
