import { ensureFreshShopifyConnection } from "@/lib/commerce/adapters/shopify/shopify-token-service";
import { getAdapter } from "@/lib/commerce/adapters/registry";
import type { CommerceAdapterContext } from "@/lib/commerce/adapters/types";
import { decryptPlatformToken } from "@/lib/commerce/core/crypto/token-crypto";
import {
  findConnectionByStoreDomain,
  getConnectionStatusByStoreDomain,
  type ConnectionStatusSummary
} from "@/lib/commerce/core/connections/platform-connection-repo";
import type { CommercePlatformConnectionRow } from "@/lib/commerce/types/commerce-platform-connection";

export class CommerceSyncError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "CommerceSyncError";
  }
}

function parseScopesJson(scopesJson: unknown): string[] {
  if (Array.isArray(scopesJson)) {
    return scopesJson.filter((s): s is string => typeof s === "string");
  }
  if (typeof scopesJson === "string") {
    try {
      const parsed = JSON.parse(scopesJson) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is string => typeof s === "string");
      }
    } catch {
      return scopesJson.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function buildAdapterContextFromConnection(
  connection: CommercePlatformConnectionRow
): CommerceAdapterContext {
  if (!connection.access_token_encrypted) {
    throw new CommerceSyncError("NO_TOKEN", "Shop connection has no access token");
  }

  return {
    connectionId: connection.commerce_platform_connection_pk,
    tenantId: connection.tenant_fk,
    externalStoreId: connection.external_store_id,
    storeDomain: connection.store_domain ?? "",
    accessToken: decryptPlatformToken(Buffer.from(connection.access_token_encrypted)),
    scopes: parseScopesJson(connection.scopes_json)
  };
}

export async function requireLinkedShopConnection(shop: string): Promise<{
  connection: CommercePlatformConnectionRow;
  status: ConnectionStatusSummary;
  context: CommerceAdapterContext;
}> {
  const connection = await findConnectionByStoreDomain(shop);
  if (!connection) {
    throw new CommerceSyncError("NOT_INSTALLED", "Shopify store is not installed");
  }

  const status = await getConnectionStatusByStoreDomain(shop);
  if (!status) {
    throw new CommerceSyncError("NOT_INSTALLED", "Shopify store is not installed");
  }

  if (!connection.tenant_fk) {
    throw new CommerceSyncError("TENANT_NOT_LINKED", "Link your Razzl Studio account before syncing products");
  }

  const freshConnection = await ensureFreshShopifyConnection(connection);

  return {
    connection: freshConnection,
    status,
    context: buildAdapterContextFromConnection(freshConnection)
  };
}

export function getAdapterForConnection(connection: CommercePlatformConnectionRow) {
  return getAdapter(connection.platform_type);
}
