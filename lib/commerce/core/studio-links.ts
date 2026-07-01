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
