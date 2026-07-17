import { refreshShopifyOfflineAccessToken } from "@/lib/commerce/adapters/shopify/oauth";
import {
  findConnectionByPlatformStore,
  updateShopifyOAuthTokens,
  type UpsertShopifyInstallInput
} from "@/lib/commerce/core/connections/platform-connection-repo";
import {
  decryptPlatformToken,
  encryptPlatformToken
} from "@/lib/commerce/core/crypto/token-crypto";
import type { CommercePlatformConnectionRow } from "@/lib/commerce/types/commerce-platform-connection";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

export type ShopifyInstallRawPayload = {
  token?: {
    scope?: string;
    accessExpiresAt?: number;
    refreshExpiresAt?: number;
  };
  shop?: unknown;
};

export function parseShopifyInstallRawPayload(raw: unknown): ShopifyInstallRawPayload {
  if (typeof raw === "string") {
    try {
      return parseShopifyInstallRawPayload(JSON.parse(raw) as unknown);
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && raw !== null) {
    return raw as ShopifyInstallRawPayload;
  }
  return {};
}

export function buildShopifyInstallRawPayload(input: {
  shop: unknown;
  scope?: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}): ShopifyInstallRawPayload {
  return {
    token: {
      scope: input.scope,
      accessExpiresAt: input.accessExpiresAt,
      refreshExpiresAt: input.refreshExpiresAt
    },
    shop: input.shop
  };
}

export function buildUpsertPayloadFromAuthResult(input: {
  externalStoreId: string;
  storeDomain: string;
  storeDisplayName: string | null;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  scopeHeader?: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  shopPayload: unknown;
  acquisitionSource: UpsertShopifyInstallInput["acquisitionSource"];
}): UpsertShopifyInstallInput {
  return {
    externalStoreId: input.externalStoreId,
    storeDomain: input.storeDomain,
    storeDisplayName: input.storeDisplayName,
    accessTokenEncrypted: encryptPlatformToken(input.accessToken),
    refreshTokenEncrypted: encryptPlatformToken(input.refreshToken),
    scopes: input.scopes,
    acquisitionSource: input.acquisitionSource,
    rawPlatformPayload: buildShopifyInstallRawPayload({
      shop: input.shopPayload,
      scope: input.scopeHeader,
      accessExpiresAt: input.accessExpiresAt,
      refreshExpiresAt: input.refreshExpiresAt
    })
  };
}

function accessTokenStillFresh(rawPayload: unknown): boolean {
  const metadata = parseShopifyInstallRawPayload(rawPayload).token;
  if (!metadata?.accessExpiresAt) {
    return false;
  }
  return metadata.accessExpiresAt > Date.now() + REFRESH_BUFFER_MS;
}

/** Refresh expiring Shopify offline tokens before Admin API calls when needed. */
export async function ensureFreshShopifyConnection(
  connection: CommercePlatformConnectionRow
): Promise<CommercePlatformConnectionRow> {
  if (connection.platform_type !== "shopify") {
    return connection;
  }

  if (accessTokenStillFresh(connection.raw_platform_payload_json)) {
    return connection;
  }

  if (!connection.refresh_token_encrypted || !connection.store_domain) {
    return connection;
  }

  const refreshToken = decryptPlatformToken(Buffer.from(connection.refresh_token_encrypted));
  const refreshed = await refreshShopifyOfflineAccessToken(connection.store_domain, refreshToken);

  await updateShopifyOAuthTokens({
    connectionId: connection.commerce_platform_connection_pk,
    accessTokenEncrypted: encryptPlatformToken(refreshed.accessToken),
    refreshTokenEncrypted: encryptPlatformToken(refreshed.refreshToken),
    scopes: refreshed.scopes,
    rawPlatformPayload: buildShopifyInstallRawPayload({
      shop: parseShopifyInstallRawPayload(connection.raw_platform_payload_json).shop,
      scope: refreshed.scopes.join(","),
      accessExpiresAt: refreshed.accessTokenExpiresAt,
      refreshExpiresAt: refreshed.refreshTokenExpiresAt
    })
  });

  const updated = await findConnectionByPlatformStore("shopify", connection.external_store_id);
  return updated ?? connection;
}
