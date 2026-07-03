import {
  getLaunchAnalyticsByProduct,
  getLaunchAnalyticsTotals,
  insertLaunchEvent,
  type LaunchAnalyticsProductRow,
  type LaunchAnalyticsTotals
} from "@/lib/commerce/core/analytics/launch-event-repo";
import { requireLinkedShopConnection } from "@/lib/commerce/core/connections/adapter-context";
import { findMappingByExternalProductId } from "@/lib/commerce/core/mapping/mapping-repo";
import {
  COMMERCE_LAUNCH_SOURCE_SHOPIFY_PRODUCT_PAGE_CTA,
  type CommerceLaunchSource
} from "@/lib/commerce/types/enums";

export class CommerceLaunchTrackingError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "CommerceLaunchTrackingError";
  }
}

export type RecordLaunchEventInput = {
  shop: string;
  externalProductId: string;
  externalVariantId?: string;
  source?: CommerceLaunchSource;
  sessionId?: string;
  anonymousVisitorId?: string;
  metadata?: Record<string, unknown>;
};

function isLaunchableStatus(status: string | null | undefined): boolean {
  return status === "active";
}

/** Record a storefront CTA click when mapping + launch preconditions still pass. */
export async function recordLaunchEvent(input: RecordLaunchEventInput): Promise<{ eventId: number }> {
  const source = input.source ?? COMMERCE_LAUNCH_SOURCE_SHOPIFY_PRODUCT_PAGE_CTA;
  const { connection } = await requireLinkedShopConnection(input.shop);

  if (!connection.tenant_fk || connection.install_status === "uninstalled") {
    throw new CommerceLaunchTrackingError("NOT_LINKED", "Shop is not linked");
  }

  const mapping = await findMappingByExternalProductId(
    connection.commerce_platform_connection_pk,
    input.externalProductId
  );

  if (
    !mapping?.product_fk ||
    mapping.mapping_status === "unmapped" ||
    mapping.mapping_status === "error" ||
    !mapping.storefront_cta_enabled ||
    !isLaunchableStatus(mapping.product_status_snapshot) ||
    !mapping.launch_url_snapshot ||
    !mapping.razzl_code_snapshot
  ) {
    throw new CommerceLaunchTrackingError("NOT_TRACKABLE", "Launch event preconditions not met");
  }

  const eventId = await insertLaunchEvent({
    tenant_fk: connection.tenant_fk,
    commerce_platform_connection_fk: connection.commerce_platform_connection_pk,
    platform_type: connection.platform_type,
    external_product_id: input.externalProductId,
    external_variant_id: input.externalVariantId?.trim() || null,
    product_fk: mapping.product_fk,
    razzl_code: mapping.razzl_code_snapshot,
    source,
    launch_url: mapping.launch_url_snapshot,
    session_id: input.sessionId?.trim() || null,
    anonymous_visitor_id: input.anonymousVisitorId?.trim() || null,
    metadata_json: input.metadata ?? null
  });

  return { eventId };
}

export type LaunchAnalyticsSummary = LaunchAnalyticsTotals & {
  products: LaunchAnalyticsProductRow[];
};

export async function getLaunchAnalyticsSummary(shop: string): Promise<LaunchAnalyticsSummary> {
  const { connection } = await requireLinkedShopConnection(shop);

  if (!connection.tenant_fk) {
    throw new CommerceLaunchTrackingError("NOT_LINKED", "Tenant is not linked");
  }

  const [totals, products] = await Promise.all([
    getLaunchAnalyticsTotals(connection.commerce_platform_connection_pk),
    getLaunchAnalyticsByProduct(connection.commerce_platform_connection_pk)
  ]);

  return {
    ...totals,
    products
  };
}
