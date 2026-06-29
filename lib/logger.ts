function clampTraceLevel(n: number) {
  return Math.min(5, Math.max(0, Math.floor(n)));
}

function configuredTraceLevel(): number {
  const raw = process.env.RAZZL_LOG_LEVEL ?? "";
  if (String(raw).trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return clampTraceLevel(n);
    }
  }
  return 2;
}

function logServiceName(): string {
  const fromEnv = process.env.RAZZL_SERVICE?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : "api";
}

/** Structured trace log; level 0 = always, 5 = verbose. */
export function traceLog(level: number, event: string, fields: Record<string, unknown> = {}) {
  if (level > configuredTraceLevel()) {
    return;
  }
  const payload = {
    logType: "trace",
    timestamp: new Date().toISOString(),
    service: logServiceName(),
    traceLevel: level,
    event,
    ...fields
  };
  console.log(JSON.stringify(payload));
}
