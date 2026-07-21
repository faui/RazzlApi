"use client";

import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Icon,
  InlineGrid,
  InlineStack,
  Select,
  SkeletonBodyText,
  Text
} from "@shopify/polaris";
import { ChatIcon, ExternalIcon } from "@shopify/polaris-icons";
import { useCallback, useEffect, useState } from "react";

import { ShopifyCtaStorefrontPreview } from "@/app/shopify/shopify-cta-storefront-preview";
import { useCommerceToast } from "@/app/shopify/shopify-polaris-provider";
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
        <div className="shopify-cta-settings-header">
          <InlineStack gap="200" blockAlign="center" wrap={false}>
            <Icon source={ChatIcon} tone="base" />
            <Text as="h2" variant="headingMd">
              Storefront CTA settings
            </Text>
          </InlineStack>
          <Text as="p" tone="subdued" alignment="end">
            These settings control the Setup Copilot button on your product pages.
          </Text>
        </div>
      </Box>

      <Box padding="400">
        <BlockStack gap="400">
          {errorBanner ? (
            <Banner tone="critical" onDismiss={() => setErrorBanner(null)}>
              {errorBanner}
            </Banner>
          ) : null}

          {loading ? (
            <SkeletonBodyText lines={5} />
          ) : config ? (
            <form onSubmit={(event) => void handleSave(event)}>
              <BlockStack gap="400">
                <div className="shopify-cta-settings-columns">
                  <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                    <BlockStack gap="400">
                      <Text as="h3" variant="headingSm">
                        Storefront appearance
                      </Text>
                      <div className="shopify-cta-settings-fields">
                        <Select
                          label="Default button label"
                          options={LABEL_OPTIONS.map((label) => ({ label, value: label }))}
                          value={config.ctaLabelDefault}
                          onChange={(value) =>
                            setConfig((previous) =>
                              previous ? { ...previous, ctaLabelDefault: value } : previous
                            )
                          }
                        />
                        <Select
                          label="Open Copilot in"
                          options={[
                            { label: "New tab ↗", value: "new_tab" },
                            { label: "Same tab", value: "same_tab" }
                          ]}
                          value={config.ctaOpenMode}
                          onChange={(value) =>
                            setConfig((previous) =>
                              previous
                                ? {
                                    ...previous,
                                    ctaOpenMode: value as CtaConfig["ctaOpenMode"]
                                  }
                                : previous
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
                            setConfig((previous) =>
                              previous
                                ? {
                                    ...previous,
                                    ctaStyleMode: value as CtaConfig["ctaStyleMode"]
                                  }
                                : previous
                            )
                          }
                        />
                      </div>
                      <InlineStack gap="200" blockAlign="center">
                        <ShopifySwitch
                          checked={config.showPoweredByRazzl}
                          label='Show "Powered by Razzl"'
                          onChange={(checked) =>
                            setConfig((previous) =>
                              previous ? { ...previous, showPoweredByRazzl: checked } : previous
                            )
                          }
                        />
                        <Text as="span" variant="bodyMd">
                          Show &quot;Powered by Razzl&quot;
                        </Text>
                      </InlineStack>
                      <div className="shopify-cta-preview-panel shopify-cta-preview-panel--compact">
                        <ShopifyCtaStorefrontPreview
                          label={config.ctaLabelDefault}
                          styleMode={config.ctaStyleMode}
                        />
                        {config.showPoweredByRazzl ? (
                          <Text as="p" variant="bodySm" tone="subdued">
                            Powered by <strong>Razzl</strong>
                          </Text>
                        ) : null}
                      </div>
                    </BlockStack>

                    <Box padding="400" background="bg-surface-secondary" borderRadius="300">
                      {themeInstructions ? (
                        <BlockStack gap="300">
                          <BlockStack gap="100">
                            <Text as="h3" variant="headingSm">
                              {themeInstructions.title}
                            </Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              Add the app block once in your product template. Per-product mapping
                              and CTA status remain in the products table.
                            </Text>
                          </BlockStack>
                          <ol className="shopify-theme-instructions-list">
                            {themeInstructions.steps.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                          {themeInstructions.deepLinkUrl ? (
                            <div className="shopify-theme-editor-link">
                              <Button
                                url={themeInstructions.deepLinkUrl}
                                external
                                icon={ExternalIcon}
                              >
                                Open theme editor
                              </Button>
                            </div>
                          ) : null}
                        </BlockStack>
                      ) : (
                        <Text as="p" tone="subdued">
                          Theme editor instructions are unavailable for this store.
                        </Text>
                      )}
                    </Box>
                  </InlineGrid>
                </div>

                <div className="shopify-cta-settings-footer">
                  <InlineStack align="end">
                    <Button submit variant="primary" loading={saving}>
                      Save CTA settings
                    </Button>
                  </InlineStack>
                </div>
              </BlockStack>
            </form>
          ) : null}
        </BlockStack>
      </Box>
    </Card>
  );
}
