# Metaverse Server (BACKEND)

Backend API for the Metaverse domain in Universo Platformo.

## Endpoints (MVP)

-   `GET /api/v1/metaverses` (auth required) — list metaverses visible to the user via membership or public visibility
-   `POST /api/v1/metaverses` (auth required) — create a new metaverse; owner membership is created for the caller

All routes are protected by `ensureAuth` and rate-limited.

## Security & RLS

-   Per-request Supabase client is created from the incoming `Authorization: Bearer <JWT>` header
-   PostgreSQL schema: `metaverse`
-   Tables: `metaverse.metaverses`, `metaverse.user_metaverses`, `metaverse.metaverse_links`
-   Strict RLS policies:
    -   `metaverses`: SELECT by membership or public visibility; INSERT only by `auth.uid()`; UPDATE/DELETE only by owners
    -   `user_metaverses`: SELECT by self or owners of the same metaverse; INSERT/UPDATE gated by owner role; self can update `is_default`
    -   `metaverse_links`: SELECT by members; INSERT/UPDATE/DELETE by owners
-   Indexes:
    -   `uq_user_default_metaverse` (partial unique on `user_id` where `is_default=true`)
    -   `uq_links` on (`src_metaverse_id`, `dst_metaverse_id`, `relation_type`)

## Integration

-   Router mounted in `packages/server/src/routes/index.ts` under `/api/v1/metaverses`
-   Migrations aggregated in `packages/server/src/database/migrations/postgres/index.ts`

## Migrations

Implemented via TypeORM migration `1742020000000-MetaverseCore`:

-   Creates schema and tables, adds FKs (best-effort), indexes, enables RLS, and defines policies

## Environment

-   Uses the main server database configuration (Postgres)
-   No extra env vars are required beyond Supabase JWT secret and DB connection

## Commands

-   `pnpm build` – compile TypeScript
-   `pnpm lint` – run ESLint checks

## Notes

-   No frontend dependencies here
-   Do not log tokens or PII
-   Future endpoints: update/delete/get-by-id; toggle default; membership CRUD; links CRUD; import/publish hooks
