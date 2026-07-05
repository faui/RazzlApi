"use client";

import { BlockStack, InlineStack, Text, Tooltip } from "@shopify/polaris";
import { QuestionCircleIcon } from "@shopify/polaris-icons";

export type ProductWorkflowStatus = "unmapped" | "mapped" | "cta_on";

const STATUS_OPTIONS: { value: ProductWorkflowStatus; label: string }[] = [
  { value: "unmapped", label: "Unmapped" },
  { value: "mapped", label: "Mapped" },
  { value: "cta_on", label: "Storefront CTA On" }
];

const CTA_BLOCKED_TOOLTIP =
  "Map an existing copilot or create a new one for this product before enabling the storefront CTA.";

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

type Props = {
  value: ProductWorkflowStatus;
  onChange: (next: ProductWorkflowStatus) => void;
  inlineError?: string | null;
  productTitle: string;
};

export function ProductStatusSelect({ value, onChange, inlineError, productTitle }: Props) {
  return (
    <BlockStack gap="100">
      <select
        className={`shopify-product-status-select shopify-product-status-select--${value}`}
        value={value}
        aria-label={`Status for ${productTitle}`}
        onChange={(event) => onChange(event.target.value as ProductWorkflowStatus)}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {inlineError ? (
        <InlineStack gap="100" blockAlign="start" wrap={false}>
          <Text as="span" tone="critical" variant="bodySm">
            {inlineError}
          </Text>
          <Tooltip content={CTA_BLOCKED_TOOLTIP}>
            <button
              type="button"
              className="shopify-map-first-info"
              aria-label="Why is storefront CTA unavailable?"
            >
              <QuestionCircleIcon />
            </button>
          </Tooltip>
        </InlineStack>
      ) : null}
    </BlockStack>
  );
}
