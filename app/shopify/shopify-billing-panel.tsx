"use client";

import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Select,
  Text
} from "@shopify/polaris";
import { useEffect, useMemo, useState } from "react";

import { useCommerceToast } from "@/app/shopify/shopify-polaris-provider";

type BillingPlan = {
  tierCode: string;
  tierName: string;
  tierFamilyCode: string | null;
  price: number;
  currency: string;
  billingInterval: string;
  billingIntervalCount: number;
  maxProducts: number;
  maxSessionsMonthly: number;
};

type BillingStatusResponse = {
  ok: boolean;
  billingSource?: string;
  platformBillingStatus?: string;
  hasEntitlement?: boolean;
  requiresShopifyBilling?: boolean;
  currentTierCode?: string | null;
  shopifyManageMessage?: string | null;
  plans?: BillingPlan[];
  error?: string;
};

type Props = {
  shop: string;
  apiPublicOrigin: string;
  tenantLinked: boolean;
};

function formatPrice(plan: BillingPlan): string {
  const amount = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: plan.currency || "USD"
  }).format(plan.price);
  const interval =
    plan.billingInterval === "year" || plan.billingIntervalCount >= 12 ? "year" : "month";
  return `${amount}/${interval}`;
}

function redirectToConfirmationUrl(url: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (window.top) {
    window.top.location.href = url;
    return;
  }
  window.location.href = url;
}

export function ShopifyBillingPanel({ shop, apiPublicOrigin, tenantLinked }: Props) {
  const showToast = useCommerceToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<BillingStatusResponse | null>(null);
  const [selectedTierCode, setSelectedTierCode] = useState("");
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!tenantLinked) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setLoading(true);
      }
      setErrorBanner(null);
      try {
        const response = await fetch(
          `${apiPublicOrigin}/api/commerce/billing/status?shop=${encodeURIComponent(shop)}`
        );
        const data = (await response.json()) as BillingStatusResponse;
        if (cancelled) return;
        if (!response.ok || !data.ok) {
          setErrorBanner(data.error ?? "Unable to load billing status");
          return;
        }
        setStatus(data);
        if (data.currentTierCode) {
          setSelectedTierCode(data.currentTierCode);
        } else if (data.plans?.[0]?.tierCode) {
          setSelectedTierCode(data.plans[0].tierCode);
        }
      } catch {
        if (!cancelled) {
          setErrorBanner("Unable to load billing status");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [apiPublicOrigin, shop, tenantLinked]);

  const planOptions = useMemo(
    () =>
      (status?.plans ?? []).map((plan) => ({
        label: `${plan.tierName} — ${formatPrice(plan)}`,
        value: plan.tierCode
      })),
    [status?.plans]
  );

  const selectedPlan = (status?.plans ?? []).find((plan) => plan.tierCode === selectedTierCode);

  async function handleSubscribe() {
    if (!selectedTierCode) {
      return;
    }

    setSubmitting(true);
    setErrorBanner(null);
    try {
      const response = await fetch(`${apiPublicOrigin}/api/commerce/billing/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, tierCode: selectedTierCode })
      });
      const data = (await response.json()) as {
        ok: boolean;
        confirmationUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.confirmationUrl) {
        setErrorBanner(data.error ?? "Unable to start Shopify billing");
        showToast(data.error ?? "Unable to start Shopify billing", { isError: true });
        return;
      }
      redirectToConfirmationUrl(data.confirmationUrl);
    } catch {
      setErrorBanner("Unable to start Shopify billing");
      showToast("Unable to start Shopify billing", { isError: true });
    } finally {
      setSubmitting(false);
    }
  }

  if (!tenantLinked) {
    return null;
  }

  if (loading) {
    return (
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            Billing
          </Text>
          <Text as="p" tone="subdued">
            Loading billing status…
          </Text>
        </BlockStack>
      </Card>
    );
  }

  if (status?.billingSource === "stripe") {
    return (
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingMd">
            Billing
          </Text>
          <Banner tone="info">
            This Razzl account uses Stripe billing. Manage your subscription in Razzl Studio — not
            through Shopify.
          </Banner>
        </BlockStack>
      </Card>
    );
  }

  const billingActive =
    status?.hasEntitlement || status?.platformBillingStatus === "active";

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingMd">
          Billing
        </Text>

        {errorBanner ? (
          <Banner tone="critical" onDismiss={() => setErrorBanner(null)}>
            {errorBanner}
          </Banner>
        ) : null}

        {billingActive ? (
          <Banner tone="success">
            Your Shopify subscription is active
            {status?.currentTierCode ? ` (${status.currentTierCode})` : ""}.
          </Banner>
        ) : (
          <Banner tone="warning">
            Choose a plan and approve Shopify billing before mapping copilots or enabling storefront
            CTAs.
          </Banner>
        )}

        {status?.shopifyManageMessage ? (
          <Text as="p" tone="subdued">
            {status.shopifyManageMessage}
          </Text>
        ) : null}

        {!billingActive && planOptions.length ? (
          <BlockStack gap="200">
            <Select
              label="Plan"
              options={planOptions}
              value={selectedTierCode}
              onChange={setSelectedTierCode}
            />
            {selectedPlan ? (
              <Text as="p" tone="subdued">
                Includes up to {selectedPlan.maxProducts} products and{" "}
                {selectedPlan.maxSessionsMonthly} chat sessions per month.
              </Text>
            ) : null}
            <InlineStack align="end">
              <Button variant="primary" loading={submitting} onClick={() => void handleSubscribe()}>
                Approve plan in Shopify
              </Button>
            </InlineStack>
          </BlockStack>
        ) : null}
      </BlockStack>
    </Card>
  );
}
