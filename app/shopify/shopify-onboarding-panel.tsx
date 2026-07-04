"use client";

import {
  BlockStack,
  Button,
  Card,
  Collapsible,
  Icon,
  InlineStack,
  ProgressBar,
  Text
} from "@shopify/polaris";
import { CheckCircleIcon, CircleChevronRightIcon } from "@shopify/polaris-icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useCommerceToast } from "@/app/shopify/shopify-polaris-provider";

type LinkStartResponse = {
  ok: boolean;
  loginUrl?: string;
  signupUrl?: string;
  error?: string;
};

type ProductStats = {
  productCount: number;
  mappedCount: number;
  ctaEnabledCount: number;
};

type Props = {
  shop: string;
  tenantLinked: boolean;
  tenantName: string | null;
  apiPublicOrigin: string;
  productStats: ProductStats;
};

type Step = {
  id: string;
  label: string;
  complete: boolean;
  current: boolean;
};

export function ShopifyOnboardingPanel({
  shop,
  tenantLinked,
  tenantName,
  apiPublicOrigin,
  productStats
}: Props) {
  const showToast = useCommerceToast();
  const [showChecklistDetails, setShowChecklistDetails] = useState(true);
  const [animated, setAnimated] = useState(false);

  const steps: Step[] = useMemo(
    () => [
      {
        id: "link",
        label: "Link your Razzl Studio account",
        complete: tenantLinked,
        current: !tenantLinked
      },
      {
        id: "sync",
        label: "Sync products from Shopify",
        complete: tenantLinked && productStats.productCount > 0,
        current: tenantLinked && productStats.productCount === 0
      },
      {
        id: "map",
        label: "Map products to copilots and enable storefront CTA",
        complete:
          tenantLinked &&
          productStats.mappedCount > 0 &&
          productStats.ctaEnabledCount > 0,
        current:
          tenantLinked &&
          productStats.productCount > 0 &&
          (productStats.mappedCount === 0 || productStats.ctaEnabledCount === 0)
      }
    ],
    [tenantLinked, productStats]
  );

  const completedCount = steps.filter((step) => step.complete).length;
  const allComplete = completedCount === steps.length;
  const checklistOpen = !allComplete || showChecklistDetails;

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimated(true), 120);
    return () => window.clearTimeout(timer);
  }, []);

  const openStudioLink = useCallback(
    async (mode: "login" | "signup") => {
      const startUrl = `${apiPublicOrigin}/api/commerce/connection/link/start?shop=${encodeURIComponent(shop)}`;
      const response = await fetch(startUrl);
      const data = (await response.json()) as LinkStartResponse;
      if (!data.ok) {
        showToast(data.error ?? "Unable to start account linking", { isError: true });
        return;
      }

      const target = mode === "login" ? data.loginUrl : data.signupUrl;
      if (target) {
        window.open(target, "_blank", "noopener,noreferrer");
      }
    },
    [apiPublicOrigin, shop, showToast]
  );

  if (allComplete && !showChecklistDetails) {
    return (
      <Card>
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Icon source={CheckCircleIcon} tone="success" />
            <Text as="p" variant="bodyMd">
              Setup complete — your storefront CTA is ready.
            </Text>
          </InlineStack>
          <Button variant="plain" onClick={() => setShowChecklistDetails(true)}>
            Show checklist
          </Button>
        </InlineStack>
      </Card>
    );
  }

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h2" variant="headingMd">
              Onboarding
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              {completedCount} of {steps.length} steps complete
            </Text>
          </InlineStack>
          <ProgressBar progress={(completedCount / steps.length) * 100} size="small" tone="primary" />
        </BlockStack>

        {!tenantLinked ? (
          <BlockStack gap="300">
            <Text as="p" tone="subdued">
              Connect this Shopify store to your Razzl Studio account.
            </Text>
            <InlineStack gap="200">
              <Button variant="primary" onClick={() => void openStudioLink("login")}>
                Connect existing Razzl account
              </Button>
              <Button onClick={() => void openStudioLink("signup")}>
                Create Razzl account
              </Button>
            </InlineStack>
          </BlockStack>
        ) : (
          <Text as="p" tone="subdued">
            Linked to <strong>{tenantName ?? "your Razzl account"}</strong>. Sync products and map
            copilots below.
          </Text>
        )}

        <Collapsible open={checklistOpen} id="onboarding-steps">
          <BlockStack gap="300">
            {steps.map((step) => (
              <InlineStack key={step.id} gap="300" blockAlign="start" wrap={false}>
                <div
                  style={{
                    opacity: animated && step.complete ? 1 : 0.85,
                    transform: animated && step.complete ? "scale(1)" : "scale(0.95)",
                    transition: "transform 0.25s ease, opacity 0.25s ease"
                  }}
                >
                  <Icon
                    source={step.complete ? CheckCircleIcon : CircleChevronRightIcon}
                    tone={step.complete ? "success" : step.current ? "primary" : "subdued"}
                  />
                </div>
                <Text
                  as="span"
                  variant="bodyMd"
                  fontWeight={step.current ? "semibold" : "regular"}
                  tone={step.complete ? "subdued" : undefined}
                >
                  {step.label}
                </Text>
              </InlineStack>
            ))}
          </BlockStack>
        </Collapsible>

        {allComplete ? (
          <Button variant="plain" onClick={() => setShowChecklistDetails(false)}>
            Hide checklist
          </Button>
        ) : null}
      </BlockStack>
    </Card>
  );
}
