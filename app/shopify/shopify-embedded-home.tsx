"use client";

import { BlockStack, Layout, Page } from "@shopify/polaris";
import { useEffect, useState } from "react";

import { ShopifyCommercePanels } from "@/app/shopify/shopify-commerce-panels";
import { ShopifyConnectionCard } from "@/app/shopify/shopify-connection-card";
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
  const [setupComplete, setSetupComplete] = useState(false);
  const [oauthStarting, setOauthStarting] = useState(false);

  useEffect(() => {
    if (linkedSuccess) {
      showToast("Razzl account linked successfully");
    }
  }, [linkedSuccess, showToast]);

  const primaryAction =
    createCopilotUrl && status?.tenantLinked && setupComplete
      ? {
          content: "Add Copilot",
          url: createCopilotUrl,
          external: true,
          helpText: "Create from PDF or template"
        }
      : undefined;

  const pageSubtitle =
    createCopilotUrl && status?.tenantLinked && setupComplete
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
              status={status}
              oauthStarting={oauthStarting}
              onConnectStore={async () => {
                if (!shop) return;
                setOauthStarting(true);
                try {
                  const { startShopifyOAuthInstall } = await import("@/app/shopify/shopify-oauth");
                  await startShopifyOAuthInstall(apiPublicOrigin, shop, host, { fromUserGesture: true });
                } catch (error) {
                  showToast(
                    error instanceof Error ? error.message : "Unable to start store connection",
                    { isError: true }
                  );
                  setOauthStarting(false);
                }
              }}
            />

            {shop && status ? (
              <ShopifyCommercePanels
                shop={shop}
                tenantLinked={status.tenantLinked}
                tenantName={status.tenantName}
                apiPublicOrigin={apiPublicOrigin}
                onCreateCopilotUrl={setCreateCopilotUrl}
                onSetupCompleteChange={setSetupComplete}
              />
            ) : null}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
