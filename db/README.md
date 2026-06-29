# Database schema

**MySQL DDL and migrations live in the Studio repository** — this repo does not duplicate schema files.

- Baseline: `../studio/db/database_schema_20260617_ddl.sql`
- Commerce migration: `../studio/db/migrations/20260628_commerce_core_schema.sql`
- Data model doc: `../studio/docs/commerce/DATA-MODEL.md`

RazzlApi consumes the shared RDS instance via `RAZZL_AUTH_DB_*` environment variables.

TypeScript row types: `lib/commerce/types/`
