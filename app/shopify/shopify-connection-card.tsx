"use client";

import {
  Avatar,
  Badge,
  BlockStack,
  Box,
  Card,
  InlineGrid,
  InlineStack,
  Link,
  Text
} from "@shopify/polaris";
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

function installStatusBadge(status: ConnectionStatusSummary["installStatus"]) {
  switch (status) {
    case "connected":
      return <Badge tone="success">Connected</Badge>;
    case "installed":
      return <Badge tone="info">Installed</Badge>;
    case "uninstalled":
      return <Badge tone="critical">Uninstalled</Badge>;
    case "disconnected":
      return <Badge tone="warning">Disconnected</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
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
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            Connection
          </Text>
          <Text as="p" tone="subdued">
            Not installed yet. Complete OAuth install to connect <strong>{shop}</strong>.
          </Text>
        </BlockStack>
      </Card>
    );
  }

  const linked = status.tenantLinked;

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Connection
          </Text>
          {linked ? (
            <InlineStack gap="200" blockAlign="center">
              <Box
                as="span"
                background="bg-fill-success"
                borderRadius="full"
                minWidth="8px"
                minHeight="8px"
              />
              <Text as="span" tone="success" variant="bodySm">
                Connected
              </Text>
            </InlineStack>
          ) : (
            <Badge tone="attention">Account not linked</Badge>
          )}
        </InlineStack>

        <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
          <InlineStack gap="300" blockAlign="center">
            <Avatar
              customer
              size="md"
              name={status.storeDisplayName ?? shop}
              initials={storeInitials(status.storeDisplayName, shop)}
            />
            <BlockStack gap="100">
              <Text as="span" variant="bodySm" tone="subdued">
                Shopify store
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                {status.storeDisplayName ?? shop}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {shop}
              </Text>
            </BlockStack>
          </InlineStack>

          <BlockStack gap="200">
            <InlineStack align="space-between">
              <Text as="span" variant="bodySm" tone="subdued">
                Install status
              </Text>
              {installStatusBadge(status.installStatus)}
            </InlineStack>
            <BlockStack gap="100">
              <Text as="span" variant="bodySm" tone="subdued">
                Razzl account
              </Text>
              <Text as="p" variant="bodyMd" fontWeight="semibold">
                {linked ? status.tenantName ?? `Tenant #${status.tenantPk}` : "Not linked"}
              </Text>
            </BlockStack>
          </BlockStack>
        </InlineGrid>

        {linked ? (
          <Text as="p" variant="bodySm" tone="subdued">
            To disconnect, manage your store connection in{" "}
            <Link url="https://studio.razzl.com/app/profile" target="_blank">
              Razzl Studio
            </Link>
            .
          </Text>
        ) : null}
      </BlockStack>
    </Card>
  );
}
