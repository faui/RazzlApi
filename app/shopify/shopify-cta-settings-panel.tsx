"use client";

import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Checkbox,
  FormLayout,
  Icon,
  InlineStack,
  Select,
  SkeletonBodyText,
  Text
} from "@shopify/polaris";
import { CursorIcon } from "@shopify/polaris-icons";
import { useCallback, useEffect, useState } from "react";

import { useCommerceToast } from "@/app/shopify/shopify-polaris-provider";

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

function CtaPreview({
  label,
  styleMode
}: {
  label: string;
  styleMode: CtaConfig["ctaStyleMode"];
}) {
  if (styleMode === "link") {
    return (
      <Text as="span" variant="bodyMd">
        <span style={{ textDecoration: "underline" }}>{label}</span>
      </Text>
    );
  }

  if (styleMode === "badge") {
    return <Badge tone="info">{label}</Badge>;
  }

  return (
    <Button variant={styleMode === "button" ? "primary" : "secondary"}>{label}</Button>
  );
}

function StyleModePreview({ mode }: { mode: CtaConfig["ctaStyleMode"] }) {
  const labels: Record<CtaConfig["ctaStyleMode"], string> = {
    inherit_theme: "Theme",
    button: "Button",
    link: "Link",
    badge: "Badge"
  };
  return (
    <Box padding="200" background="bg-surface-secondary" borderRadius="200" minWidth="72px">
      <BlockStack gap="100" inlineAlign="center">
        <CtaPreview label="Preview" styleMode={mode} />
        <Text as="span" variant="bodySm" tone="subdued">
          {labels[mode]}
        </Text>
      </BlockStack>
    </Box>
  );
}

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
    <Card>
      <BlockStack gap="400">
        <InlineStack gap="200" blockAlign="center">
          <Icon source={CursorIcon} tone="base" />
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">
              Storefront CTA settings
            </Text>
            <Text as="p" tone="subdued">
              These settings control the Setup Copilot button that appears on your product pages.
            </Text>
          </BlockStack>
        </InlineStack>

        {errorBanner ? (
          <Banner tone="critical" onDismiss={() => setErrorBanner(null)}>
            {errorBanner}
          </Banner>
        ) : null}

        {loading ? (
          <SkeletonBodyText lines={5} />
        ) : config ? (
          <form onSubmit={(event) => void handleSave(event)}>
            <FormLayout>
              <FormLayout.Group>
                <Select
                  label="Default button label"
                  options={LABEL_OPTIONS.map((label) => ({ label, value: label }))}
                  value={config.ctaLabelDefault}
                  onChange={(value) =>
                    setConfig((prev) => (prev ? { ...prev, ctaLabelDefault: value } : prev))
                  }
                />
                <Box paddingBlockStart="600">
                  <BlockStack gap="200">
                    <Text as="span" variant="bodySm" tone="subdued">
                      Live preview
                    </Text>
                    <CtaPreview label={config.ctaLabelDefault} styleMode={config.ctaStyleMode} />
                    {config.showPoweredByRazzl ? (
                      <Text as="p" variant="bodySm" tone="subdued">
                        Powered by <strong>Razzl</strong>
                      </Text>
                    ) : null}
                  </BlockStack>
                </Box>
              </FormLayout.Group>

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

              <BlockStack gap="200">
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
                <InlineStack gap="200">
                  {(["inherit_theme", "button", "link", "badge"] as const).map((mode) => (
                    <StyleModePreview key={mode} mode={mode} />
                  ))}
                </InlineStack>
                <Text as="p" variant="bodySm" tone="subdued">
                  Theme editor colors may override button appearance on your storefront.
                </Text>
              </BlockStack>

              <Checkbox
                label='Show "Powered by Razzl"'
                checked={config.showPoweredByRazzl}
                onChange={(checked) =>
                  setConfig((prev) => (prev ? { ...prev, showPoweredByRazzl: checked } : prev))
                }
              />

              <InlineStack align="end">
                <Button submit variant="primary" loading={saving}>
                  Save CTA settings
                </Button>
              </InlineStack>
            </FormLayout>
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
                <Button url={themeInstructions.deepLinkUrl} external>
                  Open theme editor
                </Button>
              ) : null}
            </BlockStack>
          </Box>
        ) : null}
      </BlockStack>
    </Card>
  );
}
