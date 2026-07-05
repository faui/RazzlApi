import { NextResponse } from "next/server";

import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import { requireLinkedShopConnection } from "@/lib/commerce/core/connections/adapter-context";
import {
  CommerceBillingError,
  createShopifyBillingSession
} from "@/lib/commerce/core/billing/billing-service";

type SessionBody = {
  shop?: string;
  tierCode?: string;
};

export async function POST(request: Request) {
  let body: SessionBody;
  try {
    body = (await request.json()) as SessionBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const shop = body.shop ? normalizeShopDomain(body.shop) : null;
  const tierCode = body.tierCode?.trim();
  if (!shop || !tierCode) {
    return NextResponse.json({ ok: false, error: "shop and tierCode are required" }, { status: 400 });
  }

  try {
    const { connection } = await requireLinkedShopConnection(shop);
    const tenantPk = connection.tenant_fk;
    if (!tenantPk) {
      return NextResponse.json({ ok: false, error: "Tenant is not linked" }, { status: 400 });
    }

    const session = await createShopifyBillingSession(connection, tenantPk, tierCode);
    return NextResponse.json({
      ok: true,
      confirmationUrl: session.confirmationUrl,
      chargeId: session.chargeId
    });
  } catch (error) {
    if (error instanceof CommerceBillingError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 402 });
    }
    return NextResponse.json({ ok: false, error: "Failed to create billing session" }, { status: 500 });
  }
}
