import { commerceQuery } from "@/lib/commerce/core/db/query";
import { COMMERCE_TABLES } from "@/lib/commerce/types/enums";
import type { CommerceLaunchEventInsert } from "@/lib/commerce/types/commerce-launch-event";

export async function insertLaunchEvent(event: CommerceLaunchEventInsert): Promise<number> {
  await commerceQuery(
    `INSERT INTO ${COMMERCE_TABLES.launchEvent} (
       tenant_fk,
       commerce_platform_connection_fk,
       platform_type,
       external_product_id,
       external_variant_id,
       product_fk,
       razzl_code,
       source,
       launch_url,
       session_id,
       anonymous_visitor_id,
       metadata_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.tenant_fk,
      event.commerce_platform_connection_fk,
      event.platform_type,
      event.external_product_id,
      event.external_variant_id,
      event.product_fk,
      event.razzl_code,
      event.source,
      event.launch_url,
      event.session_id,
      event.anonymous_visitor_id,
      event.metadata_json ? JSON.stringify(event.metadata_json) : null
    ]
  );

  const rows = await commerceQuery<Array<{ commerce_launch_event_pk: number }>>(
    `SELECT commerce_launch_event_pk
     FROM ${COMMERCE_TABLES.launchEvent}
     WHERE commerce_platform_connection_fk = ?
     ORDER BY created_on DESC
     LIMIT 1`,
    [event.commerce_platform_connection_fk]
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to insert launch event");
  }
  return row.commerce_launch_event_pk;
}

export type LaunchAnalyticsTotals = {
  totalClicks: number;
  clicksLast7Days: number;
  clicksLast30Days: number;
};

export type LaunchAnalyticsProductRow = {
  externalProductId: string;
  title: string | null;
  clickCount: number;
  lastClickAt: string | null;
};

export async function getLaunchAnalyticsTotals(connectionId: number): Promise<LaunchAnalyticsTotals> {
  const rows = await commerceQuery<
    Array<{
      total_clicks: number;
      clicks_last_7_days: number;
      clicks_last_30_days: number;
    }>
  >(
    `SELECT
       COUNT(*) AS total_clicks,
       SUM(CASE WHEN created_on >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS clicks_last_7_days,
       SUM(CASE WHEN created_on >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS clicks_last_30_days
     FROM ${COMMERCE_TABLES.launchEvent}
     WHERE commerce_platform_connection_fk = ?`,
    [connectionId]
  );

  const row = rows[0];
  return {
    totalClicks: Number(row?.total_clicks ?? 0),
    clicksLast7Days: Number(row?.clicks_last_7_days ?? 0),
    clicksLast30Days: Number(row?.clicks_last_30_days ?? 0)
  };
}

export async function getLaunchAnalyticsByProduct(
  connectionId: number,
  limit = 20
): Promise<LaunchAnalyticsProductRow[]> {
  const rows = await commerceQuery<
    Array<{
      external_product_id: string;
      title: string | null;
      click_count: number;
      last_click_at: string | null;
    }>
  >(
    `SELECT
       e.external_product_id,
       ep.title,
       COUNT(*) AS click_count,
       MAX(e.created_on) AS last_click_at
     FROM ${COMMERCE_TABLES.launchEvent} e
     LEFT JOIN ${COMMERCE_TABLES.externalProduct} ep
       ON ep.commerce_platform_connection_fk = e.commerce_platform_connection_fk
      AND ep.external_product_id = e.external_product_id
     WHERE e.commerce_platform_connection_fk = ?
     GROUP BY e.external_product_id, ep.title
     ORDER BY click_count DESC, last_click_at DESC
     LIMIT ?`,
    [connectionId, limit]
  );

  return rows.map((row) => ({
    externalProductId: row.external_product_id,
    title: row.title,
    clickCount: Number(row.click_count),
    lastClickAt: row.last_click_at
  }));
}
