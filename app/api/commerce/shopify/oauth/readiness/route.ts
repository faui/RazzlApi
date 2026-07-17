import { NextResponse } from "next/server";

import { getShopifyOAuthInfrastructureStatus } from "@/lib/commerce/adapters/shopify/oauth-infrastructure";

/** Diagnostics for Shopify OAuth prerequisites (encryption key, DB, env). */
export async function GET() {
  const status = await getShopifyOAuthInfrastructureStatus();
  return NextResponse.json(
    {
      ok: status.ok,
      checks: status.checks,
      errors: status.errors
    },
    { status: status.ok ? 200 : 503 }
  );
}
