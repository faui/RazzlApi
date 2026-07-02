"use client";

type LinkStartResponse = {
  ok: boolean;
  loginUrl?: string;
  signupUrl?: string;
  studioDashboardUrl?: string;
  error?: string;
};

type Props = {
  shop: string;
  tenantLinked: boolean;
  tenantName: string | null;
  apiPublicOrigin: string;
  productCount?: number;
};

export function ShopifyOnboardingPanel({
  shop,
  tenantLinked,
  tenantName,
  apiPublicOrigin,
  productCount = 0
}: Props) {
  async function openStudioLink(mode: "login" | "signup") {
    const startUrl = `${apiPublicOrigin}/api/commerce/connection/link/start?shop=${encodeURIComponent(shop)}`;
    const response = await fetch(startUrl);
    const data = (await response.json()) as LinkStartResponse;
    if (!data.ok) {
      window.alert(data.error ?? "Unable to start account linking");
      return;
    }

    const target = mode === "login" ? data.loginUrl : data.signupUrl;
    if (target) {
      window.open(target, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2 style={{ fontSize: "1.1rem" }}>Onboarding</h2>
      {tenantLinked ? (
        <>
          <p>
            Linked to Razzl account: <strong>{tenantName ?? "Connected"}</strong>
          </p>
          <p style={{ color: "#555" }}>
            Sync Shopify products and map them to Razzl copilots below.
          </p>
        </>
      ) : (
        <>
          <p>Connect this Shopify store to your Razzl Studio account.</p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <button
              type="button"
              onClick={() => void openStudioLink("login")}
              style={{
                padding: "0.5rem 1rem",
                background: "#008060",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Connect existing Razzl account
            </button>
            <button
              type="button"
              onClick={() => void openStudioLink("signup")}
              style={{
                padding: "0.5rem 1rem",
                background: "#fff",
                color: "#008060",
                border: "1px solid #008060",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Create Razzl account
            </button>
          </div>
        </>
      )}

      <ol style={{ marginTop: "1.5rem", color: "#444" }}>
        <li style={{ fontWeight: tenantLinked ? 400 : 600 }}>
          {tenantLinked ? "✓" : "○"} Link your Razzl Studio account
        </li>
        <li style={{ fontWeight: tenantLinked && productCount > 0 ? 400 : tenantLinked ? 600 : 400 }}>
          {tenantLinked && productCount > 0 ? "✓" : "○"} Sync products from Shopify
        </li>
        <li>Map products to copilots and enable storefront CTA</li>
      </ol>
    </section>
  );
}
