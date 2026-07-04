import { BlockStack, Icon, Text } from "@shopify/polaris";
import { CheckIcon } from "@shopify/polaris-icons";

type Step = {
  id: string;
  label: string;
  complete: boolean;
  current: boolean;
};

type Props = {
  steps: Step[];
};

export function OnboardingStepper({ steps }: Props) {
  return (
    <BlockStack gap="300">
      {steps.map((step, index) => (
        <div key={step.id} className="shopify-onboarding-step">
          <div
            className={`shopify-onboarding-step__marker${
              step.complete
                ? " shopify-onboarding-step__marker--complete"
                : step.current
                  ? " shopify-onboarding-step__marker--current"
                  : ""
            }`}
          >
            {step.complete ? <Icon source={CheckIcon} tone="success" /> : index + 1}
          </div>
          <BlockStack gap="100">
            <Text
              as="span"
              variant="bodyMd"
              fontWeight={step.current ? "semibold" : "regular"}
              tone={step.complete ? "subdued" : undefined}
            >
              {step.label}
            </Text>
            {step.current && !step.complete ? (
              <Text as="span" variant="bodySm" tone="subdued">
                Current step
              </Text>
            ) : null}
          </BlockStack>
        </div>
      ))}
    </BlockStack>
  );
}
