"use client";

import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  FormLayout,
  Icon,
  InlineGrid,
  InlineStack,
  Select,
  SkeletonBodyText,
  Text
} from "@shopify/polaris";
import { ChatIcon, ExternalIcon } from "@shopify/polaris-icons";
import { useCallback, useEffect, useState } from "react";

import { useCommerceToast } from "@/app/shopify/shopify-polaris-provider";
import { ShopifyCopilotPreviewVideo } from "@/app/shopify/shopify-copilot-preview-video";
import { ShopifySwitch } from "@/app/shopify/shopify-switch";

type CtaConfig = {
  ctaEnabledDefault: boolean;
  ctaLabelDefault: string;
  ctaOpenMode: "same_tab" | "new_tab";
  ctaStyleMode: "inherit_theme" | "button" | "link" | "badge";
  showPoweredByRazzl: boolean;
  fallbackBehavior: string;
};

type ThemeInstructions = {
  title: string;
  steps: string[];
  deepLinkUrl: string | null;
};

type Props = {
  shop: string;
  apiPublicOrigin: string;
  tenantLinked: boolean;
};

const LABEL_OPTIONS = [
  "Setup help",
  "Assembly help",
  "Installation help",
  "Ask setup copilot",
  "Product setup help"
];

export function ShopifyCtaSettingsPanel({ shop, apiPublicOrigin, tenantLinked }: Props) {
  const showToast = useCommerceToast();
  const [config, setConfig] = useState<CtaConfig | null>(null);
  const [themeInstructions, setThemeInstructions] = useState<ThemeInstructions | null>(null);
  const [loading, setLoading] = useState(tenantLinked);
  const [saving, setSaving] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    const response = await fetch(
      `${apiPublicOrigin}/api/commerce/cta/config?shop=${encodeURIComponent(shop)}`
    );
    const data = (await response.json()) as {
      ok: boolean;
      config?: CtaConfig;
      themeInstructions?: ThemeInstructions;
      error?: string;
    };
    if (!response.ok || !data.ok) {
      throw new Error(data.error ?? "Unable to load CTA settings");
    }
    return {
      config: data.config ?? null,
      themeInstructions: data.themeInstructions ?? null
    };
  }, [apiPublicOrigin, shop]);

  useEffect(() => {
    if (!tenantLinked) return;

    let cancelled = false;

    const run = async () => {
      setErrorBanner(null);
      try {
        const result = await fetchConfig();
        if (cancelled) return;
        setConfig(result.config);
        setThemeInstructions(result.themeInstructions);
      } catch (error) {
        if (!cancelled) {
          setErrorBanner(error instanceof Error ? error.message : "Unable to load CTA settings");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [fetchConfig, tenantLinked]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!config) return;
    setSaving(true);
    setErrorBanner(null);
    try {
      const response = await fetch(`${apiPublicOrigin}/api/commerce/cta/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop,
          ctaLabelDefault: config.ctaLabelDefault,
          ctaOpenMode: config.ctaOpenMode,
          ctaStyleMode: config.ctaStyleMode,
          showPoweredByRazzl: config.showPoweredByRazzl
        })
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setErrorBanner(data.error ?? "Save failed");
        showToast(data.error ?? "Save failed", { isError: true });
        return;
      }
      showToast("Settings saved");
      const result = await fetchConfig();
      setConfig(result.config);
      setThemeInstructions(result.themeInstructions);
    } catch {
      setErrorBanner("Save failed");
      showToast("Save failed", { isError: true });
    } finally {
      setSaving(false);
    }
  }

  if (!tenantLinked) return null;

  return (
    <Card padding="0">
      <Box padding="400" background="bg-surface-secondary">
        <InlineStack gap="200" blockAlign="center">
          <Icon source={ChatIcon} tone="base" />
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">
              Storefront CTA settings
            </Text>
            <Text as="p" tone="subdued">
              These settings control the Setup Copilot button on your product pages.
            </Text>
          </BlockStack>
        </InlineStack>
      </Box>

      <Box padding="400">
        <BlockStack gap="500">
          {errorBanner ? (
            <Banner tone="critical" onDismiss={() => setErrorBanner(null)}>
              {errorBanner}
            </Banner>
          ) : null}

          {loading ? (
            <SkeletonBodyText lines={5} />
          ) : config ? (
            <form onSubmit={(event) => void handleSave(event)}>
              <BlockStack gap="500">
                <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                  <Select
                    label="Default button label"
                    options={LABEL_OPTIONS.map((label) => ({ label, value: label }))}
                    value={config.ctaLabelDefault}
                    onChange={(value) =>
                      setConfig((prev) => (prev ? { ...prev, ctaLabelDefault: value } : prev))
                    }
                  />
                  <BlockStack gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Storefront appearance
                    </Text>
                    <div className="shopify-cta-preview-panel">
                      <BlockStack gap="200" inlineAlign="start">
                        <ShopifyCopilotPreviewVideo variant="compact" />
                        {config.showPoweredByRazzl ? (
                          <Text as="p" variant="bodySm" tone="subdued">
                            Powered by <strong>Razzl</strong>
                          </Text>
                        ) : null}
                      </BlockStack>
                    </div>
                  </BlockStack>
                </InlineGrid>

                <FormLayout>
                  <FormLayout.Group>
                    <Select
                      label="Open Copilot in"
                      options={[
                        { label: "New tab ↗", value: "new_tab" },
                        { label: "Same tab", value: "same_tab" }
                      ]}
                      value={config.ctaOpenMode}
                      onChange={(value) =>
                        setConfig((prev) =>
                          prev ? { ...prev, ctaOpenMode: value as CtaConfig["ctaOpenMode"] } : prev
                        )
                      }
                    />
                    <Select
                      label="Style mode"
                      options={[
                        { label: "Inherit theme", value: "inherit_theme" },
                        { label: "Button", value: "button" },
                        { label: "Link", value: "link" },
                        { label: "Badge", value: "badge" }
                      ]}
                      value={config.ctaStyleMode}
                      onChange={(value) =>
                        setConfig((prev) =>
                          prev ? { ...prev, ctaStyleMode: value as CtaConfig["ctaStyleMode"] } : prev
                        )
                      }
                    />
                  </FormLayout.Group>
                </FormLayout>

                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <ShopifySwitch
                      checked={config.showPoweredByRazzl}
                      label='Show "Powered by Razzl"'
                      onChange={(checked) =>
                        setConfig((prev) => (prev ? { ...prev, showPoweredByRazzl: checked } : prev))
                      }
                    />
                    <Text as="span" variant="bodyMd">
                      Show &quot;Powered by Razzl&quot;
                    </Text>
                  </InlineStack>
                  <Button submit variant="primary" loading={saving}>
                    Save CTA settings
                  </Button>
                </InlineStack>
              </BlockStack>
            </form>
          ) : null}

          {themeInstructions ? (
            <Box padding="400" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  {themeInstructions.title}
                </Text>
                <BlockStack gap="100">
                  {themeInstructions.steps.map((step) => (
                    <Text as="p" key={step} variant="bodyMd">
                      • {step}
                    </Text>
                  ))}
                </BlockStack>
                {themeInstructions.deepLinkUrl ? (
                  <div className="shopify-theme-editor-link">
                    <Button variant="plain" url={themeInstructions.deepLinkUrl} external icon={ExternalIcon}>
                      Open theme editor
                    </Button>
                  </div>
                ) : null}
              </BlockStack>
            </Box>
          ) : null}
        </BlockStack>
      </Box>
    </Card>
  );
}
