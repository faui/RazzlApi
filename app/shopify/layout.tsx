import { ShopifyPolarisProvider } from "@/app/shopify/shopify-polaris-provider";

import "@shopify/polaris/build/esm/styles.css";
import "@/app/shopify/shopify-admin.css";

export default function ShopifyLayout({ children }: { children: React.ReactNode }) {
  return <ShopifyPolarisProvider>{children}</ShopifyPolarisProvider>;
}
