import { commerceQuery } from "@/lib/commerce/core/db/query";
import { getStudioPublicOrigin } from "@/lib/commerce/config/studio-env";
import {
  findMappingByExternalProductId,
  listProductMappings,
  setStorefrontCtaEnabled,
  updateMappingProduct,
  type ProductMappingListItem
} from "@/lib/commerce/core/mapping/mapping-repo";
import {
  CommerceSyncError,
  requireLinkedShopConnection
} from "@/lib/commerce/core/connections/adapter-context";

export class CommerceMappingError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "CommerceMappingError";
  }
}

export type StudioProductPickerItem = {
  productPk: number;
  modelName: string;
  modelNumber: string | null;
  thumbnailUrl: string | null;
  razzlCode: string;
  statusCode: string | null;
};

const DEFAULT_CHATKIT_BASE_URL = "https://chat-dev.razzl.com/razzlchatkit.html";

export async function getChatKitBaseUrl(): Promise<string> {
  const rows = await commerceQuery<Array<{ config_value_varchar: string | null }>>(
    `SELECT config_value_varchar
     FROM master_app_config
     WHERE config_key = 'admin.chatkit_base_url' AND is_active = 1
     LIMIT 1`
  );
  const value = rows[0]?.config_value_varchar?.trim();
  return value || process.env.RAZZL_CHATKIT_BASE_URL?.trim() || DEFAULT_CHATKIT_BASE_URL;
}

export function buildLaunchUrl(chatKitBaseUrl: string, razzlCode: string): string {
  const separator = chatKitBaseUrl.includes("?") ? "&" : "?";
  return `${chatKitBaseUrl}${separator}razzl_code_product=${encodeURIComponent(razzlCode)}&launchsource=shopify`;
}

export function buildEditCopilotUrl(productPk: number): string {
  return `${getStudioPublicOrigin()}/app/products/${productPk}/edit`;
}

export function buildStudioDashboardUrl(): string {
  return `${getStudioPublicOrigin()}/app/dashboard`;
}

export async function listStudioProductsForTenant(
  tenantPk: number,
  search?: string
): Promise<StudioProductPickerItem[]> {
  const params: unknown[] = [tenantPk];
  let searchClause = "";
  if (search?.trim()) {
    searchClause = "AND (p.model_name LIKE ? OR p.model_number LIKE ? OR p.razzl_code LIKE ?)";
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  return commerceQuery<StudioProductPickerItem[]>(
    `SELECT
       p.product_pk AS productPk,
       p.model_name AS modelName,
       p.model_number AS modelNumber,
       p.thumbnail_url AS thumbnailUrl,
       p.razzl_code AS razzlCode,
       mps.status_code AS statusCode
     FROM product p
     LEFT JOIN master_product_status mps ON mps.master_product_status_pk = p.master_product_status_fk
     WHERE p.tenant_fk = ?
       ${searchClause}
     ORDER BY p.model_name ASC
     LIMIT 100`,
    params
  );
}

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

export async function mapExternalProductToRazzlProduct(
  shop: string,
  externalProductId: string,
  productPk: number
): Promise<ProductMappingListItem[]> {
  const { connection } = await requireLinkedShopConnection(shop);
  const tenantPk = connection.tenant_fk;
  if (!tenantPk) {
    throw new CommerceMappingError("TENANT_NOT_LINKED", "Tenant is not linked");
  }

  const product = await loadTenantProduct(tenantPk, productPk);
  if (!product) {
    throw new CommerceMappingError("PRODUCT_NOT_FOUND", "Razzl product not found for this tenant");
  }

  const existing = await findMappingByExternalProductId(
    connection.commerce_platform_connection_pk,
    externalProductId
  );
  if (!existing) {
    throw new CommerceMappingError("MAPPING_NOT_FOUND", "Import this product via sync before mapping");
  }

  const chatKitBaseUrl = await getChatKitBaseUrl();
  await updateMappingProduct(
    connection.commerce_platform_connection_pk,
    externalProductId,
    productPk,
    {
      razzlCode: product.razzlCode,
      productStatus: product.statusCode,
      launchUrl: buildLaunchUrl(chatKitBaseUrl, product.razzlCode),
      editUrl: buildEditCopilotUrl(productPk),
      mappingStatus: "mapped"
    }
  );

  return listProductMappings(connection.commerce_platform_connection_pk);
}

export async function unmapExternalProduct(
  shop: string,
  externalProductId: string
): Promise<ProductMappingListItem[]> {
  const { connection } = await requireLinkedShopConnection(shop);

  await updateMappingProduct(
    connection.commerce_platform_connection_pk,
    externalProductId,
    null,
    {
      razzlCode: null,
      productStatus: null,
      launchUrl: null,
      editUrl: null,
      mappingStatus: "unmapped"
    }
  );

  await setStorefrontCtaEnabled(connection.commerce_platform_connection_pk, externalProductId, false);
  return listProductMappings(connection.commerce_platform_connection_pk);
}

export async function toggleExternalProductCta(
  shop: string,
  externalProductId: string,
  enabled: boolean
): Promise<ProductMappingListItem[]> {
  const { connection } = await requireLinkedShopConnection(shop);
  const mapping = await findMappingByExternalProductId(
    connection.commerce_platform_connection_pk,
    externalProductId
  );

  if (!mapping?.product_fk) {
    throw new CommerceMappingError("NOT_MAPPED", "Map a Razzl product before enabling CTA");
  }
  if (mapping.product_status_snapshot !== "active" && enabled) {
    throw new CommerceMappingError("NOT_LAUNCHABLE", "Copilot must be published before enabling CTA");
  }

  await setStorefrontCtaEnabled(connection.commerce_platform_connection_pk, externalProductId, enabled);
  return listProductMappings(connection.commerce_platform_connection_pk);
}

export async function getProductMappingBoard(shop: string): Promise<{
  items: ProductMappingListItem[];
  studioProducts: StudioProductPickerItem[];
  studioDashboardUrl: string;
}> {
  const { connection } = await requireLinkedShopConnection(shop);
  const tenantPk = connection.tenant_fk;
  if (!tenantPk) {
    throw new CommerceSyncError("TENANT_NOT_LINKED", "Link your Razzl Studio account first");
  }

  const [items, studioProducts] = await Promise.all([
    listProductMappings(connection.commerce_platform_connection_pk),
    listStudioProductsForTenant(tenantPk)
  ]);

  return {
    items,
    studioProducts,
    studioDashboardUrl: buildStudioDashboardUrl()
  };
}

export { listProductMappings, type ProductMappingListItem };
