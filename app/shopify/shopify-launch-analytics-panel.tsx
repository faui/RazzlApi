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

const ANALYTICS_EMPTY_ILLUSTRATION = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" fill="none">
    <circle cx="40" cy="40" r="34" stroke="#8C9196" stroke-width="1.5" stroke-dasharray="5 4"/>
    <g transform="translate(24 24)">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <path d="M11.5 14V8.5a1.5 1.5 0 1 1 3 0V14M14.5 14V7.5a1.5 1.5 0 1 1 3 0V14M17.5 14v-2a1.5 1.5 0 1 1 3 0v5.5a5.5 5.5 0 0 1-5.5 5.5h-1.5a4.5 4.5 0 0 1-4.5-4.5V14M11.5 14H9a1.5 1.5 0 0 0-1.5 1.5v1A1.5 1.5 0 0 0 9 18h.5" stroke="#8C9196" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </g>
  </svg>`
)}`;

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
              image={ANALYTICS_EMPTY_ILLUSTRATION}
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
