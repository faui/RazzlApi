import type { CommercePlatformType } from "@/lib/commerce/types/enums";
import { shopifyAdapter } from "@/lib/commerce/adapters/shopify";
import type { CommercePlatformAdapter } from "@/lib/commerce/adapters/types";

export function getAdapter(platformType: CommercePlatformType): CommercePlatformAdapter {
  switch (platformType) {
    case "shopify":
      return shopifyAdapter;
    default:
      throw new Error(`Unsupported platform: ${platformType}`);
  }
}
