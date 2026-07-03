import { getStudioPublicOrigin } from "@/lib/commerce/config/studio-env";

/** Build Studio auth URL with optional post-login return path. */
export function buildStudioAuthUrl(path: "/auth/start" | "/auth/login", returnPath: string): string {
  const origin = getStudioPublicOrigin();
  const url = new URL(path, origin);
  url.searchParams.set("return_to", returnPath);
  return url.toString();
}

export function buildStudioCommerceLinkReturnPath(linkToken: string): string {
  return `/commerce/link-shopify?token=${encodeURIComponent(linkToken)}`;
}

export function buildStudioDashboardUrl(): string {
  return `${getStudioPublicOrigin()}/app/dashboard`;
}

export type StudioCreateCopilotLinkOptions = {
  /** Shopify external product id — preserved for post-create mapping context. */
  externalProductId?: string;
  shop?: string;
};

/** Relative Studio path that auto-opens the Product Copilot (Upload PDF) dialog. */
export function buildStudioCreateCopilotPath(options?: StudioCreateCopilotLinkOptions): string {
  const params = new URLSearchParams({ create_copilot: "1" });
  if (options?.externalProductId) {
    params.set("shopify_product", options.externalProductId);
  }
  if (options?.shop) {
    params.set("shopify_shop", options.shop);
  }
  return `/app/dashboard?${params.toString()}`;
}

/** Absolute URL to launch the same Upload PDF flow as Studio "+ Product Copilot". */
export function buildStudioCreateCopilotUrl(options?: StudioCreateCopilotLinkOptions): string {
  return `${getStudioPublicOrigin()}${buildStudioCreateCopilotPath(options)}`;
}
