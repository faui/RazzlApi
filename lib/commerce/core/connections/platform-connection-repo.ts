import { commerceQuery } from "@/lib/commerce/core/db/query";
import { COMMERCE_TABLES } from "@/lib/commerce/types/enums";
import type { CommercePlatformConnectionRow } from "@/lib/commerce/types/commerce-platform-connection";
import type {
  CommerceAcquisitionSource,
  CommerceInstallStatus
} from "@/lib/commerce/types/enums";

export type UpsertShopifyInstallInput = {
  externalStoreId: string;
  storeDomain: string;
  storeDisplayName: string | null;
  accessTokenEncrypted: Buffer;
  scopes: string[];
  acquisitionSource: CommerceAcquisitionSource;
  rawPlatformPayload?: unknown;
};

export async function findConnectionByPlatformStore(
  platformType: "shopify",
  externalStoreId: string
): Promise<CommercePlatformConnectionRow | null> {
  const rows = await commerceQuery<CommercePlatformConnectionRow[]>(
    `SELECT * FROM ${COMMERCE_TABLES.platformConnection}
     WHERE platform_type = ? AND external_store_id = ?
     LIMIT 1`,
    [platformType, externalStoreId]
  );
  return rows[0] ?? null;
}

export async function findConnectionByStoreDomain(
  storeDomain: string
): Promise<CommercePlatformConnectionRow | null> {
  const rows = await commerceQuery<CommercePlatformConnectionRow[]>(
    `SELECT * FROM ${COMMERCE_TABLES.platformConnection}
     WHERE platform_type = 'shopify' AND store_domain = ?
     LIMIT 1`,
    [storeDomain]
  );
  return rows[0] ?? null;
}

export async function upsertShopifyInstall(
  input: UpsertShopifyInstallInput
): Promise<number> {
  const scopesJson = JSON.stringify(input.scopes);
  const rawPayloadJson = input.rawPlatformPayload ? JSON.stringify(input.rawPlatformPayload) : null;

  await commerceQuery(
    `INSERT INTO ${COMMERCE_TABLES.platformConnection} (
       tenant_fk,
       platform_type,
       external_store_id,
       store_domain,
       store_display_name,
       install_status,
       auth_type,
       access_token_encrypted,
       scopes_json,
       acquisition_source,
       billing_source,
       platform_billing_status,
       installed_at,
       raw_platform_payload_json
     ) VALUES (
       NULL, 'shopify', ?, ?, ?, 'installed', 'oauth', ?, ?, ?, 'none', 'not_required', NOW(), ?
     )
     ON DUPLICATE KEY UPDATE
       store_domain = VALUES(store_domain),
       store_display_name = VALUES(store_display_name),
       install_status = 'installed',
       auth_type = 'oauth',
       access_token_encrypted = VALUES(access_token_encrypted),
       scopes_json = VALUES(scopes_json),
       acquisition_source = VALUES(acquisition_source),
       uninstalled_at = NULL,
       installed_at = COALESCE(installed_at, NOW()),
       raw_platform_payload_json = VALUES(raw_platform_payload_json),
       updated_on = NOW()`,
    [
      input.externalStoreId,
      input.storeDomain,
      input.storeDisplayName,
      input.accessTokenEncrypted,
      scopesJson,
      input.acquisitionSource,
      rawPayloadJson
    ]
  );

  const row = await findConnectionByPlatformStore("shopify", input.externalStoreId);
  if (!row) {
    throw new Error("Failed to load connection after upsert");
  }
  return row.commerce_platform_connection_pk;
}

export type ConnectionStatusSummary = {
  connectionId: number;
  storeDomain: string;
  storeDisplayName: string | null;
  installStatus: CommerceInstallStatus;
  tenantLinked: boolean;
  installedAt: string | null;
};

export async function getConnectionStatusByStoreDomain(
  storeDomain: string
): Promise<ConnectionStatusSummary | null> {
  const row = await findConnectionByStoreDomain(storeDomain);
  if (!row) {
    return null;
  }

  return {
    connectionId: row.commerce_platform_connection_pk,
    storeDomain: row.store_domain ?? storeDomain,
    storeDisplayName: row.store_display_name,
    installStatus: row.install_status,
    tenantLinked: row.tenant_fk !== null,
    installedAt: row.installed_at ? String(row.installed_at) : null
  };
}
