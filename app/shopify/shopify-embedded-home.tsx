"use client";

import { BlockStack, Layout, Page } from "@shopify/polaris";
import { useEffect, useRef, useState } from "react";

import { ShopifyCommercePanels } from "@/app/shopify/shopify-commerce-panels";
import { ShopifyConnectionCard } from "@/app/shopify/shopify-connection-card";
import { startShopifyOAuthInstall, whenAppBridgeReady } from "@/app/shopify/shopify-oauth";
import { useCommerceToast } from "@/app/shopify/shopify-polaris-provider";
import type { ConnectionStatusSummary } from "@/lib/commerce/core/connections/platform-connection-repo";

type Props = {
  shop: string | null;
  host: string | null;
  linkedSuccess: boolean;
  status: ConnectionStatusSummary | null;
  apiPublicOrigin: string;
};

export function ShopifyEmbeddedHome({
  shop,
  host,
  linkedSuccess,
  status,
  apiPublicOrigin
}: Props) {
  const showToast = useCommerceToast();
  const [createCopilotUrl, setCreateCopilotUrl] = useState<string | null>(null);
  const oauthRedirectStarted = useRef(false);

  useEffect(() => {
    if (linkedSuccess) {
      showToast("Razzl account linked successfully");
    }
  }, [linkedSuccess, showToast]);

  // Fresh installs: OAuth not persisted yet — redirect via App Bridge (iframe-safe).
  useEffect(() => {
    if (!shop || status || oauthRedirectStarted.current) return;

    let cancelled = false;

    const run = async () => {
      const bridgeReady = await whenAppBridgeReady();
      if (cancelled || !bridgeReady || oauthRedirectStarted.current) return;

      oauthRedirectStarted.current = true;
      await startShopifyOAuthInstall(apiPublicOrigin, shop, host);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [apiPublicOrigin, host, shop, status]);

  const primaryAction =
    createCopilotUrl && status?.tenantLinked
      ? {
          content: "Add Copilot",
          url: createCopilotUrl,
          external: true,
          helpText: "Create from PDF or template"
        }
      : undefined;

  const pageSubtitle =
    createCopilotUrl && status?.tenantLinked
      ? "Add AI setup help to your product pages. Add Copilot opens Studio — create from PDF or template."
      : "Add AI setup help to your product pages.";

  return (
    <Page
      title="Razzl Product Setup Copilot"
      subtitle={pageSubtitle}
      primaryAction={primaryAction}
      fullWidth
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <ShopifyConnectionCard
              shop={shop}
              host={host}
              status={status}
              apiPublicOrigin={apiPublicOrigin}
            />

            {shop && status ? (
              <ShopifyCommercePanels
                shop={shop}
                tenantLinked={status.tenantLinked}
                tenantName={status.tenantName}
                apiPublicOrigin={apiPublicOrigin}
                onCreateCopilotUrl={setCreateCopilotUrl}
              />
            ) : null}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
