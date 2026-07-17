import { getConnectionStatusByStoreDomain } from "@/lib/commerce/core/connections/platform-connection-repo";
import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import { ShopifyEmbeddedShell } from "@/app/shopify/shopify-embedded-shell";

type PageProps = {
  searchParams: Promise<{ shop?: string; host?: string; linked?: string }>;
};

function getApiPublicOrigin(): string {
  return (
    process.env.RAZZL_PUBLIC_ORIGIN?.trim()?.replace(/\/$/, "") ?? "http://localhost:8080"
  );
}

export default async function ShopifyEmbeddedHomePage({ searchParams }: PageProps) {
  const { shop: shopParam, host, linked } = await searchParams;
  const shopDomain = shopParam ? normalizeShopDomain(shopParam) : null;
  const status = shopDomain ? await getConnectionStatusByStoreDomain(shopDomain) : null;

  return (
    <ShopifyEmbeddedShell
      initialShop={shopDomain}
      initialHost={host ?? null}
      linkedSuccess={linked === "1"}
      initialStatus={status}
      apiPublicOrigin={getApiPublicOrigin()}
    />
  );
}
