import { NextResponse } from "next/server";

import { normalizeShopDomain } from "@/lib/commerce/config/shopify-env";
import {
  CommerceSyncError,
  ShopifyTokenError
} from "@/lib/commerce/core/connections/adapter-context";
import { CommerceBillingError } from "@/lib/commerce/core/billing/billing-service";
import { getProductSyncStatus, runProductSync } from "@/lib/commerce/core/sync/sync-service";
import { traceLog } from "@/lib/logger";

function parseShop(request: Request): string | null {
  const url = new URL(request.url);
  const shopParam = url.searchParams.get("shop");
  if (!shopParam) {
    return null;
  }
  return normalizeShopDomain(shopParam);
}

function mapSyncRouteError(error: unknown, fallbackMessage: string): NextResponse {
  if (error instanceof CommerceSyncError) {
    const httpStatus =
      error.code === "NOT_INSTALLED" ? 404 : error.code === "TENANT_NOT_LINKED" ? 409 : 400;
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: httpStatus });
  }

  if (error instanceof CommerceBillingError) {
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status: 402 }
    );
  }

  if (error instanceof ShopifyTokenError) {
    const httpStatus = error.code === "TOKEN_REFRESH_TRANSIENT" ? 503 : 401;
    return NextResponse.json(
      {
        ok: false,
        error: error.message,
        code: error.code,
        retryable: error.retryable
      },
      { status: httpStatus }
    );
  }

  traceLog(1, "commerce:sync:unexpected_error", {
    error: error instanceof Error ? error.message : String(error)
  });
  return NextResponse.json({ ok: false, error: fallbackMessage }, { status: 500 });
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
    return mapSyncRouteError(error, "Failed to load sync status");
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
    return mapSyncRouteError(error, "Product sync failed");
  }
}
