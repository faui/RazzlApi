"use client";

import { Banner, BlockStack } from "@shopify/polaris";
import { useCallback, useState } from "react";

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

  const handleProductStatsChange = useCallback((stats: ProductStats) => {
    setProductStats((current) =>
      current.productCount === stats.productCount &&
      current.mappedCount === stats.mappedCount &&
      current.ctaEnabledCount === stats.ctaEnabledCount
        ? current
        : stats
    );
    setProductStatsReady(true);
  }, []);

  const handleProductsSyncComplete = useCallback(() => {
    setProductsRefreshVersion((version) => version + 1);
  }, []);

  const handleSetupCompleteChange = useCallback(
    (complete: boolean) => {
      setSetupComplete(complete);
      onSetupCompleteChange?.(complete);
    },
    [onSetupCompleteChange]
  );

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
        onSyncComplete={handleProductsSyncComplete}
        onSetupCompleteChange={handleSetupCompleteChange}
      />

      {!setupComplete ? (
        <Banner tone="info">
          Complete setup above to connect products, publish setup help, and view customer activity.
        </Banner>
      ) : null}

      <div {...lockedSectionProps}>
        <ShopifyProductsPanel
          shop={shop}
          apiPublicOrigin={apiPublicOrigin}
          tenantLinked={tenantLinked}
          refreshVersion={productsRefreshVersion}
          onProductStatsChange={handleProductStatsChange}
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
