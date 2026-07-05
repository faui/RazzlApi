import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import { createCommerceLinkToken, verifyCommerceLinkToken } from "@/lib/commerce/core/connections/link-token";
import {
  findConnectionById,
  findConnectionByStoreDomain,
  getConnectionStatusByStoreDomain,
  linkConnectionToTenant,
  unlinkConnectionTenant,
  type ConnectionStatusSummary
} from "@/lib/commerce/core/connections/platform-connection-repo";
import {
  buildStudioAuthUrl,
  buildStudioCommerceLinkReturnPath,
  buildStudioDashboardUrl
} from "@/lib/commerce/core/studio-links";
import { initializeBillingOnTenantLink } from "@/lib/commerce/core/billing/billing-service";

export class CommerceConnectionError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "CommerceConnectionError";
  }
}

export type LinkStartResult = {
  shop: string;
  connectionId: number;
  linkToken: string;
  loginUrl: string;
  signupUrl: string;
  studioDashboardUrl: string;
};

export async function startTenantLink(shopParam: string): Promise<LinkStartResult> {
  const shop = normalizeShopDomain(shopParam);
  if (!shop) {
    throw new CommerceConnectionError("INVALID_SHOP", "Invalid shop domain");
  }

  const connection = await findConnectionByStoreDomain(shop);
  if (!connection) {
    throw new CommerceConnectionError("NOT_INSTALLED", "Shopify store is not installed");
  }

  const linkToken = createCommerceLinkToken(shop, connection.commerce_platform_connection_pk);
  const returnPath = buildStudioCommerceLinkReturnPath(linkToken);

  return {
    shop,
    connectionId: connection.commerce_platform_connection_pk,
    linkToken,
    loginUrl: buildStudioAuthUrl("/auth/login", returnPath),
    signupUrl: buildStudioAuthUrl("/auth/start", returnPath),
    studioDashboardUrl: buildStudioDashboardUrl()
  };
}

export async function completeTenantLink(
  linkToken: string,
  tenantPk: number
): Promise<ConnectionStatusSummary> {
  if (!Number.isInteger(tenantPk) || tenantPk <= 0) {
    throw new CommerceConnectionError("INVALID_TENANT", "Invalid tenant");
  }

  let payload;
  try {
    payload = verifyCommerceLinkToken(linkToken);
  } catch {
    throw new CommerceConnectionError("INVALID_TOKEN", "Invalid or expired link token");
  }

  if (payload.connectionId <= 0) {
    throw new CommerceConnectionError("INVALID_TOKEN", "Invalid connection in token");
  }

  const connection = await findConnectionById(payload.connectionId);
  if (!connection || connection.store_domain !== payload.shop) {
    throw new CommerceConnectionError("CONNECTION_MISMATCH", "Connection does not match token");
  }

  try {
    await linkConnectionToTenant(payload.connectionId, tenantPk);
    await initializeBillingOnTenantLink(connection, tenantPk);
  } catch (error) {
    if (error instanceof Error && error.message === "CONNECTION_ALREADY_LINKED") {
      throw new CommerceConnectionError(
        "ALREADY_LINKED",
        "This store is already linked to another Razzl account"
      );
    }
    throw error;
  }

  const status = await getConnectionStatusByStoreDomain(payload.shop);
  if (!status) {
    throw new CommerceConnectionError("LINK_FAILED", "Failed to load connection after link");
  }

  return status;
}

export async function unlinkTenantFromShop(shopParam: string): Promise<ConnectionStatusSummary> {
  const shop = normalizeShopDomain(shopParam);
  if (!shop) {
    throw new CommerceConnectionError("INVALID_SHOP", "Invalid shop domain");
  }

  const connection = await findConnectionByStoreDomain(shop);
  if (!connection) {
    throw new CommerceConnectionError("NOT_INSTALLED", "Shopify store is not installed");
  }

  await unlinkConnectionTenant(connection.commerce_platform_connection_pk);
  const status = await getConnectionStatusByStoreDomain(shop);
  if (!status) {
    throw new CommerceConnectionError("UNLINK_FAILED", "Failed to load connection after unlink");
  }

  return status;
}

export async function getShopConnectionStatus(shopParam: string): Promise<ConnectionStatusSummary | null> {
  const shop = normalizeShopDomain(shopParam);
  if (!shop) {
    throw new CommerceConnectionError("INVALID_SHOP", "Invalid shop domain");
  }
  return getConnectionStatusByStoreDomain(shop);
}
