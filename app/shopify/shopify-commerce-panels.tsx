"use client";

import { Banner, BlockStack } from "@shopify/polaris";
import { useState } from "react";

import { ShopifyAppFooter } from "@/app/shopify/shopify-app-footer";
import { ShopifyCtaSettingsPanel } from "@/app/shopify/shopify-cta-settings-panel";
import { ShopifyCustomerPreviewPanel } from "@/app/shopify/shopify-customer-preview-panel";
import { ShopifyLaunchAnalyticsPanel } from "@/app/shopify/shopify-launch-analytics-panel";
import { ShopifyProductsPanel } from "@/app/shopify/shopify-products-panel";
import { ShopifySetupWizard } from "@/app/shopify/shopify-setup-wizard";

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
  onSetupCompleteChange?: (complete: boolean) => void;
};

export function ShopifyCommercePanels({
  shop,
  tenantLinked,
  tenantName,
  apiPublicOrigin,
  onCreateCopilotUrl,
  onSetupCompleteChange
}: Props) {
  const [productStats, setProductStats] = useState<ProductStats>({
    productCount: 0,
    mappedCount: 0,
    ctaEnabledCount: 0
  });
  const [productStatsReady, setProductStatsReady] = useState(false);
  const [productsRefreshVersion, setProductsRefreshVersion] = useState(0);
  const [studioDashboardUrl, setStudioDashboardUrl] = useState<string | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);

  const handleSetupCompleteChange = (complete: boolean) => {
    setSetupComplete(complete);
    onSetupCompleteChange?.(complete);
  };

  const lockedSectionProps = !setupComplete
    ? ({ className: "shopify-setup-locked", "aria-disabled": true, inert: true } as const)
    : ({ className: "" } as const);

  return (
    <BlockStack gap="500">
      <ShopifySetupWizard
        shop={shop}
        tenantLinked={tenantLinked}
        tenantName={tenantName}
        apiPublicOrigin={apiPublicOrigin}
        productCount={productStats.productCount}
        productStatsReady={productStatsReady}
        studioDashboardUrl={studioDashboardUrl}
        onSyncComplete={() => setProductsRefreshVersion((version) => version + 1)}
        onSetupCompleteChange={handleSetupCompleteChange}
      />

      {!setupComplete ? (
        <Banner tone="info">
          Complete setup above to unlock product mapping, storefront CTA settings, and analytics.
        </Banner>
      ) : null}

      <div {...lockedSectionProps}>
        <ShopifyProductsPanel
          shop={shop}
          apiPublicOrigin={apiPublicOrigin}
          tenantLinked={tenantLinked}
          refreshVersion={productsRefreshVersion}
          onProductStatsChange={(stats) => {
            setProductStats(stats);
            setProductStatsReady(true);
          }}
          onCreateCopilotUrl={onCreateCopilotUrl}
          onStudioDashboardUrlChange={setStudioDashboardUrl}
        />
      </div>
      <div {...lockedSectionProps}>
        <ShopifyCtaSettingsPanel
          shop={shop}
          apiPublicOrigin={apiPublicOrigin}
          tenantLinked={tenantLinked}
        />
      </div>
      <ShopifyCustomerPreviewPanel />
      <div {...lockedSectionProps}>
        <ShopifyLaunchAnalyticsPanel
          shop={shop}
          apiPublicOrigin={apiPublicOrigin}
          tenantLinked={tenantLinked}
        />
      </div>
      <ShopifyAppFooter />
    </BlockStack>
  );
}
