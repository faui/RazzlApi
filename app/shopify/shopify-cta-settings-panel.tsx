"use client";

import { useCallback, useEffect, useState } from "react";

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
  const [config, setConfig] = useState<CtaConfig | null>(null);
  const [themeInstructions, setThemeInstructions] = useState<ThemeInstructions | null>(null);
  const [loading, setLoading] = useState(tenantLinked);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    if (!tenantLinked) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setMessage(null);
      try {
        const result = await fetchConfig();
        if (cancelled) {
          return;
        }
        setConfig(result.config);
        setThemeInstructions(result.themeInstructions);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load CTA settings");
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
  }, [fetchConfig, tenantLinked]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!config) return;
    setSaving(true);
    setMessage(null);
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
        setMessage(data.error ?? "Save failed");
        return;
      }
      setMessage("CTA settings saved");
      const result = await fetchConfig();
      setConfig(result.config);
      setThemeInstructions(result.themeInstructions);
    } catch {
      setMessage("Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!tenantLinked) {
    return null;
  }

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Storefront CTA settings</h2>
      <p style={{ margin: "0.35rem 0 0", color: "#555" }}>
        Configure the setup-help button shoppers see on product pages (after you add the theme block).
      </p>

      {loading ? <p style={{ marginTop: "1rem" }}>Loading CTA settings…</p> : null}
      {message ? <p style={{ marginTop: "1rem", color: "#444" }}>{message}</p> : null}

      {config ? (
        <form onSubmit={(event) => void handleSave(event)} style={{ marginTop: "1rem" }}>
          <div style={{ display: "grid", gap: "0.75rem", maxWidth: "420px" }}>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Default button label</span>
              <select
                value={config.ctaLabelDefault}
                onChange={(event) =>
                  setConfig((prev) => (prev ? { ...prev, ctaLabelDefault: event.target.value } : prev))
                }
              >
                {LABEL_OPTIONS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Open Copilot in</span>
              <select
                value={config.ctaOpenMode}
                onChange={(event) =>
                  setConfig((prev) =>
                    prev ? { ...prev, ctaOpenMode: event.target.value as CtaConfig["ctaOpenMode"] } : prev
                  )
                }
              >
                <option value="new_tab">New tab</option>
                <option value="same_tab">Same tab</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Style mode</span>
              <select
                value={config.ctaStyleMode}
                onChange={(event) =>
                  setConfig((prev) =>
                    prev ? { ...prev, ctaStyleMode: event.target.value as CtaConfig["ctaStyleMode"] } : prev
                  )
                }
              >
                <option value="inherit_theme">Inherit theme</option>
                <option value="button">Button</option>
                <option value="link">Link</option>
                <option value="badge">Badge</option>
              </select>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={config.showPoweredByRazzl}
                onChange={(event) =>
                  setConfig((prev) =>
                    prev ? { ...prev, showPoweredByRazzl: event.target.checked } : prev
                  )
                }
              />
              <span>Show &quot;Powered by Razzl&quot;</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              marginTop: "1rem",
              padding: "0.5rem 1rem",
              background: "#008060",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: saving ? "wait" : "pointer"
            }}
          >
            {saving ? "Saving…" : "Save CTA settings"}
          </button>
        </form>
      ) : null}

      {themeInstructions ? (
        <div style={{ marginTop: "1.5rem", padding: "1rem", background: "#f6f6f7", borderRadius: "8px" }}>
          <h3 style={{ marginTop: 0, fontSize: "1rem" }}>{themeInstructions.title}</h3>
          <ol style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem" }}>
            {themeInstructions.steps.map((step) => (
              <li key={step} style={{ marginBottom: "0.35rem" }}>
                {step}
              </li>
            ))}
          </ol>
          {themeInstructions.deepLinkUrl ? (
            <p style={{ marginTop: "0.75rem" }}>
              <a href={themeInstructions.deepLinkUrl} target="_blank" rel="noreferrer">
                Open theme editor
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
