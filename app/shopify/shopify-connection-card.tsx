"use client";

import {
  Avatar,
  Badge,
  Banner,
  BlockStack,
  Box,
  Card,
  Icon,
  InlineGrid,
  InlineStack,
  Link,
  Text
} from "@shopify/polaris";
import { StoreIcon } from "@shopify/polaris-icons";
import type { ConnectionStatusSummary } from "@/lib/commerce/core/connections/platform-connection-repo";

type Props = {
  shop: string | null;
  status: ConnectionStatusSummary | null;
  showInstallHint?: boolean;
};

function storeInitials(name: string | null, domain: string | null): string {
  const source = name?.trim() || domain?.replace(".myshopify.com", "") || "S";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function ShopifyConnectionCard({ shop, status, showInstallHint }: Props) {
  if (!shop) {
    return (
      <Card>
        <Text as="p" tone="subdued">
          Open this app from your Shopify admin to view connection status.
        </Text>
      </Card>
    );
  }

  if (showInstallHint || !status) {
    return (
      <Card>
        <Banner tone="warning" title="Store not connected">
          Complete OAuth install to connect <strong>{shop}</strong>.
        </Banner>
      </Card>
    );
  }

  const linked = status.tenantLinked;

  return (
    <Card padding="0">
      {linked ? (
        <Banner tone="success" title="Store connected to Razzl">
          Your Shopify store is linked and ready to sync products.
        </Banner>
      ) : (
        <Banner tone="warning" title="Razzl account not linked">
          Connect your Razzl Studio account to sync products and enable storefront CTAs.
        </Banner>
      )}

      <Box padding="400">
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <Icon source={StoreIcon} tone="base" />
            <Text as="h2" variant="headingMd">
              Connection
            </Text>
            {linked ? <Badge tone="success">Live</Badge> : <Badge tone="attention">Action required</Badge>}
          </InlineStack>

          <div className="shopify-connection-panel">
            <Box padding="400">
              <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                <InlineStack gap="300" blockAlign="center">
                  <Avatar
                    size="lg"
                    name={status.storeDisplayName ?? shop}
                    initials={storeInitials(status.storeDisplayName, shop)}
                  />
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Shopify store
                    </Text>
                    <Text as="p" variant="headingSm">
                      {status.storeDisplayName ?? shop}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {shop}
                    </Text>
                  </BlockStack>
                </InlineStack>

                <BlockStack gap="300">
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Install status
                    </Text>
                    <InlineStack align="start">
                      {status.installStatus === "connected" ? (
                        <span className="shopify-connected-pill">{status.installStatus}</span>
                      ) : (
                        <Badge tone="info">{status.installStatus}</Badge>
                      )}
                    </InlineStack>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Razzl account
                    </Text>
                    <Text as="p" variant="headingSm">
                      {linked ? status.tenantName ?? `Tenant #${status.tenantPk}` : "Not linked"}
                    </Text>
                  </BlockStack>
                </BlockStack>
              </InlineGrid>
            </Box>
          </div>

          {linked ? (
            <Text as="p" variant="bodySm" tone="subdued">
              To disconnect, manage your store in{" "}
              <Link url="https://studio.razzl.com/app/profile" target="_blank">
                Razzl Studio
              </Link>
              .
            </Text>
          ) : null}
        </BlockStack>
      </Box>
    </Card>
  );
}
