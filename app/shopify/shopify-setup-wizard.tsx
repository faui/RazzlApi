"use client";

import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Icon,
  InlineStack,
  ProgressBar,
  SkeletonBodyText,
  Text
} from "@shopify/polaris";
import { CheckCircleIcon, ExternalIcon } from "@shopify/polaris-icons";
import { useEffect, useMemo, useState } from "react";

import { OnboardingStepper } from "@/app/shopify/onboarding-stepper";
import { useCommerceToast } from "@/app/shopify/shopify-polaris-provider";
import {
  deriveSetupSteps,
  isSetupComplete,
  isSubscriptionStepComplete
} from "@/app/shopify/shopify-setup-state";
import {
  loadProductsAfterSync,
  type ProductReadResult
} from "@/app/shopify/shopify-sync-retry";

export type BillingPlan = {
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
  plans?: BillingPlan[];
  error?: string;
};

type LinkStartResponse = {
  ok: boolean;
  loginUrl?: string;
  signupUrl?: string;
  error?: string;
};

type WizardProduct = {
  externalProductId: string;
};

type ProductsResponse = ProductReadResult<WizardProduct> & {
  studioDashboardUrl?: string;
};

type Props = {
  shop: string;
  tenantLinked: boolean;
  tenantName: string | null;
  apiPublicOrigin: string;
  productCount: number;
  productStatsReady: boolean;
  studioDashboardUrl: string | null;
  onSyncComplete: () => void;
  onSetupCompleteChange?: (complete: boolean) => void;
};

function planCadence(plan: BillingPlan): "monthly" | "yearly" {
  return plan.billingInterval === "year" || plan.billingIntervalCount >= 12
    ? "yearly"
    : "monthly";
}

function formatPrice(plan: BillingPlan): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: plan.currency || "USD",
    maximumFractionDigits: plan.price % 1 === 0 ? 0 : 2
  }).format(Number(plan.price));
}

function studioSubscriptionUrl(studioDashboardUrl: string | null): string | null {
  if (!studioDashboardUrl) return null;
  return studioDashboardUrl.replace(/\/app\/dashboard(?:\?.*)?$/, "/app/subscription");
}

function redirectToShopifyApproval(url: string) {
  if (window.top) {
    window.top.location.href = url;
    return;
  }
  window.location.href = url;
}

export function ShopifySetupWizard({
  shop,
  tenantLinked,
  tenantName,
  apiPublicOrigin,
  productCount,
  productStatsReady,
  studioDashboardUrl,
  onSyncComplete,
  onSetupCompleteChange
}: Props) {
  const showToast = useCommerceToast();
  const [billingStatus, setBillingStatus] = useState<BillingStatusResponse | null>(null);
  const [billingLoading, setBillingLoading] = useState(tenantLinked);
  const [billingSubmittingTier, setBillingSubmittingTier] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncedProductCount, setSyncedProductCount] = useState(0);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [cadence, setCadence] = useState<"monthly" | "yearly">("monthly");
  const [changingSubscription, setChangingSubscription] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!tenantLinked) return;
      try {
        const response = await fetch(
          `${apiPublicOrigin}/api/commerce/billing/status?shop=${encodeURIComponent(shop)}`
        );
        const data = (await response.json()) as BillingStatusResponse;
        if (!response.ok || !data.ok) {
          throw new Error(data.error ?? "Unable to load subscription status");
        }
        if (cancelled) return;
        setBillingStatus(data);
        const currentPlan = data.plans?.find((plan) => plan.tierCode === data.currentTierCode);
        if (currentPlan) {
          setCadence(planCadence(currentPlan));
        }
      } catch (error) {
        if (!cancelled) {
          setErrorBanner(
            error instanceof Error ? error.message : "Unable to load subscription status"
          );
        }
      } finally {
        if (!cancelled) setBillingLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [apiPublicOrigin, shop, tenantLinked]);

  const effectiveProductCount = Math.max(productCount, syncedProductCount);
  const steps = useMemo(
    () =>
      deriveSetupSteps({
        tenantLinked,
        billingStatus,
        productCount: effectiveProductCount
      }),
    [billingStatus, effectiveProductCount, tenantLinked]
  );
  const setupComplete =
    !billingLoading && (productStatsReady || syncedProductCount > 0) && isSetupComplete(steps);
  const subscriptionComplete = isSubscriptionStepComplete(tenantLinked, billingStatus);
  const completedCount = steps.filter((step) => step.complete).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  useEffect(() => {
    onSetupCompleteChange?.(setupComplete);
  }, [onSetupCompleteChange, setupComplete]);

  const visiblePlans = useMemo(
    () => (billingStatus?.plans ?? []).filter((plan) => planCadence(plan) === cadence),
    [billingStatus?.plans, cadence]
  );
  const hasMonthlyPlans = (billingStatus?.plans ?? []).some(
    (plan) => planCadence(plan) === "monthly"
  );
  const hasYearlyPlans = (billingStatus?.plans ?? []).some(
    (plan) => planCadence(plan) === "yearly"
  );

  async function openStudioLink(mode: "login" | "signup") {
    setErrorBanner(null);
    try {
      const startUrl = `${apiPublicOrigin}/api/commerce/connection/link/start?shop=${encodeURIComponent(shop)}`;
      const response = await fetch(startUrl);
      const data = (await response.json()) as LinkStartResponse;
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to start account linking");
      }
      const target = mode === "login" ? data.loginUrl : data.signupUrl;
      if (!target) {
        throw new Error("Studio did not return an account-link URL");
      }
      window.open(target, "_blank", "noopener,noreferrer");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start account linking";
      setErrorBanner(message);
      showToast(message, { isError: true });
    }
  }

  async function choosePlan(tierCode: string) {
    setBillingSubmittingTier(tierCode);
    setErrorBanner(null);
    try {
      const response = await fetch(`${apiPublicOrigin}/api/commerce/billing/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, tierCode })
      });
      const data = (await response.json()) as {
        ok: boolean;
        confirmationUrl?: string;
        error?: string;
      };
      if (!response.ok || !data.ok || !data.confirmationUrl) {
        throw new Error(data.error ?? "Unable to start Shopify billing");
      }
      redirectToShopifyApproval(data.confirmationUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to start Shopify billing";
      setErrorBanner(message);
      showToast(message, { isError: true });
    } finally {
      setBillingSubmittingTier(null);
    }
  }

  async function syncProducts() {
    setSyncing(true);
    setErrorBanner(null);
    try {
      const syncResponse = await fetch(
        `${apiPublicOrigin}/api/commerce/sync?shop=${encodeURIComponent(shop)}`,
        { method: "POST" }
      );
      const syncData = (await syncResponse.json()) as {
        ok: boolean;
        stats?: { productsSeen?: number };
        code?: string;
        error?: string;
      };
      if (!syncResponse.ok || !syncData.ok) {
        const message =
          syncData.code === "BILLING_REQUIRED"
            ? "Complete the subscription step before syncing products."
            : syncData.code === "TOKEN_REAUTH_REQUIRED"
              ? "Reconnect your Shopify store, then try sync again."
              : (syncData.error ?? "Sync failed");
        throw new Error(message);
      }

      const productsSeen = syncData.stats?.productsSeen ?? 0;
      const productsResult = await loadProductsAfterSync(async () => {
        const response = await fetch(
          `${apiPublicOrigin}/api/commerce/products?shop=${encodeURIComponent(shop)}`
        );
        const data = (await response.json()) as ProductsResponse;
        return response.ok ? data : { ...data, ok: false };
      }, productsSeen);

      if (!productsResult.ok) {
        throw new Error(productsResult.error ?? "Unable to reload products after sync");
      }

      const visibleCount = productsResult.items?.length ?? 0;
      if (productsSeen > 0 && visibleCount === 0) {
        throw new Error(
          "Sync finished, but the product list is still updating. Wait a moment and try again."
        );
      }

      setSyncedProductCount(visibleCount);
      onSyncComplete();
      showToast(`Sync complete — ${productsSeen} products processed`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      setErrorBanner(message);
      showToast(message, { isError: true });
    } finally {
      setSyncing(false);
    }
  }

  if (setupComplete && !changingSubscription) {
    const stripeSubscriptionUrl = studioSubscriptionUrl(studioDashboardUrl);
    return (
      <Card padding="0">
        <Box padding="400" background="bg-surface-secondary">
          <InlineStack align="space-between" blockAlign="center" gap="400">
            <InlineStack gap="200" blockAlign="center" wrap={false}>
              <Icon source={CheckCircleIcon} tone="success" />
              <BlockStack gap="050">
                <InlineStack gap="150" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    Razzl is ready
                  </Text>
                  <Badge tone="success">Setup complete</Badge>
                </InlineStack>
                <Text as="p" tone="subdued">
                  {effectiveProductCount} product{effectiveProductCount === 1 ? "" : "s"} synced
                  {tenantName ? ` · ${tenantName} connected` : ""}
                </Text>
              </BlockStack>
            </InlineStack>

            <InlineStack gap="200" align="end">
              {studioDashboardUrl ? (
                <Button url={studioDashboardUrl} external icon={ExternalIcon}>
                  Open Razzl Studio
                </Button>
              ) : null}
              {billingStatus?.billingSource === "stripe" ? (
                stripeSubscriptionUrl ? (
                  <Button url={stripeSubscriptionUrl} external>
                    Subscription
                  </Button>
                ) : null
              ) : (
                <Button onClick={() => setChangingSubscription(true)}>Subscription</Button>
              )}
            </InlineStack>
          </InlineStack>
        </Box>
      </Card>
    );
  }

  return (
    <Card>
      <BlockStack gap="500">
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingLg">
                Set up Razzl Product Setup Copilot
              </Text>
              <Text as="p" tone="subdued">
                Complete these steps to connect products, publish setup help, and see customer
                activity.
              </Text>
            </BlockStack>
            <Text as="span" variant="bodySm" fontWeight="semibold">
              {completedCount} of {steps.length} complete
            </Text>
          </InlineStack>
          <ProgressBar progress={progress} size="small" tone="primary" />
        </BlockStack>

        {errorBanner ? (
          <Banner tone="critical" onDismiss={() => setErrorBanner(null)}>
            {errorBanner}
          </Banner>
        ) : null}

        <OnboardingStepper steps={steps} />

        {!tenantLinked ? (
          <Box padding="400" background="bg-surface-secondary" borderRadius="300">
            <BlockStack gap="300">
              <BlockStack gap="100">
                <Text as="h3" variant="headingMd">
                  1. Link Razzl account
                </Text>
                <Text as="p" tone="subdued">
                  Connect this store to an existing Razzl account or create a new one in Studio.
                </Text>
              </BlockStack>
              <InlineStack gap="200">
                <Button variant="primary" onClick={() => void openStudioLink("login")}>
                  Connect existing Razzl account
                </Button>
                <Button onClick={() => void openStudioLink("signup")}>Create Razzl account</Button>
              </InlineStack>
            </BlockStack>
          </Box>
        ) : !subscriptionComplete || changingSubscription ? (
          <Box padding="400" background="bg-surface-secondary" borderRadius="300">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingMd">
                    2. Choose subscription
                  </Text>
                  <Text as="p" tone="subdued">
                    Linked to <strong>{tenantName ?? "your Razzl account"}</strong>. Shopify will
                    show the final approval screen before any charge begins.
                  </Text>
                </BlockStack>
                {changingSubscription ? (
                  <Button variant="plain" onClick={() => setChangingSubscription(false)}>
                    Keep current plan
                  </Button>
                ) : null}
              </InlineStack>

              {billingLoading ? (
                <SkeletonBodyText lines={4} />
              ) : billingStatus?.billingSource === "stripe" ? (
                <Banner tone={billingStatus.hasEntitlement ? "success" : "warning"}>
                  This account uses Stripe billing. Manage its subscription in Razzl Studio.
                </Banner>
              ) : (
                <BlockStack gap="400">
                  {hasMonthlyPlans && hasYearlyPlans ? (
                    <InlineStack gap="200">
                      <Button
                        variant={cadence === "monthly" ? "primary" : undefined}
                        onClick={() => setCadence("monthly")}
                      >
                        Monthly
                      </Button>
                      <Button
                        variant={cadence === "yearly" ? "primary" : undefined}
                        onClick={() => setCadence("yearly")}
                      >
                        Yearly
                      </Button>
                    </InlineStack>
                  ) : null}

                  {visiblePlans.length ? (
                    <div className="shopify-plan-grid">
                      {visiblePlans.map((plan) => {
                        const current = plan.tierCode === billingStatus?.currentTierCode;
                        return (
                          <div
                            key={plan.tierCode}
                            className={`shopify-plan-card${current ? " shopify-plan-card--current" : ""}`}
                          >
                            <BlockStack gap="300">
                              <InlineStack align="space-between" blockAlign="start" gap="200">
                                <Text as="h4" variant="headingMd">
                                  {plan.tierName}
                                </Text>
                                {current ? <Badge tone="success">Current</Badge> : null}
                              </InlineStack>
                              <InlineStack gap="100" blockAlign="end">
                                <Text as="span" variant="heading2xl">
                                  {formatPrice(plan)}
                                </Text>
                                <Text as="span" tone="subdued">
                                  /{planCadence(plan) === "yearly" ? "year" : "month"}
                                </Text>
                              </InlineStack>
                              <BlockStack gap="100">
                                <Text as="p" variant="bodySm">
                                  Up to {plan.maxProducts.toLocaleString()} products
                                </Text>
                                <Text as="p" variant="bodySm">
                                  {plan.maxSessionsMonthly.toLocaleString()} setup sessions/month
                                </Text>
                              </BlockStack>
                              <Button
                                variant={current ? undefined : "primary"}
                                disabled={current && subscriptionComplete}
                                loading={billingSubmittingTier === plan.tierCode}
                                onClick={() => void choosePlan(plan.tierCode)}
                                fullWidth
                              >
                                {current && subscriptionComplete
                                  ? "Current plan"
                                  : `Choose ${plan.tierName}`}
                              </Button>
                            </BlockStack>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Banner tone="warning">No Shopify billing plans are currently available.</Banner>
                  )}
                </BlockStack>
              )}
            </BlockStack>
          </Box>
        ) : (
          <Box padding="400" background="bg-surface-secondary" borderRadius="300">
            <BlockStack gap="300">
              <BlockStack gap="100">
                <Text as="h3" variant="headingMd">
                  3. Sync products
                </Text>
                <Text as="p" tone="subdued">
                  Import your Shopify catalog. The product list will stay in a loading state until
                  synced rows are visible.
                </Text>
              </BlockStack>
              <InlineStack gap="200" blockAlign="center">
                <Button variant="primary" loading={syncing} onClick={() => void syncProducts()}>
                  Sync products
                </Button>
                {!productStatsReady ? (
                  <Text as="span" variant="bodySm" tone="subdued">
                    Checking existing products…
                  </Text>
                ) : null}
              </InlineStack>
            </BlockStack>
          </Box>
        )}
      </BlockStack>
    </Card>
  );
}
