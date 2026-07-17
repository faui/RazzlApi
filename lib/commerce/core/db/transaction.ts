import type { PoolConnection } from "mysql2/promise";

import { traceLog } from "@/lib/logger";
import { getCommerceDbPool } from "./pool";

export async function commerceQueryOnConnection<T = unknown>(
  connection: PoolConnection,
  sql: string,
  params?: unknown[]
): Promise<T> {
  traceLog(4, "commerce:db:query", { sql, transactional: true });
  const [rows] = await connection.query(sql, params);
  return rows as T;
}

/** Run a callback inside a commerce DB transaction. */
export async function commerceTransaction<T>(
  fn: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const pool = getCommerceDbPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
