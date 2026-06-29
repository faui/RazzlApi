import type {
  CommercePlatformType,
  CommerceSyncRunStatus,
  CommerceSyncType,
  CommerceTimestamp
} from "./enums";

export type CommercePlatformSyncRunRow = {
  commerce_platform_sync_run_pk: number;
  commerce_platform_connection_fk: number;
  platform_type: CommercePlatformType;
  sync_type: CommerceSyncType;
  status: CommerceSyncRunStatus;
  started_at: CommerceTimestamp;
  completed_at: CommerceTimestamp | null;
  products_seen: number | null;
  products_created: number | null;
  products_updated: number | null;
  products_deleted_or_archived: number | null;
  variants_seen: number | null;
  error_code: string | null;
  error_message: string | null;
  metadata_json: unknown | null;
  created_on: CommerceTimestamp;
};

export type CommercePlatformSyncRunInsert = Omit<
  CommercePlatformSyncRunRow,
  "commerce_platform_sync_run_pk" | "created_on" | "started_at"
> & {
  commerce_platform_sync_run_pk?: number;
  started_at?: CommerceTimestamp;
};

export type CommercePlatformSyncRunUpdate = Partial<
  Omit<CommercePlatformSyncRunRow, "commerce_platform_sync_run_pk" | "created_on" | "started_at">
>;
