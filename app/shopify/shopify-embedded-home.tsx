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
  linkedSuccess,
  status,
  apiPublicOrigin
}: Props) {
  const showToast = useCommerceToast();
  const [createCopilotUrl, setCreateCopilotUrl] = useState<string | null>(null);

  useEffect(() => {
    if (linkedSuccess) {
      showToast("Razzl account linked successfully");
    }
  }, [linkedSuccess, showToast]);

  const primaryAction =
    createCopilotUrl && status?.tenantLinked
      ? {
          content: "Add Copilot",
          url: createCopilotUrl,
          external: true
        }
      : undefined;

  return (
    <Page
      title="Razzl Product Setup Copilot"
      subtitle="Add AI setup help to your product pages."
      primaryAction={primaryAction}
      fullWidth
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <ShopifyConnectionCard shop={shop} status={status} />

            {shop && status ? (
              <ShopifyCommercePanels
                shop={shop}
                tenantLinked={status.tenantLinked}
                tenantName={status.tenantName}
                apiPublicOrigin={apiPublicOrigin}
                onCreateCopilotUrl={setCreateCopilotUrl}
              />
            ) : shop ? (
              <ShopifyConnectionCard shop={shop} status={null} showInstallHint />
            ) : null}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
