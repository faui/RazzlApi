export type SetupBillingStatus = {
  billingSource?: string;
  platformBillingStatus?: string;
  hasEntitlement?: boolean;
};

export type SetupStep = {
  id: "link" | "subscribe" | "sync";
  label: string;
  complete: boolean;
  current: boolean;
};

export function isSubscriptionStepComplete(
  tenantLinked: boolean,
  billingStatus: SetupBillingStatus | null
): boolean {
  if (!tenantLinked || !billingStatus) {
    return false;
  }

  if (billingStatus.billingSource === "stripe") {
    return billingStatus.hasEntitlement === true;
  }

  return (
    billingStatus.platformBillingStatus === "active" ||
    billingStatus.hasEntitlement === true
  );
}

export function deriveSetupSteps(input: {
  tenantLinked: boolean;
  billingStatus: SetupBillingStatus | null;
  productCount: number;
}): SetupStep[] {
  const subscriptionComplete = isSubscriptionStepComplete(
    input.tenantLinked,
    input.billingStatus
  );
  const syncComplete = subscriptionComplete && input.productCount > 0;

  return [
    {
      id: "link",
      label: "Link Razzl account",
      complete: input.tenantLinked,
      current: !input.tenantLinked
    },
    {
      id: "subscribe",
      label: "Choose subscription",
      complete: subscriptionComplete,
      current: input.tenantLinked && !subscriptionComplete
    },
    {
      id: "sync",
      label: "Sync products",
      complete: syncComplete,
      current: subscriptionComplete && !syncComplete
    }
  ];
}

export function isSetupComplete(steps: SetupStep[]): boolean {
  return steps.every((step) => step.complete);
}
