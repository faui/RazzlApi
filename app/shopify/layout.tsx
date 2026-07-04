import Script from "next/script";

import { ShopifyPolarisProvider } from "@/app/shopify/shopify-polaris-provider";

import "@shopify/polaris/build/esm/styles.css";

export default function ShopifyLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.SHOPIFY_API_KEY?.trim() ?? "";

  return (
    <>
      {apiKey ? (
        <Script
          id="shopify-api-key-meta"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `document.head.insertAdjacentHTML('beforeend','<meta name="shopify-api-key" content="${apiKey.replace(/"/g, "&quot;")}" />');`
          }}
        />
      ) : null}
      <Script
        src="https://cdn.shopify.com/shopifycloud/app-bridge.js"
        strategy="beforeInteractive"
      />
      <ShopifyPolarisProvider>{children}</ShopifyPolarisProvider>
    </>
  );
}
