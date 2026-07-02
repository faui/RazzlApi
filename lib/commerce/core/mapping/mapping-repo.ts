import { commerceQuery } from "@/lib/commerce/core/db/query";
import { COMMERCE_TABLES } from "@/lib/commerce/types/enums";
import type { CommerceRazzlProductMappingRow } from "@/lib/commerce/types/commerce-razzl-product-mapping";

export async function ensureMappingForExternalProduct(
  connectionId: number,
  externalProductPk: number,
  externalProductId: string
): Promise<void> {
  await commerceQuery(
    `INSERT INTO ${COMMERCE_TABLES.razzlProductMapping} (
       commerce_platform_connection_fk,
       commerce_external_product_fk,
       external_product_id,
       product_fk,
       mapping_status,
       storefront_cta_enabled
     ) VALUES (?, ?, ?, NULL, 'unmapped', 0)
     ON DUPLICATE KEY UPDATE
       external_product_id = VALUES(external_product_id),
       updated_on = NOW()`,
    [connectionId, externalProductPk, externalProductId]
  );
}

export type ProductMappingListItem = {
  commerce_external_product_pk: number;
  external_product_id: string;
  external_handle: string | null;
  title: string;
  primary_image_url: string | null;
  status: string | null;
  deleted_on_platform_at: string | null;
  last_synced_at: string | null;
  commerce_razzl_product_mapping_pk: number | null;
  product_fk: number | null;
  razzl_code_snapshot: string | null;
  product_status_snapshot: string | null;
  launch_url_snapshot: string | null;
  edit_url_snapshot: string | null;
  mapping_status: string | null;
  storefront_cta_enabled: number | null;
  mapped_model_name: string | null;
};

export async function listProductMappings(
  connectionId: number
): Promise<ProductMappingListItem[]> {
  return commerceQuery<ProductMappingListItem[]>(
    `SELECT
       ep.commerce_external_product_pk,
       ep.external_product_id,
       ep.external_handle,
       ep.title,
       ep.primary_image_url,
       ep.status,
       ep.deleted_on_platform_at,
       ep.last_synced_at,
       m.commerce_razzl_product_mapping_pk,
       m.product_fk,
       m.razzl_code_snapshot,
       m.product_status_snapshot,
       m.launch_url_snapshot,
       m.edit_url_snapshot,
       m.mapping_status,
       m.storefront_cta_enabled,
       p.model_name AS mapped_model_name
     FROM ${COMMERCE_TABLES.externalProduct} ep
     LEFT JOIN ${COMMERCE_TABLES.razzlProductMapping} m
       ON m.commerce_external_product_fk = ep.commerce_external_product_pk
     LEFT JOIN product p ON p.product_pk = m.product_fk
     WHERE ep.commerce_platform_connection_fk = ?
       AND ep.deleted_on_platform_at IS NULL
     ORDER BY ep.title ASC`,
    [connectionId]
  );
}

export async function findMappingByExternalProductId(
  connectionId: number,
  externalProductId: string
): Promise<CommerceRazzlProductMappingRow | null> {
  const rows = await commerceQuery<CommerceRazzlProductMappingRow[]>(
    `SELECT m.*
     FROM ${COMMERCE_TABLES.razzlProductMapping} m
     WHERE m.commerce_platform_connection_fk = ?
       AND m.external_product_id = ?
     LIMIT 1`,
    [connectionId, externalProductId]
  );
  return rows[0] ?? null;
}

export async function updateMappingProduct(
  connectionId: number,
  externalProductId: string,
  productFk: number | null,
  snapshots: {
    razzlCode: string | null;
    productStatus: string | null;
    launchUrl: string | null;
    editUrl: string | null;
    mappingStatus: "unmapped" | "mapped" | "stale" | "error" | "disabled";
  }
): Promise<void> {
  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.razzlProductMapping} m
     INNER JOIN ${COMMERCE_TABLES.externalProduct} ep
       ON ep.commerce_external_product_pk = m.commerce_external_product_fk
     SET m.product_fk = ?,
         m.razzl_code_snapshot = ?,
         m.product_status_snapshot = ?,
         m.launch_url_snapshot = ?,
         m.edit_url_snapshot = ?,
         m.mapping_status = ?,
         m.last_verified_at = NOW(),
         m.updated_on = NOW()
     WHERE m.commerce_platform_connection_fk = ?
       AND ep.external_product_id = ?`,
    [
      productFk,
      snapshots.razzlCode,
      snapshots.productStatus,
      snapshots.launchUrl,
      snapshots.editUrl,
      snapshots.mappingStatus,
      connectionId,
      externalProductId
    ]
  );
}

export async function setStorefrontCtaEnabled(
  connectionId: number,
  externalProductId: string,
  enabled: boolean
): Promise<void> {
  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.razzlProductMapping} m
     INNER JOIN ${COMMERCE_TABLES.externalProduct} ep
       ON ep.commerce_external_product_pk = m.commerce_external_product_fk
     SET m.storefront_cta_enabled = ?,
         m.updated_on = NOW()
     WHERE m.commerce_platform_connection_fk = ?
       AND ep.external_product_id = ?`,
    [enabled ? 1 : 0, connectionId, externalProductId]
  );
}
