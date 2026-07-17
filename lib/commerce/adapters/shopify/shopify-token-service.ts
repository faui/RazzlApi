import { refreshShopifyOfflineAccessToken } from "@/lib/commerce/adapters/shopify/oauth";
import { CommerceAdapterError } from "@/lib/commerce/adapters/types";
import type { CommerceAdapterContext } from "@/lib/commerce/adapters/types";
import {
  markConnectionInstallError,
  refreshShopifyConnectionTokensLocked,
  type UpsertShopifyInstallInput
} from "@/lib/commerce/core/connections/platform-connection-repo";
import {
  decryptPlatformToken,
  encryptPlatformToken
} from "@/lib/commerce/core/crypto/token-crypto";
import type { CommercePlatformConnectionRow } from "@/lib/commerce/types/commerce-platform-connection";

export const REFRESH_BUFFER_MS = 5 * 60 * 1000;

function parseScopesJson(scopesJson: unknown): string[] {
  if (Array.isArray(scopesJson)) {
    return scopesJson.filter((scope): scope is string => typeof scope === "string");
  }
  if (typeof scopesJson === "string") {
    try {
      const parsed = JSON.parse(scopesJson) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((scope): scope is string => typeof scope === "string");
      }
    } catch {
      return scopesJson.split(",").map((scope) => scope.trim()).filter(Boolean);
    }
  }
  return [];
}

function buildAdapterContext(connection: CommercePlatformConnectionRow): CommerceAdapterContext {
  if (!connection.access_token_encrypted) {
    throw new ShopifyTokenError("NO_TOKEN", "Shop connection has no access token");
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

export type ShopifyTokenStatus = "ok" | "refresh_needed" | "reauth_required";

export class ShopifyTokenError extends Error {
  constructor(
    public code: "TOKEN_REFRESH_TRANSIENT" | "TOKEN_REAUTH_REQUIRED" | "NO_TOKEN",
    message: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = "ShopifyTokenError";
  }
}

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

export function accessTokenStillFresh(rawPayload: unknown, bufferMs = REFRESH_BUFFER_MS): boolean {
  const metadata = parseShopifyInstallRawPayload(rawPayload).token;
  if (!metadata?.accessExpiresAt) {
    return false;
  }
  return metadata.accessExpiresAt > Date.now() + bufferMs;
}

export function hasValidExpiringTokenPair(connection: CommercePlatformConnectionRow): boolean {
  if (!connection.access_token_encrypted || !connection.refresh_token_encrypted) {
    return false;
  }

  const metadata = parseShopifyInstallRawPayload(connection.raw_platform_payload_json).token;
  return Boolean(metadata?.accessExpiresAt && metadata?.refreshExpiresAt);
}

export function deriveTokenStatus(connection: CommercePlatformConnectionRow): ShopifyTokenStatus {
  if (connection.install_status === "error" || connection.install_status === "uninstalled") {
    return "reauth_required";
  }

  if (!connection.access_token_encrypted || !connection.refresh_token_encrypted) {
    return "reauth_required";
  }

  const metadata = parseShopifyInstallRawPayload(connection.raw_platform_payload_json).token;
  if (!metadata?.accessExpiresAt || !metadata.refreshExpiresAt) {
    return "reauth_required";
  }

  if (metadata.refreshExpiresAt <= Date.now()) {
    return "reauth_required";
  }

  if (metadata.accessExpiresAt <= Date.now() + REFRESH_BUFFER_MS) {
    return "refresh_needed";
  }

  return "ok";
}

function mapRefreshFailure(error: unknown): ShopifyTokenError {
  if (error instanceof ShopifyTokenError) {
    return error;
  }

  if (error instanceof CommerceAdapterError) {
    if (error.code === "TOKEN_REAUTH_REQUIRED") {
      return new ShopifyTokenError("TOKEN_REAUTH_REQUIRED", error.message, false);
    }
    if (error.retryable) {
      return new ShopifyTokenError("TOKEN_REFRESH_TRANSIENT", error.message, true);
    }
  }

  if (error instanceof Error) {
    return new ShopifyTokenError("TOKEN_REFRESH_TRANSIENT", error.message, true);
  }

  return new ShopifyTokenError("TOKEN_REFRESH_TRANSIENT", "Shopify token refresh failed", true);
}

async function refreshShopifyConnectionWithLock(
  connection: CommercePlatformConnectionRow
): Promise<CommercePlatformConnectionRow> {
  if (!connection.refresh_token_encrypted || !connection.store_domain) {
    throw new ShopifyTokenError(
      "TOKEN_REAUTH_REQUIRED",
      "Shopify store is missing a refresh token — reconnect the store"
    );
  }

  try {
    return await refreshShopifyConnectionTokensLocked({
      connectionId: connection.commerce_platform_connection_pk,
      isAccessTokenFresh: (locked) => accessTokenStillFresh(locked.raw_platform_payload_json),
      performRefresh: async (locked) => {
        if (!locked.refresh_token_encrypted || !locked.store_domain) {
          throw new ShopifyTokenError(
            "TOKEN_REAUTH_REQUIRED",
            "Shopify store is missing a refresh token — reconnect the store"
          );
        }

        const refreshToken = decryptPlatformToken(Buffer.from(locked.refresh_token_encrypted));
        const refreshed = await refreshShopifyOfflineAccessToken(locked.store_domain, refreshToken);

        return {
          accessTokenEncrypted: encryptPlatformToken(refreshed.accessToken),
          refreshTokenEncrypted: encryptPlatformToken(refreshed.refreshToken),
          scopes: refreshed.scopes,
          rawPlatformPayload: buildShopifyInstallRawPayload({
            shop: parseShopifyInstallRawPayload(locked.raw_platform_payload_json).shop,
            scope: refreshed.scopeHeader ?? refreshed.scopes.join(","),
            accessExpiresAt: refreshed.accessTokenExpiresAt,
            refreshExpiresAt: refreshed.refreshTokenExpiresAt
          })
        };
      }
    });
  } catch (error) {
    const mapped = mapRefreshFailure(error);
    if (mapped.code === "TOKEN_REAUTH_REQUIRED") {
      await markConnectionInstallError(connection.commerce_platform_connection_pk);
    }
    throw mapped;
  }
}

/**
 * Single entry point before any Shopify Admin API call.
 * Refreshes expiring offline tokens under a row lock when needed.
 */
export async function resolveShopifyConnection(
  connection: CommercePlatformConnectionRow
): Promise<{ connection: CommercePlatformConnectionRow; context: CommerceAdapterContext }> {
  if (connection.platform_type !== "shopify") {
    return {
      connection,
      context: buildAdapterContext(connection)
    };
  }

  const tokenStatus = deriveTokenStatus(connection);
  if (tokenStatus === "reauth_required") {
    throw new ShopifyTokenError(
      "TOKEN_REAUTH_REQUIRED",
      "Shopify store must be reconnected before using Admin API features"
    );
  }

  let resolvedConnection = connection;
  if (tokenStatus === "refresh_needed") {
    resolvedConnection = await refreshShopifyConnectionWithLock(connection);
  }

  return {
    connection: resolvedConnection,
    context: buildAdapterContext(resolvedConnection)
  };
}

/** @deprecated Use resolveShopifyConnection instead. */
export async function ensureFreshShopifyConnection(
  connection: CommercePlatformConnectionRow
): Promise<CommercePlatformConnectionRow> {
  const resolved = await resolveShopifyConnection(connection);
  return resolved.connection;
}

export function buildPersistPayloadFromOfflineTokenResult(input: {
  connection: CommercePlatformConnectionRow;
  accessToken: string;
  refreshToken: string;
  scopes: string[];
  scopeHeader?: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
}): {
  accessTokenEncrypted: Buffer;
  refreshTokenEncrypted: Buffer;
  scopes: string[];
  rawPlatformPayload: ShopifyInstallRawPayload;
} {
  return {
    accessTokenEncrypted: encryptPlatformToken(input.accessToken),
    refreshTokenEncrypted: encryptPlatformToken(input.refreshToken),
    scopes: input.scopes,
    rawPlatformPayload: buildShopifyInstallRawPayload({
      shop: parseShopifyInstallRawPayload(input.connection.raw_platform_payload_json).shop,
      scope: input.scopeHeader ?? input.scopes.join(","),
      accessExpiresAt: input.accessExpiresAt,
      refreshExpiresAt: input.refreshExpiresAt
    })
  };
}
