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
  refreshTokenEncrypted: Buffer;
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
       refresh_token_encrypted,
       scopes_json,
       acquisition_source,
       billing_source,
       platform_billing_status,
       installed_at,
       raw_platform_payload_json
     ) VALUES (
       NULL, 'shopify', ?, ?, ?, 'installed', 'oauth', ?, ?, ?, ?, 'none', 'not_required', NOW(), ?
     )
     ON DUPLICATE KEY UPDATE
       store_domain = VALUES(store_domain),
       store_display_name = VALUES(store_display_name),
       install_status = 'installed',
       auth_type = 'oauth',
       access_token_encrypted = VALUES(access_token_encrypted),
       refresh_token_encrypted = VALUES(refresh_token_encrypted),
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
      input.refreshTokenEncrypted,
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

export type UpdateShopifyOAuthTokensInput = {
  connectionId: number;
  accessTokenEncrypted: Buffer;
  refreshTokenEncrypted: Buffer;
  scopes?: string[];
  rawPlatformPayload?: unknown;
};

export async function updateShopifyOAuthTokens(input: UpdateShopifyOAuthTokensInput): Promise<void> {
  const scopesJson = input.scopes ? JSON.stringify(input.scopes) : null;
  const rawPayloadJson = input.rawPlatformPayload ? JSON.stringify(input.rawPlatformPayload) : null;

  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.platformConnection}
     SET access_token_encrypted = ?,
         refresh_token_encrypted = ?,
         scopes_json = COALESCE(?, scopes_json),
         raw_platform_payload_json = COALESCE(?, raw_platform_payload_json),
         updated_on = NOW()
     WHERE commerce_platform_connection_pk = ?`,
    [
      input.accessTokenEncrypted,
      input.refreshTokenEncrypted,
      scopesJson,
      rawPayloadJson,
      input.connectionId
    ]
  );
}

export type ConnectionStatusSummary = {
  connectionId: number;
  storeDomain: string;
  storeDisplayName: string | null;
  installStatus: CommerceInstallStatus;
  tenantLinked: boolean;
  tenantPk: number | null;
  tenantName: string | null;
  connectedAt: string | null;
  installedAt: string | null;
};

export async function linkConnectionToTenant(
  connectionId: number,
  tenantPk: number
): Promise<void> {
  const existing = await findConnectionById(connectionId);
  if (!existing) {
    throw new Error("CONNECTION_NOT_FOUND");
  }
  if (existing.tenant_fk !== null && existing.tenant_fk !== tenantPk) {
    throw new Error("CONNECTION_ALREADY_LINKED");
  }
  if (existing.tenant_fk === tenantPk) {
    return;
  }

  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.platformConnection}
     SET tenant_fk = ?,
         install_status = 'connected',
         connected_at = COALESCE(connected_at, NOW()),
         updated_on = NOW()
     WHERE commerce_platform_connection_pk = ?`,
    [tenantPk, connectionId]
  );
}

export async function unlinkConnectionTenant(connectionId: number): Promise<void> {
  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.platformConnection}
     SET tenant_fk = NULL,
         install_status = 'installed',
         connected_at = NULL,
         updated_on = NOW()
     WHERE commerce_platform_connection_pk = ?`,
    [connectionId]
  );
}

export async function markShopUninstalled(connectionId: number): Promise<void> {
  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.platformConnection}
     SET install_status = 'uninstalled',
         uninstalled_at = NOW(),
         access_token_encrypted = NULL,
         refresh_token_encrypted = NULL,
         updated_on = NOW()
     WHERE commerce_platform_connection_pk = ?`,
    [connectionId]
  );
}

export async function findConnectionById(
  connectionId: number
): Promise<CommercePlatformConnectionRow | null> {
  const rows = await commerceQuery<CommercePlatformConnectionRow[]>(
    `SELECT * FROM ${COMMERCE_TABLES.platformConnection}
     WHERE commerce_platform_connection_pk = ?
     LIMIT 1`,
    [connectionId]
  );
  return rows[0] ?? null;
}

export async function getConnectionStatusByStoreDomain(
  storeDomain: string
): Promise<ConnectionStatusSummary | null> {
  const rows = await commerceQuery<
    Array<{
      commerce_platform_connection_pk: number;
      store_domain: string | null;
      store_display_name: string | null;
      install_status: CommerceInstallStatus;
      tenant_fk: number | null;
      tenant_name: string | null;
      connected_at: string | Date | null;
      installed_at: string | Date | null;
    }>
  >(
    `SELECT c.commerce_platform_connection_pk,
            c.store_domain,
            c.store_display_name,
            c.install_status,
            c.tenant_fk,
            t.tenant_name,
            c.connected_at,
            c.installed_at
     FROM ${COMMERCE_TABLES.platformConnection} c
     LEFT JOIN tenant t ON t.tenant_pk = c.tenant_fk
     WHERE c.platform_type = 'shopify' AND c.store_domain = ?
     LIMIT 1`,
    [storeDomain]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    connectionId: row.commerce_platform_connection_pk,
    storeDomain: row.store_domain ?? storeDomain,
    storeDisplayName: row.store_display_name,
    installStatus: row.install_status,
    tenantLinked: row.tenant_fk !== null,
    tenantPk: row.tenant_fk,
    tenantName: row.tenant_name,
    connectedAt: row.connected_at ? String(row.connected_at) : null,
    installedAt: row.installed_at ? String(row.installed_at) : null
  };
}
