import type {
  CommerceEventProcessingStatus,
  CommercePlatformType,
  CommerceTimestamp
} from "./enums";

export type CommercePlatformEventRow = {
  commerce_platform_event_pk: number;
  commerce_platform_connection_fk: number | null;
  platform_type: CommercePlatformType;
  event_type: string;
  external_event_id: string | null;
  idempotency_key: string;
  raw_event_json: unknown;
  normalized_event_json: unknown | null;
  processing_status: CommerceEventProcessingStatus;
  received_at: CommerceTimestamp;
  processed_at: CommerceTimestamp | null;
  error_message: string | null;
  created_on: CommerceTimestamp;
};

export type CommercePlatformEventInsert = Omit<
  CommercePlatformEventRow,
  "commerce_platform_event_pk" | "created_on" | "received_at"
> & {
  commerce_platform_event_pk?: number;
  received_at?: CommerceTimestamp;
};

export type CommercePlatformEventUpdate = Partial<
  Omit<CommercePlatformEventRow, "commerce_platform_event_pk" | "created_on" | "received_at">
>;
