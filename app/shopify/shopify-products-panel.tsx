"use client";

import { useCallback, useEffect, useState } from "react";

type SyncStatusResponse = {
  ok: boolean;
  productCount?: number;
  latestRun?: {
    status: string;
    completedAt?: string | null;
    errorMessage?: string | null;
  } | null;
  error?: string;
};

type ProductRow = {
  externalProductId: string;
  title: string;
  imageUrl: string | null;
  mappingStatus: string;
  productPk: number | null;
  mappedModelName: string | null;
  copilotStatus: string | null;
  launchUrl: string | null;
  editUrl: string | null;
  storefrontCtaEnabled: boolean;
};

type StudioProduct = {
  productPk: number;
  modelName: string;
  razzlCode: string;
  statusCode: string | null;
};

type ProductsResponse = {
  ok: boolean;
  items?: ProductRow[];
  studioProducts?: StudioProduct[];
  studioDashboardUrl?: string;
  studioCreateCopilotUrl?: string;
  error?: string;
};

type Props = {
  shop: string;
  apiPublicOrigin: string;
  tenantLinked: boolean;
  onProductCountChange?: (count: number) => void;
};

function badgeStyle(tone: "neutral" | "success" | "warning" | "info" | "critical") {
  const colors = {
    neutral: { bg: "#f1f2f3", color: "#444" },
    success: { bg: "#d1f0df", color: "#0d5728" },
    warning: { bg: "#fff3cd", color: "#856404" },
    info: { bg: "#dbeafe", color: "#1e40af" },
    critical: { bg: "#fde2e1", color: "#8a1f11" }
  };
  return colors[tone];
}

function copilotBadge(status: string | null, mappingStatus: string) {
  if (mappingStatus === "unmapped" || !status) {
    return { label: "Unmapped", tone: "neutral" as const };
  }
  switch (status) {
    case "active":
      return { label: "Published", tone: "success" as const };
    case "in-progress":
      return { label: "Processing", tone: "info" as const };
    case "processing-error":
      return { label: "Error", tone: "critical" as const };
    default:
      return { label: "Draft", tone: "warning" as const };
  }
}

function rowCreateCopilotUrl(baseUrl: string, externalProductId: string) {
  const url = new URL(baseUrl);
  url.searchParams.set("shopify_product", externalProductId);
  return url.toString();
}

export function ShopifyProductsPanel({
  shop,
  apiPublicOrigin,
  tenantLinked,
  onProductCountChange
}: Props) {
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [studioProducts, setStudioProducts] = useState<StudioProduct[]>([]);
  const [studioCreateCopilotUrl, setStudioCreateCopilotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mappingFor, setMappingFor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setMessage(null);
    try {
      const [syncRes, productsRes] = await Promise.all([
        fetch(`${apiPublicOrigin}/api/commerce/sync?shop=${encodeURIComponent(shop)}`),
        tenantLinked
          ? fetch(`${apiPublicOrigin}/api/commerce/products?shop=${encodeURIComponent(shop)}`)
          : Promise.resolve(null)
      ]);

      const syncData = (await syncRes.json()) as SyncStatusResponse;
      setSyncStatus(syncData);
      onProductCountChange?.(syncData.productCount ?? 0);

      if (productsRes) {
        const productsData = (await productsRes.json()) as ProductsResponse;
        if (productsData.ok) {
          setProducts(productsData.items ?? []);
          setStudioProducts(productsData.studioProducts ?? []);
          setStudioCreateCopilotUrl(productsData.studioCreateCopilotUrl ?? null);
        } else {
          setMessage(productsData.error ?? "Unable to load products");
        }
      }
    } catch {
      setMessage("Unable to load product data");
    } finally {
      setLoading(false);
    }
  }, [apiPublicOrigin, onProductCountChange, shop, tenantLinked]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setMessage(null);
      try {
        const [syncRes, productsRes] = await Promise.all([
          fetch(`${apiPublicOrigin}/api/commerce/sync?shop=${encodeURIComponent(shop)}`),
          tenantLinked
            ? fetch(`${apiPublicOrigin}/api/commerce/products?shop=${encodeURIComponent(shop)}`)
            : Promise.resolve(null)
        ]);

        if (cancelled) {
          return;
        }

        const syncData = (await syncRes.json()) as SyncStatusResponse;
        setSyncStatus(syncData);
        onProductCountChange?.(syncData.productCount ?? 0);

        if (productsRes) {
          const productsData = (await productsRes.json()) as ProductsResponse;
          if (productsData.ok) {
            setProducts(productsData.items ?? []);
            setStudioProducts(productsData.studioProducts ?? []);
            setStudioCreateCopilotUrl(productsData.studioCreateCopilotUrl ?? null);
          } else if (!cancelled) {
            setMessage(productsData.error ?? "Unable to load products");
          }
        }
      } catch {
        if (!cancelled) {
          setMessage("Unable to load product data");
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
  }, [apiPublicOrigin, onProductCountChange, shop, tenantLinked]);

  async function handleRefreshSnapshots(externalProductId?: string) {
    setRefreshing(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiPublicOrigin}/api/commerce/mappings/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          externalProductId ? { shop, externalProductId } : { shop }
        )
      });
      const data = (await response.json()) as { ok: boolean; refreshed?: number; error?: string };
      if (!response.ok || !data.ok) {
        setMessage(data.error ?? "Refresh failed");
        return;
      }
      setMessage(`Refreshed ${data.refreshed ?? 0} Copilot snapshot(s)`);
      await loadData();
    } catch {
      setMessage("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setMessage(null);
    try {
      const response = await fetch(`${apiPublicOrigin}/api/commerce/sync?shop=${encodeURIComponent(shop)}`, {
        method: "POST"
      });
      const data = (await response.json()) as SyncStatusResponse & { error?: string; stats?: { productsSeen?: number } };
      if (!response.ok || !data.ok) {
        setMessage(data.error ?? "Sync failed");
      } else {
        setMessage(`Sync complete — ${data.stats?.productsSeen ?? 0} products processed`);
      }
      await loadData();
    } catch {
      setMessage("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  async function handleMap(externalProductId: string, productPk: number) {
    setMessage(null);
    const response = await fetch(`${apiPublicOrigin}/api/commerce/mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop, externalProductId, productPk })
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setMessage(data.error ?? "Mapping failed");
      return;
    }
    setMappingFor(null);
    await loadData();
  }

  async function handleUnmap(externalProductId: string) {
    const response = await fetch(
      `${apiPublicOrigin}/api/commerce/mappings?shop=${encodeURIComponent(shop)}&externalProductId=${encodeURIComponent(externalProductId)}`,
      { method: "DELETE" }
    );
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setMessage(data.error ?? "Unmap failed");
      return;
    }
    await loadData();
  }

  async function handleToggleCta(externalProductId: string, enabled: boolean) {
    const response = await fetch(`${apiPublicOrigin}/api/commerce/mappings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop, externalProductId, enabled })
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    if (!response.ok || !data.ok) {
      setMessage(data.error ?? "CTA update failed");
      return;
    }
    await loadData();
  }

  if (!tenantLinked) {
    return (
      <section style={{ marginTop: "1.5rem" }}>
        <p>Link your Razzl Studio account before syncing Shopify products.</p>
      </section>
    );
  }

  return (
    <section style={{ marginTop: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Store products</h2>
          <p style={{ margin: "0.25rem 0 0", color: "#555" }}>
            Map Shopify products to Razzl Copilots or create a new Copilot from a PDF.
          </p>
          <p style={{ margin: "0.25rem 0 0", color: "#555", fontSize: "0.9rem" }}>
            {syncStatus?.productCount ?? 0} imported
            {syncStatus?.latestRun?.completedAt
              ? ` · Last sync ${new Date(String(syncStatus.latestRun.completedAt)).toLocaleString()}`
              : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => void handleRefreshSnapshots()}
            disabled={refreshing || loading}
            style={{
              padding: "0.5rem 1rem",
              background: "#fff",
              color: "#008060",
              border: "1px solid #008060",
              borderRadius: "6px",
              cursor: refreshing ? "wait" : "pointer"
            }}
          >
            {refreshing ? "Refreshing…" : "Refresh Copilot status"}
          </button>
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncing}
            style={{
              padding: "0.5rem 1rem",
              background: "#008060",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: syncing ? "wait" : "pointer"
            }}
          >
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>
      </div>

      {message ? <p style={{ color: "#444", marginTop: "1rem" }}>{message}</p> : null}
      {syncStatus?.latestRun?.errorMessage ? (
        <p style={{ color: "#8a1f11" }}>{syncStatus.latestRun.errorMessage}</p>
      ) : null}

      {loading ? (
        <p style={{ marginTop: "1rem" }}>Loading products…</p>
      ) : products.length === 0 ? (
        <p style={{ marginTop: "1rem", color: "#555" }}>
          No Shopify products imported yet. Click <strong>Sync now</strong> to import your catalog.
        </p>
      ) : (
        <table style={{ width: "100%", marginTop: "1rem", borderCollapse: "collapse", fontSize: "0.92rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th style={{ padding: "0.5rem" }}>Store product</th>
              <th style={{ padding: "0.5rem" }}>Copilot</th>
              <th style={{ padding: "0.5rem" }}>Copilot status</th>
              <th style={{ padding: "0.5rem" }}>Storefront CTA</th>
              <th style={{ padding: "0.5rem" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const badge = copilotBadge(product.copilotStatus, product.mappingStatus);
              const badgeColors = badgeStyle(badge.tone);
              return (
                <tr key={product.externalProductId} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt="" width={40} height={40} style={{ borderRadius: 4, objectFit: "cover" }} />
                      ) : null}
                      <span>{product.title}</span>
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>{product.mappedModelName ?? "—"}</td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    <span
                      style={{
                        background: badgeColors.bg,
                        color: badgeColors.color,
                        padding: "0.15rem 0.5rem",
                        borderRadius: 999,
                        fontSize: "0.8rem"
                      }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    {product.productPk ? (
                      <button
                        type="button"
                        onClick={() =>
                          void handleToggleCta(product.externalProductId, !product.storefrontCtaEnabled)
                        }
                        style={{ fontSize: "0.85rem" }}
                      >
                        {product.storefrontCtaEnabled ? "On" : "Off"}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      {product.launchUrl && product.copilotStatus === "active" ? (
                        <a href={product.launchUrl} target="_blank" rel="noreferrer">
                          Launch
                        </a>
                      ) : null}
                      {product.editUrl ? (
                        <a href={product.editUrl} target="_blank" rel="noreferrer">
                          Edit Copilot in Studio
                        </a>
                      ) : null}
                      {!product.productPk && studioCreateCopilotUrl ? (
                        <a
                          href={rowCreateCopilotUrl(studioCreateCopilotUrl, product.externalProductId)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Create Copilot
                        </a>
                      ) : null}
                      <button type="button" onClick={() => setMappingFor(product.externalProductId)}>
                        {product.productPk ? "Change Copilot mapping" : "Map Copilot"}
                      </button>
                      {product.productPk ? (
                        <button
                          type="button"
                          onClick={() => void handleRefreshSnapshots(product.externalProductId)}
                          disabled={refreshing}
                        >
                          Refresh status
                        </button>
                      ) : null}
                      {product.productPk ? (
                        <button type="button" onClick={() => void handleUnmap(product.externalProductId)}>
                          Unmap Copilot
                        </button>
                      ) : null}
                    </div>
                    {mappingFor === product.externalProductId ? (
                      <div style={{ marginTop: "0.5rem" }}>
                        <select
                          defaultValue=""
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (value) {
                              void handleMap(product.externalProductId, value);
                            }
                          }}
                          style={{ maxWidth: "220px" }}
                        >
                          <option value="">Select Copilot…</option>
                          {studioProducts.map((studioProduct) => (
                            <option key={studioProduct.productPk} value={studioProduct.productPk}>
                              {studioProduct.modelName} ({studioProduct.razzlCode})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {studioCreateCopilotUrl ? (
        <p style={{ marginTop: "1rem" }}>
          <a href={studioCreateCopilotUrl} target="_blank" rel="noreferrer">
            Create Copilot
          </a>
          <span style={{ color: "#666", marginLeft: "0.35rem" }}>
            — opens Razzl Studio Upload PDF (same as + Product Copilot)
          </span>
        </p>
      ) : null}
    </section>
  );
}
