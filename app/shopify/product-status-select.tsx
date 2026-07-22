"use client";

import { Badge, BlockStack, Button, InlineStack, Text } from "@shopify/polaris";

export type ProductWorkflowStatus = "unmapped" | "mapped" | "cta_on";
export type ProductStatusFilter = "all" | "unmapped" | "mapped" | "cta_on";

export function getProductWorkflowStatus(product: {
  productPk: number | null;
  storefrontCtaEnabled: boolean;
}): ProductWorkflowStatus {
  if (!product.productPk) {
    return "unmapped";
  }
  if (product.storefrontCtaEnabled) {
    return "cta_on";
  }
  return "mapped";
}

export function productMatchesStatusFilter(
  product: { productPk: number | null; storefrontCtaEnabled: boolean },
  filter: ProductStatusFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "unmapped") return !product.productPk;
  if (filter === "mapped") return Boolean(product.productPk);
  return Boolean(product.productPk) && product.storefrontCtaEnabled;
}

type Props = {
  value: ProductWorkflowStatus;
  onToggle: (enabled: boolean) => void;
  inlineError?: string | null;
  productTitle: string;
  loading?: boolean;
};

export function ProductExperienceControl({
  value,
  onToggle,
  inlineError,
  productTitle,
  loading = false
}: Props) {
  if (value === "unmapped") {
    return (
      <Text as="span" tone="subdued" variant="bodySm">
        Connect a copilot first
      </Text>
    );
  }

  const isLive = value === "cta_on";

  return (
    <BlockStack gap="100">
      <InlineStack gap="200" blockAlign="center" wrap={false}>
        <Badge tone={isLive ? "success" : "info"}>{isLive ? "Live" : "Hidden"}</Badge>
        <Button
          size="slim"
          variant={isLive ? "plain" : "primary"}
          accessibilityLabel={`${isLive ? "Turn off" : "Turn on"} setup help for ${productTitle}`}
          loading={loading}
          disabled={loading}
          onClick={() => onToggle(!isLive)}
        >
          {isLive ? "Turn off" : "Turn on"}
        </Button>
      </InlineStack>
      {inlineError ? (
        <Text as="span" tone="critical" variant="bodySm">
          {inlineError}
        </Text>
      ) : null}
    </BlockStack>
  );
}
