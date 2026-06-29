import { traceLog } from "@/lib/logger";
import { getCommerceDbPool } from "./pool";

export async function commerceQuery<T = unknown>(sql: string, params?: unknown[]): Promise<T> {
  traceLog(4, "commerce:db:query", { sql });
  const [rows] = await getCommerceDbPool().query(sql, params);
  return rows as T;
}

/** Lightweight connectivity check for health/diagnostics. */
export async function pingCommerceDb(): Promise<boolean> {
  try {
    await commerceQuery("SELECT 1 AS ok");
    return true;
  } catch (error) {
    traceLog(1, "commerce:db:ping:failed", { error: String(error) });
    return false;
  }
}
