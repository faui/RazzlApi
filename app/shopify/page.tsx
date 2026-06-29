import { getConnectionStatusByStoreDomain } from "@/lib/commerce/core/connections/platform-connection-repo";
import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";

type PageProps = {
  searchParams: Promise<{ shop?: string }>;
};

export default async function ShopifyEmbeddedHome({ searchParams }: PageProps) {
  const { shop: shopParam } = await searchParams;
  const shopDomain = shopParam ? normalizeShopDomain(shopParam) : null;
  const status = shopDomain ? await getConnectionStatusByStoreDomain(shopDomain) : null;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "720px" }}>
      <h1 style={{ marginTop: 0 }}>Razzl Product Setup Copilot</h1>
      <p>Add AI setup help to your product pages.</p>

      {shopDomain ? (
        <section style={{ marginTop: "1.5rem", padding: "1rem", background: "#f6f6f7", borderRadius: "8px" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Connection</h2>
          <p>
            <strong>Shop:</strong> {shopDomain}
          </p>
          {status ? (
            <>
              <p>
                <strong>Status:</strong> {status.installStatus}
              </p>
              {status.storeDisplayName ? (
                <p>
                  <strong>Store:</strong> {status.storeDisplayName}
                </p>
              ) : null}
              <p>
                <strong>Razzl account linked:</strong> {status.tenantLinked ? "Yes" : "No — coming in next step"}
              </p>
            </>
          ) : (
            <p>Not installed yet. Complete OAuth install to connect this shop.</p>
          )}
        </section>
      ) : (
        <p>Open this app from your Shopify admin to view connection status.</p>
      )}

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Next steps</h2>
        <ol>
          <li>Link your Razzl Studio account (Slice 4)</li>
          <li>Sync products from Shopify</li>
          <li>Map products to copilots and enable storefront CTA</li>
        </ol>
      </section>
    </main>
  );
}
