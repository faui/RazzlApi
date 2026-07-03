import { commerceQuery } from "@/lib/commerce/core/db/query";
import { COMMERCE_TABLES } from "@/lib/commerce/types/enums";
import { requireLinkedShopConnection } from "@/lib/commerce/core/connections/adapter-context";
import {
  buildEditCopilotUrl,
  buildLaunchUrl,
  CommerceMappingError,
  getChatKitBaseUrl,
  type StudioProductPickerItem
} from "@/lib/commerce/core/mapping/mapping-service";
import { updateMappingProduct } from "@/lib/commerce/core/mapping/mapping-repo";

export type MappingRefreshResult = {
  externalProductId: string;
  productPk: number;
  refreshed: boolean;
  mappingStatus: "mapped" | "error";
  productStatus: string | null;
};

async function loadTenantProduct(
  tenantPk: number,
  productPk: number
): Promise<StudioProductPickerItem | null> {
  const rows = await commerceQuery<StudioProductPickerItem[]>(
    `SELECT
       p.product_pk AS productPk,
       p.model_name AS modelName,
       p.model_number AS modelNumber,
       p.thumbnail_url AS thumbnailUrl,
       p.razzl_code AS razzlCode,
       mps.status_code AS statusCode
     FROM product p
     LEFT JOIN master_product_status mps ON mps.master_product_status_pk = p.master_product_status_fk
     WHERE p.tenant_fk = ? AND p.product_pk = ?
     LIMIT 1`,
    [tenantPk, productPk]
  );
  return rows[0] ?? null;
}

async function refreshOneMapping(
  connectionId: number,
  tenantPk: number,
  externalProductId: string,
  productPk: number,
  chatKitBaseUrl: string
): Promise<MappingRefreshResult> {
  const product = await loadTenantProduct(tenantPk, productPk);
  if (!product) {
    await updateMappingProduct(connectionId, externalProductId, productPk, {
      razzlCode: null,
      productStatus: null,
      launchUrl: null,
      editUrl: null,
      mappingStatus: "error"
    });
    return {
      externalProductId,
      productPk,
      refreshed: true,
      mappingStatus: "error",
      productStatus: null
    };
  }

  await updateMappingProduct(connectionId, externalProductId, productPk, {
    razzlCode: product.razzlCode,
    productStatus: product.statusCode,
    launchUrl: buildLaunchUrl(chatKitBaseUrl, product.razzlCode),
    editUrl: buildEditCopilotUrl(productPk),
    mappingStatus: "mapped"
  });

  return {
    externalProductId,
    productPk,
    refreshed: true,
    mappingStatus: "mapped",
    productStatus: product.statusCode
  };
}

/** Refresh mapping snapshots for one or all mapped products on a connection. */
export async function refreshMappingSnapshots(
  connectionId: number,
  tenantPk: number,
  externalProductId?: string
): Promise<MappingRefreshResult[]> {
  const params: unknown[] = [connectionId];
  let productFilter = "";
  if (externalProductId) {
    productFilter = "AND m.external_product_id = ?";
    params.push(externalProductId);
  }

  const rows = await commerceQuery<Array<{ external_product_id: string; product_fk: number }>>(
    `SELECT m.external_product_id, m.product_fk
     FROM ${COMMERCE_TABLES.razzlProductMapping} m
     WHERE m.commerce_platform_connection_fk = ?
       AND m.product_fk IS NOT NULL
       ${productFilter}`,
    params
  );

  if (rows.length === 0) {
    return [];
  }

  const chatKitBaseUrl = await getChatKitBaseUrl();
  const results: MappingRefreshResult[] = [];
  for (const row of rows) {
    results.push(
      await refreshOneMapping(
        connectionId,
        tenantPk,
        row.external_product_id,
        row.product_fk,
        chatKitBaseUrl
      )
    );
  }
  return results;
}

export async function refreshProductMappingSnapshots(
  shop: string,
  externalProductId?: string
): Promise<{ refreshed: number; results: MappingRefreshResult[] }> {
  const { connection } = await requireLinkedShopConnection(shop);
  const tenantPk = connection.tenant_fk;
  if (!tenantPk) {
    throw new CommerceMappingError("TENANT_NOT_LINKED", "Tenant is not linked");
  }

  const results = await refreshMappingSnapshots(
    connection.commerce_platform_connection_pk,
    tenantPk,
    externalProductId
  );
  return { refreshed: results.length, results };
}
