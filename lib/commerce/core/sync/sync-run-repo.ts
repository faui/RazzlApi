import { commerceQuery } from "@/lib/commerce/core/db/query";
import { COMMERCE_TABLES } from "@/lib/commerce/types/enums";
import type {
  CommerceSyncRunStatus,
  CommerceSyncType
} from "@/lib/commerce/types/enums";
import type { CommercePlatformSyncRunRow } from "@/lib/commerce/types/commerce-platform-sync-run";

export type SyncRunStats = {
  productsSeen: number;
  productsCreated: number;
  productsUpdated: number;
  productsDeletedOrArchived: number;
  variantsSeen: number;
};

export async function createSyncRun(
  connectionId: number,
  platformType: "shopify",
  syncType: CommerceSyncType
): Promise<number> {
  await commerceQuery(
    `INSERT INTO ${COMMERCE_TABLES.platformSyncRun} (
       commerce_platform_connection_fk,
       platform_type,
       sync_type,
       status,
       started_at
     ) VALUES (?, ?, ?, 'running', NOW())`,
    [connectionId, platformType, syncType]
  );

  const rows = await commerceQuery<Array<{ commerce_platform_sync_run_pk: number }>>(
    `SELECT commerce_platform_sync_run_pk
     FROM ${COMMERCE_TABLES.platformSyncRun}
     WHERE commerce_platform_connection_fk = ?
     ORDER BY started_at DESC
     LIMIT 1`,
    [connectionId]
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to create sync run");
  }
  return row.commerce_platform_sync_run_pk;
}

export async function completeSyncRun(
  syncRunId: number,
  status: CommerceSyncRunStatus,
  stats: SyncRunStats,
  error?: { code?: string; message?: string }
): Promise<void> {
  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.platformSyncRun}
     SET status = ?,
         completed_at = NOW(),
         products_seen = ?,
         products_created = ?,
         products_updated = ?,
         products_deleted_or_archived = ?,
         variants_seen = ?,
         error_code = ?,
         error_message = ?
     WHERE commerce_platform_sync_run_pk = ?`,
    [
      status,
      stats.productsSeen,
      stats.productsCreated,
      stats.productsUpdated,
      stats.productsDeletedOrArchived,
      stats.variantsSeen,
      error?.code ?? null,
      error?.message ?? null,
      syncRunId
    ]
  );
}

export async function getLatestSyncRun(
  connectionId: number
): Promise<CommercePlatformSyncRunRow | null> {
  const rows = await commerceQuery<CommercePlatformSyncRunRow[]>(
    `SELECT * FROM ${COMMERCE_TABLES.platformSyncRun}
     WHERE commerce_platform_connection_fk = ?
     ORDER BY started_at DESC
     LIMIT 1`,
    [connectionId]
  );
  return rows[0] ?? null;
}

export async function touchConnectionLastSynced(connectionId: number): Promise<void> {
  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.platformConnection}
     SET last_synced_at = NOW(), updated_on = NOW()
     WHERE commerce_platform_connection_pk = ?`,
    [connectionId]
  );
}
