"use client";

import { Link, Text } from "@shopify/polaris";

import { RAZZL_MARKETING_URL } from "@/app/shopify/shopify-copilot-preview-video";

export function ShopifyAppFooter() {
  return (
    <footer className="shopify-app-footer">
      <Text as="p" variant="bodySm" tone="subdued" alignment="center">
        Powered by{" "}
        <Link url={RAZZL_MARKETING_URL} target="_blank">
          Razzl
        </Link>
      </Text>
    </footer>
  );
}
