import { timingSafeEqual } from "crypto";

/** Studio public origin for deep links (login, signup, dashboard). */

export function getStudioPublicOrigin(): string {
  const configured =
    process.env.RAZZL_STUDIO_PUBLIC_ORIGIN?.trim() ??
    process.env.STUDIO_PUBLIC_ORIGIN?.trim() ??
    process.env.APP_BASE_URL?.trim();

  if (!configured) {
    throw new Error("RAZZL_STUDIO_PUBLIC_ORIGIN is not configured");
  }

  return configured.replace(/\/$/, "");
}

export function getCommerceInternalLinkSecret(): string {
  const secret = process.env.COMMERCE_STUDIO_LINK_SECRET?.trim();
  if (!secret) {
    throw new Error("COMMERCE_STUDIO_LINK_SECRET is not configured");
  }
  return secret;
}

export function verifyCommerceInternalLinkSecret(headerValue: string | null): boolean {
  if (!headerValue) {
    return false;
  }
  const expected = getCommerceInternalLinkSecret();
  try {
    return timingSafeEqual(Buffer.from(headerValue), Buffer.from(expected));
  } catch {
    return false;
  }
}
