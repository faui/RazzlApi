"use client";

import { BlockStack, Button, Card, InlineStack, Text } from "@shopify/polaris";
import { useState } from "react";

import { ShopifyCopilotPreviewVideoInteractive } from "@/app/shopify/shopify-copilot-preview-video";

export function ShopifyCustomerPreviewPanel() {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <BlockStack gap={expanded ? "400" : "0"}>
        <InlineStack align="space-between" blockAlign="center" gap="400">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">
              Preview the customer experience
            </Text>
            <Text as="p" tone="subdued">
              See the guided setup experience customers can open from your product pages.
            </Text>
          </BlockStack>
          <Button
            onClick={() => setExpanded((current) => !current)}
            accessibilityLabel={expanded ? "Hide customer experience preview" : "Show customer experience preview"}
          >
            {expanded ? "Hide preview" : "Show preview"}
          </Button>
        </InlineStack>

        {expanded ? (
          <div id="shopify-customer-experience-preview">
            <BlockStack gap="300">
              <ShopifyCopilotPreviewVideoInteractive />

              <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                This is the experience customers see after choosing setup help on a product page.
              </Text>
            </BlockStack>
          </div>
        ) : null}
      </BlockStack>
    </Card>
  );
}
