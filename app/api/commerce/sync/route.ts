import { NextResponse } from "next/server";

import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import { CommerceSyncError } from "@/lib/commerce/core/connections/adapter-context";
import { getProductSyncStatus, runProductSync } from "@/lib/commerce/core/sync/sync-service";

function parseShop(request: Request): string | null {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  if (!shopParam) {
    return null;
  }
  return normalizeShopDomain(shopParam);
}

export async function GET(request: Request) {
  const shop = parseShop(request);
  if (!shop) {
    return NextResponse.json({ ok: false, error: "Missing or invalid shop parameter" }, { status: 400 });
  }

  try {
    const status = await getProductSyncStatus(shop);
    return NextResponse.json({
      ok: true,
      shop,
      productCount: status.productCount,
      latestRun: status.latestRun
        ? {
            syncRunId: status.latestRun.commerce_platform_sync_run_pk,
            syncType: status.latestRun.sync_type,
            status: status.latestRun.status,
            startedAt: status.latestRun.started_at,
            completedAt: status.latestRun.completed_at,
            productsSeen: status.latestRun.products_seen,
            productsCreated: status.latestRun.products_created,
            productsUpdated: status.latestRun.products_updated,
            productsDeletedOrArchived: status.latestRun.products_deleted_or_archived,
            variantsSeen: status.latestRun.variants_seen,
            errorCode: status.latestRun.error_code,
            errorMessage: status.latestRun.error_message
          }
        : null
    });
  } catch (error) {
    if (error instanceof CommerceSyncError) {
      const httpStatus = error.code === "NOT_INSTALLED" ? 404 : 400;
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Failed to load sync status" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const shop = parseShop(request);
  if (!shop) {
    return NextResponse.json({ ok: false, error: "Missing or invalid shop parameter" }, { status: 400 });
  }

  try {
    const result = await runProductSync(shop, "manual");
    const httpStatus = result.status === "failed" ? 502 : 200;
    return NextResponse.json(
      {
        ok: result.status !== "failed",
        shop,
        syncRunId: result.syncRunId,
        status: result.status,
        stats: result.stats,
        error: result.errorMessage
      },
      { status: httpStatus }
    );
  } catch (error) {
    if (error instanceof CommerceSyncError) {
      const httpStatus =
        error.code === "NOT_INSTALLED" ? 404 : error.code === "TENANT_NOT_LINKED" ? 409 : 400;
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: httpStatus });
    }
    return NextResponse.json({ ok: false, error: "Product sync failed" }, { status: 500 });
  }
}
