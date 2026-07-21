"use client";

import {
  Avatar,
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Link,
  Text
} from "@shopify/polaris";
import { StoreIcon } from "@shopify/polaris-icons";

import { RAZZL_MARKETING_URL } from "@/app/shopify/shopify-copilot-preview-video";
import type { ConnectionStatusSummary } from "@/lib/commerce/core/connections/platform-connection-repo";

type Props = {
  shop: string | null;
  status: ConnectionStatusSummary | null;
  oauthStarting?: boolean;
  onConnectStore?: () => void;
};

function storeInitials(name: string | null, domain: string | null): string {
  const source = name?.trim() || domain?.replace(".myshopify.com", "") || "S";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function ShopifyConnectionCard({
  shop,
  status,
  oauthStarting,
  onConnectStore
}: Props) {
  if (!shop) {
    return (
      <Card>
        <BlockStack gap="200">
          <Text as="p" tone="subdued">
            Open this app from your Shopify admin to view connection status.
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            If you just installed the app, return to Apps in Shopify admin and open Razzl Product Setup
            Copilot again.
          </Text>
        </BlockStack>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card>
        <BlockStack gap="400">
          <Banner tone="warning" title="Store not connected">
            Complete OAuth install to connect <strong>{shop}</strong>.
          </Banner>
          <InlineStack align="start">
            <Button variant="primary" loading={oauthStarting} onClick={() => onConnectStore?.()}>
              Connect store
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    );
  }

  if (status.tokenStatus === "reauth_required") {
    return (
      <Card>
        <BlockStack gap="400">
          <Banner tone="critical" title="Store reconnection required">
            Your Shopify authorization expired. Reconnect <strong>{shop}</strong> to continue syncing
            products and billing.
          </Banner>
          <InlineStack align="start">
            <Button variant="primary" loading={oauthStarting} onClick={() => onConnectStore?.()}>
              Reconnect store
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>
    );
  }

  const linked = status.tenantLinked;

  if (linked) {
    return (
      <Card padding="0">
        <Box padding="400">
          <InlineStack align="space-between" blockAlign="center" gap="400">
            <InlineStack gap="300" blockAlign="center" wrap={false}>
              <Avatar
                size="md"
                name={status.storeDisplayName ?? shop}
                initials={storeInitials(status.storeDisplayName, shop)}
              />
              <BlockStack gap="050">
                <InlineStack gap="150" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    {status.storeDisplayName ?? shop}
                  </Text>
                  <Badge tone="success">Connected</Badge>
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  {shop} · {status.tenantName ?? `Razzl account #${status.tenantPk}`}
                </Text>
              </BlockStack>
            </InlineStack>
            <Link url={RAZZL_MARKETING_URL} target="_blank">
              About Razzl
            </Link>
          </InlineStack>
        </Box>
      </Card>
    );
  }

  return (
    <Card padding="0">
      <Banner tone="warning" title="Razzl account not linked">
        Connect your Razzl Studio account to sync products and publish setup help.
      </Banner>

      <Box padding="400">
        <BlockStack gap="400">
          <InlineStack gap="200" blockAlign="center">
            <span className="shopify-connection-heading-icon" aria-hidden="true">
              <StoreIcon />
            </span>
            <Text as="h2" variant="headingMd">
              Connection
            </Text>
            <Badge tone="attention">Action required</Badge>
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
                      <Badge tone="info">{status.installStatus}</Badge>
                    </InlineStack>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Razzl account
                    </Text>
                    <Text as="p" variant="headingSm">
                      Not linked
                    </Text>
                  </BlockStack>
                </BlockStack>
              </InlineGrid>
            </Box>
          </div>
        </BlockStack>
      </Box>
    </Card>
  );
}
