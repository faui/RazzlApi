"use client";

import { useEffect, useState } from "react";

import { ShopifyEmbeddedHome } from "@/app/shopify/shopify-embedded-home";
import {
  exchangeEmbeddedSessionToken,
  resolveEmbeddedHost,
  resolveEmbeddedShopDomain,
  whenAppBridgeReady
} from "@/app/shopify/shopify-oauth";
import type { ConnectionStatusSummary } from "@/lib/commerce/core/connections/platform-connection-repo";
import type { CommerceInstallStatus } from "@/lib/commerce/types/enums";
import type { ShopifyTokenStatus } from "@/lib/commerce/adapters/shopify/shopify-token-service";

type Props = {
  initialShop: string | null;
  initialHost: string | null;
  linkedSuccess: boolean;
  initialStatus: ConnectionStatusSummary | null;
  apiPublicOrigin: string;
};

type ConnectionApiResponse = {
  ok: boolean;
  connected?: boolean;
  shop?: string;
  storeDisplayName?: string | null;
  installStatus?: CommerceInstallStatus;
  tenantLinked?: boolean;
  tenantPk?: number | null;
  tenantName?: string | null;
  connectedAt?: string | null;
  installedAt?: string | null;
  tokenStatus?: ShopifyTokenStatus;
};

function mapConnectionResponse(data: ConnectionApiResponse): ConnectionStatusSummary | null {
  if (!data.ok || !data.shop) {
    return null;
  }
  if (!data.installStatus && data.connected === false) {
    return null;
  }

  return {
    connectionId: 0,
    storeDomain: data.shop,
    storeDisplayName: data.storeDisplayName ?? null,
    installStatus: data.installStatus ?? "installed",
    tenantLinked: Boolean(data.tenantLinked),
    tenantPk: data.tenantPk ?? null,
    tenantName: data.tenantName ?? null,
    connectedAt: data.connectedAt ?? null,
    installedAt: data.installedAt ?? null,
    tokenStatus: data.tokenStatus ?? "ok"
  };
}

/**
 * Client bootstrap for embedded Shopify admin: resolve shop/host after App Bridge loads
 * (URL params can be missing after a failed reload).
 */
export function ShopifyEmbeddedShell({
  initialShop,
  initialHost,
  linkedSuccess,
  initialStatus,
  apiPublicOrigin
}: Props) {
  const [shop, setShop] = useState<string | null>(() => resolveEmbeddedShopDomain(initialShop));
  const [host, setHost] = useState<string | null>(() => resolveEmbeddedHost(initialHost));
  const [status, setStatus] = useState<ConnectionStatusSummary | null>(initialStatus);
  const [contextReady, setContextReady] = useState(Boolean(initialShop));

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!initialShop || !initialHost) {
        await whenAppBridgeReady();
        if (cancelled) return;

        setShop((prev) => prev ?? resolveEmbeddedShopDomain(initialShop));
        setHost((prev) => prev ?? resolveEmbeddedHost(initialHost));
      }

      if (cancelled) return;
      setContextReady(true);
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [initialHost, initialShop]);

  useEffect(() => {
    if (!shop) return;

    let cancelled = false;

    const loadStatus = async () => {
      try {
        const response = await fetch(
          `${apiPublicOrigin}/api/commerce/shopify/connection?shop=${encodeURIComponent(shop)}`
        );
        const data = (await response.json()) as ConnectionApiResponse;
        if (cancelled) return;
        const mapped = mapConnectionResponse(data);
        setStatus(mapped);

        if (mapped && mapped.installStatus !== "uninstalled" && mapped.tokenStatus === "refresh_needed") {
          await exchangeEmbeddedSessionToken(apiPublicOrigin, shop);
          if (cancelled) return;

          const refreshResponse = await fetch(
            `${apiPublicOrigin}/api/commerce/shopify/connection?shop=${encodeURIComponent(shop)}`
          );
          const refreshData = (await refreshResponse.json()) as ConnectionApiResponse;
          if (!cancelled) {
            setStatus(mapConnectionResponse(refreshData));
          }
        }
      } catch {
        if (!cancelled) {
          setStatus(null);
        }
      }
    };

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [apiPublicOrigin, shop]);

  if (!contextReady) {
    return null;
  }

  return (
    <ShopifyEmbeddedHome
      shop={shop}
      host={host}
      linkedSuccess={linkedSuccess}
      status={status}
      apiPublicOrigin={apiPublicOrigin}
    />
  );
}
