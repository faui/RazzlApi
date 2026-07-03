"use client";

import { useCallback, useEffect, useState } from "react";

type LaunchTotals = {
  totalClicks: number;
  clicksLast7Days: number;
  clicksLast30Days: number;
};

type ProductLaunchRow = {
  externalProductId: string;
  title: string | null;
  clickCount: number;
  lastClickAt: string | null;
};

type Props = {
  shop: string;
  apiPublicOrigin: string;
  tenantLinked: boolean;
};

export function ShopifyLaunchAnalyticsPanel({ shop, apiPublicOrigin, tenantLinked }: Props) {
  const [totals, setTotals] = useState<LaunchTotals | null>(null);
  const [products, setProducts] = useState<ProductLaunchRow[]>([]);
  const [loading, setLoading] = useState(tenantLinked);
  const [message, setMessage] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    const response = await fetch(
      `${apiPublicOrigin}/api/commerce/analytics/launches?shop=${encodeURIComponent(shop)}`
    );
    const data = (await response.json()) as {
      ok: boolean;
      totals?: LaunchTotals;
      products?: ProductLaunchRow[];
      error?: string;
    };
    if (!response.ok || !data.ok) {
      throw new Error(data.error ?? "Unable to load launch analytics");
    }
    return {
      totals: data.totals ?? { totalClicks: 0, clicksLast7Days: 0, clicksLast30Days: 0 },
      products: data.products ?? []
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
        const result = await fetchAnalytics();
        if (cancelled) {
          return;
        }
        setTotals(result.totals);
        setProducts(result.products);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to load launch analytics");
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
  }, [fetchAnalytics, tenantLinked]);

  if (!tenantLinked) {
    return null;
  }

  const hasData = (totals?.totalClicks ?? 0) > 0;

  return (
    <section style={{ marginTop: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Setup help analytics</h2>
          <p style={{ margin: "0.35rem 0 0", color: "#555" }}>
            CTA clicks from your storefront product pages.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setMessage(null);
            void fetchAnalytics()
              .then((result) => {
                setTotals(result.totals);
                setProducts(result.products);
              })
              .catch((error) => {
                setMessage(error instanceof Error ? error.message : "Refresh failed");
              })
              .finally(() => {
                setLoading(false);
              });
          }}
          disabled={loading}
          style={{
            padding: "0.5rem 1rem",
            background: "#fff",
            color: "#008060",
            border: "1px solid #008060",
            borderRadius: "6px",
            cursor: loading ? "wait" : "pointer"
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {message ? <p style={{ marginTop: "1rem", color: "#444" }}>{message}</p> : null}

      {loading && !totals ? <p style={{ marginTop: "1rem" }}>Loading analytics…</p> : null}

      {totals ? (
        <div
          style={{
            marginTop: "1rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "0.75rem"
          }}
        >
          <StatCard label="Last 7 days" value={totals.clicksLast7Days} />
          <StatCard label="Last 30 days" value={totals.clicksLast30Days} />
          <StatCard label="All time" value={totals.totalClicks} />
        </div>
      ) : null}

      {!loading && totals && !hasData ? (
        <p style={{ marginTop: "1rem", color: "#555" }}>
          No launch data yet. Enable the product-page CTA to start tracking setup help usage.
        </p>
      ) : null}

      {products.length > 0 ? (
        <div style={{ marginTop: "1.25rem", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th style={{ padding: "0.5rem 0.25rem" }}>Product</th>
                <th style={{ padding: "0.5rem 0.25rem" }}>Clicks</th>
                <th style={{ padding: "0.5rem 0.25rem" }}>Last click</th>
              </tr>
            </thead>
            <tbody>
              {products.map((row) => (
                <tr key={row.externalProductId} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "0.65rem 0.25rem" }}>
                    {row.title ?? `Product ${row.externalProductId}`}
                  </td>
                  <td style={{ padding: "0.65rem 0.25rem" }}>{row.clickCount}</td>
                  <td style={{ padding: "0.65rem 0.25rem" }}>
                    {row.lastClickAt ? new Date(String(row.lastClickAt)).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: "0.75rem 1rem", background: "#f6f6f7", borderRadius: "8px" }}>
      <div style={{ fontSize: "0.85rem", color: "#555" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 600, marginTop: "0.15rem" }}>{value}</div>
    </div>
  );
}
