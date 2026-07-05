import type { NormalizedCommerceProduct } from "@/lib/commerce/adapters/types";
import {
  getAdapterForConnection,
  requireLinkedShopConnection,
  CommerceSyncError
} from "@/lib/commerce/core/connections/adapter-context";
import { findConnectionByStoreDomain } from "@/lib/commerce/core/connections/platform-connection-repo";
import {
  markExternalProductsAbsentSince,
  markExternalProductDeletedByExternalId,
  upsertExternalProduct,
  upsertExternalVariants
} from "@/lib/commerce/core/products/external-product-repo";
import { ensureMappingForExternalProduct } from "@/lib/commerce/core/mapping/mapping-repo";
import {
  completeSyncRun,
  createSyncRun,
  getLatestSyncRun,
  touchConnectionLastSynced,
  type SyncRunStats
} from "@/lib/commerce/core/sync/sync-run-repo";
import { commerceQuery } from "@/lib/commerce/core/db/query";
import type { CommercePlatformSyncRunRow } from "@/lib/commerce/types/commerce-platform-sync-run";
import type { CommerceSyncType } from "@/lib/commerce/types/enums";
import { assertCommerceFeatureEntitlement } from "@/lib/commerce/core/billing/billing-service";

export type ProductSyncResult = {
  syncRunId: number;
  status: "succeeded" | "failed" | "partial";
  stats: SyncRunStats;
  errorMessage?: string;
};

export async function runProductSync(
  shop: string,
  syncType: CommerceSyncType = "manual"
): Promise<ProductSyncResult> {
  const { connection, context } = await requireLinkedShopConnection(shop);
  if (connection.tenant_fk) {
    await assertCommerceFeatureEntitlement(connection, connection.tenant_fk, "sync");
  }
  const adapter = getAdapterForConnection(connection);
  const syncStartedAt = new Date();
  const syncRunId = await createSyncRun(connection.commerce_platform_connection_pk, "shopify", syncType);

  const stats: SyncRunStats = {
    productsSeen: 0,
    productsCreated: 0,
    productsUpdated: 0,
    productsDeletedOrArchived: 0,
    variantsSeen: 0
  };

  try {
    let pageCursor: string | null = null;
    do {
      const page = await adapter.fetchProducts({
        context,
        pageCursor,
        pageSize: 50
      });

      for (const product of page.products) {
        await persistProduct(connection.commerce_platform_connection_pk, product, syncStartedAt, stats);
      }

      pageCursor = page.nextPageCursor;
    } while (pageCursor);

    stats.productsDeletedOrArchived = await markExternalProductsAbsentSince(
      connection.commerce_platform_connection_pk,
      syncStartedAt
    );

    await touchConnectionLastSynced(connection.commerce_platform_connection_pk);
    await completeSyncRun(syncRunId, "succeeded", stats);

    return { syncRunId, status: "succeeded", stats };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product sync failed";
    const code = error instanceof CommerceSyncError ? error.code : "SYNC_FAILED";
    await completeSyncRun(syncRunId, "failed", stats, { code, message });
    return { syncRunId, status: "failed", stats, errorMessage: message };
  }
}

async function persistProduct(
  connectionId: number,
  product: NormalizedCommerceProduct,
  syncedAt: Date,
  stats: SyncRunStats
): Promise<void> {
  stats.productsSeen += 1;
  const upsert = await upsertExternalProduct(connectionId, "shopify", product, syncedAt);
  if (upsert.created) {
    stats.productsCreated += 1;
  } else {
    stats.productsUpdated += 1;
  }

  stats.variantsSeen += await upsertExternalVariants(connectionId, upsert.productPk, product, syncedAt);
  await ensureMappingForExternalProduct(connectionId, upsert.productPk, product.externalProductId);
}

export async function getProductSyncStatus(shop: string): Promise<{
  latestRun: CommercePlatformSyncRunRow | null;
  productCount: number;
}> {
  const connection = await findConnectionByStoreDomain(shop);
  if (!connection) {
    throw new CommerceSyncError("NOT_INSTALLED", "Shopify store is not installed");
  }

  const latestRun = await getLatestSyncRun(connection.commerce_platform_connection_pk);
  const rows = await commerceQuery<Array<{ total: number }>>(
    `SELECT COUNT(*) AS total FROM commerce_external_product
     WHERE commerce_platform_connection_fk = ? AND deleted_on_platform_at IS NULL`,
    [connection.commerce_platform_connection_pk]
  );

  return {
    latestRun,
    productCount: rows[0]?.total ?? 0
  };
}

export async function applyWebhookProductEvent(
  connectionId: number,
  event: { eventType: string; externalProductId?: string; payload: unknown }
): Promise<void> {
  const syncedAt = new Date();

  if (event.eventType === "products/delete") {
    if (event.externalProductId) {
      await markExternalProductDeletedByExternalId(connectionId, event.externalProductId);
    }
    return;
  }

  const product = event.payload as NormalizedCommerceProduct;
  if (!product?.externalProductId) {
    throw new Error("Webhook product payload missing externalProductId");
  }

  const upsert = await upsertExternalProduct(connectionId, "shopify", product, syncedAt);
  await upsertExternalVariants(connectionId, upsert.productPk, product, syncedAt);
  await ensureMappingForExternalProduct(connectionId, upsert.productPk, product.externalProductId);
}
