"use client";

import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  EmptyState,
  Icon,
  InlineGrid,
  InlineStack,
  SkeletonBodyText,
  Text
} from "@shopify/polaris";
import { ChartVerticalIcon, CursorIcon, RefreshIcon } from "@shopify/polaris-icons";
import { useCallback, useEffect, useState } from "react";

import { useCommerceToast } from "@/app/shopify/shopify-polaris-provider";

type LaunchTotals = {
  totalClicks: number;
  clicksLast7Days: number;
  clicksLast30Days: number;
};

type ProductLaunchRow = {
  externalProductId: string;
  title: string | null;
  clickCount: number;
  lastClickAt: string | null;
};

type Props = {
  shop: string;
  apiPublicOrigin: string;
  tenantLinked: boolean;
};

function AnalyticsStatCard({
  label,
  value,
  icon
}: {
  label: string;
  value: number;
  icon: typeof CursorIcon;
}) {
  return (
    <Box padding="400" background="bg-surface-secondary" borderRadius="200" minHeight="100%">
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="span" variant="bodySm" tone="subdued">
            {label}
          </Text>
          <Icon source={icon} tone="subdued" />
        </InlineStack>
        <Text as="p" variant="heading2xl">
          {value.toLocaleString()}
        </Text>
        <Text as="span" variant="bodySm" tone="subdued">
          {value > 0 ? "↑ tracking active" : "— no trend yet"}
        </Text>
      </BlockStack>
    </Box>
  );
}

export function ShopifyLaunchAnalyticsPanel({ shop, apiPublicOrigin, tenantLinked }: Props) {
  const showToast = useCommerceToast();
  const [totals, setTotals] = useState<LaunchTotals | null>(null);
  const [products, setProducts] = useState<ProductLaunchRow[]>([]);
  const [loading, setLoading] = useState(tenantLinked);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    const response = await fetch(
      `${apiPublicOrigin}/api/commerce/analytics/launches?shop=${encodeURIComponent(shop)}`
    );
    const data = (await response.json()) as {
      ok: boolean;
      totals?: LaunchTotals;
      products?: ProductLaunchRow[];
      error?: string;
    };
    if (!response.ok || !data.ok) {
      throw new Error(data.error ?? "Unable to load launch analytics");
    }
    return {
      totals: data.totals ?? { totalClicks: 0, clicksLast7Days: 0, clicksLast30Days: 0 },
      products: data.products ?? []
    };
  }, [apiPublicOrigin, shop]);

  useEffect(() => {
    if (!tenantLinked) return;

    let cancelled = false;

    const run = async () => {
      setErrorBanner(null);
      try {
        const result = await fetchAnalytics();
        if (cancelled) return;
        setTotals(result.totals);
        setProducts(result.products);
      } catch (error) {
        if (!cancelled) {
          setErrorBanner(error instanceof Error ? error.message : "Unable to load launch analytics");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [fetchAnalytics, tenantLinked]);

  async function handleRefresh() {
    setLoading(true);
    setErrorBanner(null);
    try {
      const result = await fetchAnalytics();
      setTotals(result.totals);
      setProducts(result.products);
      showToast("Analytics refreshed");
    } catch (error) {
      setErrorBanner(error instanceof Error ? error.message : "Refresh failed");
      showToast("Refresh failed", { isError: true });
    } finally {
      setLoading(false);
    }
  }

  if (!tenantLinked) return null;

  const hasData = (totals?.totalClicks ?? 0) > 0;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="start">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">
              Setup help analytics
            </Text>
            <Text as="p" tone="subdued">
              CTA clicks from your storefront product pages.
            </Text>
          </BlockStack>
          <Button icon={RefreshIcon} onClick={() => void handleRefresh()} loading={loading} accessibilityLabel="Refresh analytics" />
        </InlineStack>

        {errorBanner ? (
          <Banner tone="critical" onDismiss={() => setErrorBanner(null)}>
            {errorBanner}
          </Banner>
        ) : null}

        {loading && !totals ? (
          <SkeletonBodyText lines={4} />
        ) : totals ? (
          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
            <AnalyticsStatCard label="Last 7 days" value={totals.clicksLast7Days} icon={CursorIcon} />
            <AnalyticsStatCard label="Last 30 days" value={totals.clicksLast30Days} icon={ChartVerticalIcon} />
            <AnalyticsStatCard label="All time" value={totals.totalClicks} icon={ChartVerticalIcon} />
          </InlineGrid>
        ) : null}

        {!loading && totals && !hasData ? (
          <Box padding="600" background="bg-surface-secondary" borderRadius="200">
            <EmptyState
              heading="No clicks yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              fullWidth
            >
              <p>
                Enable the storefront CTA on a mapped product to start tracking setup help usage.
              </p>
            </EmptyState>
          </Box>
        ) : null}

        {products.length > 0 ? (
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Top products
              </Text>
              {products.slice(0, 8).map((row) => (
                <InlineStack key={row.externalProductId} align="space-between">
                  <Text as="span" variant="bodyMd">
                    {row.title ?? `Product ${row.externalProductId}`}
                  </Text>
                  <Text as="span" variant="bodySm" tone="subdued">
                    {row.clickCount} clicks
                  </Text>
                </InlineStack>
              ))}
            </BlockStack>
          </Box>
        ) : null}
      </BlockStack>
    </Card>
  );
}
