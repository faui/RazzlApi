import mysql from "mysql2/promise";
import { traceLog } from "@/lib/logger";

/**
 * MySQL access uses a single pool per Node process. Idle pooled connections show as
 * COMMAND "Sleep" in PROCESSLIST — that is expected, not a leak.
 */
type GlobalPoolState = { pool: mysql.Pool | null; poolClosing: Promise<void> | null };

function getPoolState(): GlobalPoolState {
  const g = globalThis as unknown as { __razzlMysqlPool?: GlobalPoolState };
  if (!g.__razzlMysqlPool) {
    g.__razzlMysqlPool = { pool: null, poolClosing: null };
  }
  return g.__razzlMysqlPool;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export function getCommerceDbPool(): mysql.Pool {
  const state = getPoolState();
  if (!state.pool) {
    const useSsl = process.env.RAZZL_AUTH_DB_SSL !== "false";
    const host = process.env.RAZZL_AUTH_DB_HOST ?? "localhost";
    const user = process.env.RAZZL_AUTH_DB_USER ?? "app_dev";
    const database = process.env.RAZZL_AUTH_DB_NAME ?? "razzldbdev";

    traceLog(3, "commerce:db:pool:init", {
      host,
      user,
      database,
      sslEnabled: useSsl
    });

    state.pool = mysql.createPool({
      host,
      user,
      password: process.env.RAZZL_AUTH_DB_PASSWORD ?? "",
      database,
      ssl: useSsl ? "Amazon RDS" : undefined,
      connectTimeout: readPositiveInt("RAZZL_AUTH_DB_CONNECT_TIMEOUT_MS", 10_000),
      connectionLimit: readPositiveInt("RAZZL_AUTH_DB_POOL_CONNECTION_LIMIT", 10),
      waitForConnections: true,
      queueLimit: readPositiveInt("RAZZL_AUTH_DB_POOL_QUEUE_LIMIT", 100),
      maxIdle: readPositiveInt("RAZZL_AUTH_DB_POOL_MAX_IDLE", 10),
      idleTimeout: readPositiveInt("RAZZL_AUTH_DB_POOL_IDLE_TIMEOUT_MS", 60_000),
      enableKeepAlive: true,
      keepAliveInitialDelay: readPositiveInt("RAZZL_AUTH_DB_POOL_KEEPALIVE_DELAY_MS", 10_000)
    });
  }
  return state.pool;
}

export async function closeCommerceDbPool(): Promise<void> {
  const state = getPoolState();
  if (state.poolClosing) {
    return state.poolClosing;
  }
  if (!state.pool) {
    return;
  }
  const toClose = state.pool;
  state.pool = null;
  state.poolClosing = toClose
    .end()
    .then(() => {
      traceLog(4, "commerce:db:pool:closed", {});
    })
    .catch((error) => {
      traceLog(1, "commerce:db:pool:close:error", { error: String(error) });
    })
    .finally(() => {
      state.poolClosing = null;
    });
  return state.poolClosing;
}

export function registerCommerceDbPoolShutdownHooks(): void {
  if (typeof process === "undefined") {
    return;
  }
  const onSignal = () => {
    void closeCommerceDbPool().catch(() => {
      /* logged in closeCommerceDbPool */
    });
  };
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);
}

export function isTransientDbError(error: unknown): boolean {
  const e = error as { code?: string } | null;
  const code = e?.code;
  return (
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "PROTOCOL_CONNECTION_LOST" ||
    code === "ER_CON_COUNT_ERROR"
  );
}
