"use client";

import { BlockStack, Card, Text } from "@shopify/polaris";

import { ShopifyCopilotPreviewVideo } from "@/app/shopify/shopify-copilot-preview-video";

export function ShopifyCustomerPreviewPanel() {
  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="100">
          <Text as="h2" variant="headingMd">
            What your customers will see
          </Text>
          <Text as="p" tone="subdued">
            See the Razzl Setup Copilot experience from your customer&apos;s perspective.
          </Text>
        </BlockStack>

        <ShopifyCopilotPreviewVideo variant="full" />

        <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
          This is the guided setup experience your customers get — no support tickets, no confusion.
        </Text>
      </BlockStack>
    </Card>
  );
}
