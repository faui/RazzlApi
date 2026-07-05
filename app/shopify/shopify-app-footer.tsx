"use client";

import { InlineStack, Link, Text } from "@shopify/polaris";

import { RAZZL_MARKETING_URL } from "@/app/shopify/shopify-copilot-preview-video";

const PRIVACY_POLICY_URL = "https://www.razzl.com/privacy-policy";
const SUPPORT_EMAIL = "contact@razzl.com";

export function ShopifyAppFooter() {
  return (
    <footer className="shopify-app-footer">
      <Text as="p" variant="bodySm" tone="subdued" alignment="center">
        Powered by{" "}
        <Link url={RAZZL_MARKETING_URL} target="_blank">
          Razzl
        </Link>
      </Text>
      <InlineStack gap="300" align="center">
        <Link url={PRIVACY_POLICY_URL} target="_blank">
          Privacy policy
        </Link>
        <Link url={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</Link>
      </InlineStack>
    </footer>
  );
}
