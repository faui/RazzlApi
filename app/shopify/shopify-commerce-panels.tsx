"use client";

import { ShopifyOnboardingPanel } from "@/app/shopify/shopify-onboarding-panel";
import { ShopifyProductsPanel } from "@/app/shopify/shopify-products-panel";
import { useState } from "react";

type Props = {
  shop: string;
  tenantLinked: boolean;
  tenantName: string | null;
  apiPublicOrigin: string;
};

export function ShopifyCommercePanels({
  shop,
  tenantLinked,
  tenantName,
  apiPublicOrigin
}: Props) {
  const [productCount, setProductCount] = useState(0);

  return (
    <>
      <ShopifyOnboardingPanel
        shop={shop}
        tenantLinked={tenantLinked}
        tenantName={tenantName}
        apiPublicOrigin={apiPublicOrigin}
        productCount={productCount}
      />
      <ShopifyProductsPanel
        shop={shop}
        apiPublicOrigin={apiPublicOrigin}
        tenantLinked={tenantLinked}
        onProductCountChange={setProductCount}
      />
    </>
  );
}
