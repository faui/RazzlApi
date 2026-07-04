import { commerceQuery } from "@/lib/commerce/core/db/query";
import { COMMERCE_TABLES } from "@/lib/commerce/types/enums";
import type { CommercePlatformEventRow } from "@/lib/commerce/types/commerce-platform-event";
import type {
  CommerceEventProcessingStatus,
  CommercePlatformType
} from "@/lib/commerce/types/enums";

export class DuplicatePlatformEventError extends Error {
  constructor(public idempotencyKey: string) {
    super(`Duplicate platform event: ${idempotencyKey}`);
    this.name = "DuplicatePlatformEventError";
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "ER_DUP_ENTRY"
  );
}

export async function findPlatformEventByIdempotencyKey(
  idempotencyKey: string
): Promise<CommercePlatformEventRow | null> {
  const rows = await commerceQuery<CommercePlatformEventRow[]>(
    `SELECT * FROM ${COMMERCE_TABLES.platformEvent}
     WHERE idempotency_key = ?
     LIMIT 1`,
    [idempotencyKey]
  );
  return rows[0] ?? null;
}

export type InsertPlatformEventInput = {
  connectionId: number | null;
  platformType: CommercePlatformType;
  eventType: string;
  externalEventId: string | null;
  idempotencyKey: string;
  rawEventJson: unknown;
  normalizedEventJson: unknown | null;
};

export async function insertPlatformEvent(input: InsertPlatformEventInput): Promise<number> {
  try {
    await commerceQuery(
      `INSERT INTO ${COMMERCE_TABLES.platformEvent} (
         commerce_platform_connection_fk,
         platform_type,
         event_type,
         external_event_id,
         idempotency_key,
         raw_event_json,
         normalized_event_json,
         processing_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        input.connectionId,
        input.platformType,
        input.eventType,
        input.externalEventId,
        input.idempotencyKey,
        JSON.stringify(input.rawEventJson),
        input.normalizedEventJson ? JSON.stringify(input.normalizedEventJson) : null
      ]
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new DuplicatePlatformEventError(input.idempotencyKey);
    }
    throw error;
  }

  const row = await findPlatformEventByIdempotencyKey(input.idempotencyKey);
  if (!row) {
    throw new Error("Failed to load platform event after insert");
  }
  return row.commerce_platform_event_pk;
}

export async function updatePlatformEventStatus(
  eventPk: number,
  status: CommerceEventProcessingStatus,
  errorMessage?: string | null
): Promise<void> {
  await commerceQuery(
    `UPDATE ${COMMERCE_TABLES.platformEvent}
     SET processing_status = ?,
         processed_at = NOW(),
         error_message = ?
     WHERE commerce_platform_event_pk = ?`,
    [status, errorMessage ?? null, eventPk]
  );
}
