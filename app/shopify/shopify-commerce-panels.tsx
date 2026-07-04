"use client";

import { BlockStack } from "@shopify/polaris";
import { useState } from "react";

import { ShopifyCtaSettingsPanel } from "@/app/shopify/shopify-cta-settings-panel";
import { ShopifyLaunchAnalyticsPanel } from "@/app/shopify/shopify-launch-analytics-panel";
import { ShopifyOnboardingPanel } from "@/app/shopify/shopify-onboarding-panel";
import { ShopifyProductsPanel } from "@/app/shopify/shopify-products-panel";

type ProductStats = {
  productCount: number;
  mappedCount: number;
  ctaEnabledCount: number;
};

type Props = {
  shop: string;
  tenantLinked: boolean;
  tenantName: string | null;
  apiPublicOrigin: string;
  onCreateCopilotUrl?: (url: string | null) => void;
};

export function ShopifyCommercePanels({
  shop,
  tenantLinked,
  tenantName,
  apiPublicOrigin,
  onCreateCopilotUrl
}: Props) {
  const [productStats, setProductStats] = useState<ProductStats>({
    productCount: 0,
    mappedCount: 0,
    ctaEnabledCount: 0
  });

  return (
    <BlockStack gap="500">
      <ShopifyOnboardingPanel
        shop={shop}
        tenantLinked={tenantLinked}
        tenantName={tenantName}
        apiPublicOrigin={apiPublicOrigin}
        productStats={productStats}
      />
      <ShopifyProductsPanel
        shop={shop}
        apiPublicOrigin={apiPublicOrigin}
        tenantLinked={tenantLinked}
        onProductStatsChange={setProductStats}
        onCreateCopilotUrl={onCreateCopilotUrl}
      />
      <ShopifyCtaSettingsPanel shop={shop} apiPublicOrigin={apiPublicOrigin} tenantLinked={tenantLinked} />
      <ShopifyLaunchAnalyticsPanel shop={shop} apiPublicOrigin={apiPublicOrigin} tenantLinked={tenantLinked} />
    </BlockStack>
  );
}
