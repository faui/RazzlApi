export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiKey = process.env.SHOPIFY_API_KEY?.trim() ?? "";

  return (
    <html lang="en">
      <head>
        {apiKey ? (
          <>
            <meta name="shopify-api-key" content={apiKey} />
            {/* App Bridge CDN must be the first script tag — no async/defer (Shopify requirement). */}
            {/* eslint-disable-next-line @next/next/no-sync-scripts */}
            <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
          </>
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
