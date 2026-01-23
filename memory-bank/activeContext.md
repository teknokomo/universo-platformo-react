# Active Context

> **Last Updated**: 2026-01-23
>
> **Purpose**: Current development focus only. Completed work -> progress.md, planned work -> tasks.md.

---

## Current Focus: Publication Snapshots + App System Tables (Completed)

**Status**: Implementation complete, schema-ddl tests and metahubs builds verified.

### Scope Summary
- Goal: Move app system tables to `_app_*`, store full Metahub snapshots in publication versions and migrations, and seed predefined records into app schemas.
- Ensure Application sync uses active publication version snapshots with stable hash for fast no-change detection.
- Remove unused `_predefined_data` table and service.

### Recent Accomplishments (2026-01-23)
- **schema-ddl**: Renamed `_sys_*` to `_app_*`, updated migration manager and tests, removed `_predefined_data` creation.
- **Snapshots**: SnapshotSerializer now includes all metahub records (treated as predefined), hubs, and stable hash (excludes generatedAt). Snapshot format version normalized to `1`.
- **Snapshot Hashing**: Replaced custom stable stringify with `json-stable-stringify` for deterministic hash generation.
- **QoL Fixes**: New attributes append to end; records return updatedAt; hubs persist table_name; snapshot JSON key order aligned; publication snapshot moved to dedicated migration column.
- **QA Fixes**: Snapshot now loads all hubs (no 1000 limit), preserves full catalog.config, records seeding skips invalid required fields, records API no longer accepts ownerId, utils stableStringify uses json-stable-stringify.
- **QA Follow-ups**: Frontend HubRecord ownerId now nullable; seed warnings persisted into latest migration meta.
- **UI Seed Warnings**: Migration detail API includes seedWarnings; Application Migrations UI renders warnings (i18n added).
- **Seed Warnings Indicator**: Migrations list shows warning icon; /application/:id/sync returns seedWarnings when present.
- **Publications**: Version creation now stores full snapshot + hash; activate endpoint updates `activeVersionId`.
- **Applications**: Sync uses active version snapshot, skips diff by hash, stores snapshot meta in `_app_migrations`, seeds predefined records into app tables.
- **Frontend**: Versions UI warns on duplicate snapshot creation (i18n added).
- **Docs**: README updated to `_app_*` system tables (EN/RU).

### Build / Test Status
- `pnpm --filter @universo/schema-ddl test` ✅
- `pnpm --filter @universo/schema-ddl build` ✅
- `pnpm --filter @universo/metahubs-backend build` ✅ (after hubs + snapshot v1 update)
- `pnpm --filter @universo/metahubs-frontend build` ✅

---

## Current Focus: Metahubs Records Architecture Fix (Completed)

**Status**: Implementation complete, build verified, QA passed.

### Scope Summary
- Goal: Fix 500 error when accessing catalog records in Design-Time schemas.
- Root cause: `MetahubRecordsService` queried non-existent `cat_<UUID>` tables in `mhb_*` schemas.
- Solution: Records stored in `_mhb_records` system table; Hubs unified into `_mhb_objects`.

### Recent Accomplishments (2026-01-22)
- **MetahubRecordsService Refactor**: Query `_mhb_records` table instead of `cat_*` tables.
- **schemaSync Simplification**: Removed DDL operations from Design-Time sync (no physical tables in `mhb_*`).
- **Hubs Unification**: Merged Hubs from `_mhb_hubs` table into `_mhb_objects` with `kind: 'HUB'`.
- **TypeORM Hub Entity Removal**: Deleted dead code (`Hub.ts` entity).
- **Build Verification**: Full workspace build successful.

### Architecture Clarification
| Schema | Purpose | Tables |
|--------|---------|--------|
| `metahubs` (central) | Registry of all Metahubs | `metahubs`, `publications`, `publication_versions` |
| `mhb_<UUID>` (isolated) | Design-Time metadata | `_mhb_objects`, `_mhb_attributes`, `_mhb_records` |
| `app_<UUID>` (isolated) | Run-Time data | `cat_<UUID>`, `_app_objects`, `_app_attributes`, `_app_migrations` |

### Key Principle
- `cat_<UUID>` tables exist ONLY in `app_*` schemas (Run-Time), NOT in `mhb_*` schemas (Design-Time).
- Hubs have `table_name: NULL` because they are organizational containers, not data-bearing objects.

### Next Steps
- Manual QA of record creation/listing in Design-Time.
- Integration testing with Publication → Application sync flow.

### Previous Focus: Refactor Connector-Publication Link (QA Pending)

**Status**: Implementation complete, manual QA pending before closure.

### Scope Summary
- Goal: Link connectors to Publications (not Metahubs) to fix schema sync logic.
- Ensure UI still uses "Metahubs" naming for user clarity.
- Guarantee "Create Schema" appears when schema does not exist.
- Prevent connectors without publications from passing validation.
- Preserve existing UX flows with minimal breaking changes.

### Database Updates (Completed)
- Table rename: `connectors_metahubs` → `connectors_publications`.
- Column rename: `metahub_id` → `publication_id`.
- FK updated to reference `metahubs.publications(id)`.
- RLS/constraints updated to match new relationship.
- Migration adjusted to remove obsolete publications_users references.

### Backend Updates: applications-backend (Completed)
- New entity: `ConnectorPublication` (replaces `ConnectorMetahub`).
- `connectorsRoutes.ts` updated to accept `publicationId`.
- Update exports to remove old connector-metahub types.
- Application migrations/sync endpoints updated for new linking.
- API payloads aligned with publication-based linking.

### Backend Updates: metahubs-backend (Completed)
- `/publications/available` now uses `metahubs_users` membership.
- Codename mapping: metahub uses `slug`, publication uses `schema_name`.
- Single-publication limit enforced (400 on duplicate).
- Removed `publications_users` dependency from routes and migration.

### Frontend Updates: applications-frontend (Completed)
- New types: `ConnectorPublication`, `PublicationSummary`.
- New API: `connectorPublications.ts` (list, link, unlink, available).
- New hook: `useConnectorPublications.ts`.
- New UI: `PublicationSelectionPanel`, `ConnectorPublicationInfoPanel`, `ConnectorPublicationInfoWrapper`.
- Connector UI updated to use publicationId, not metahubId.
- ConnectorDiffDialog now shows tables to be created when schema missing.

### Frontend Updates: metahubs-frontend (Completed)
- PublicationList disables Add when a publication already exists.
- Info banner explains single-publication limit.
- i18n keys added and shortened for clarity.

### UI/UX Refinements (Completed)
- Tabs show "Metahubs" label (user-facing wording).
- PublicationSelectionPanel displays Metahub names, returns publication IDs internally.
- Button text toggles between "Create Schema" and "Sync Schema".
- Connector list shows relation column and Metahub chip.
- Connector name uses hover-only blue styling (ApplicationList pattern).

### Recent Fixes (2026-01-19)
- Removed `publications_users` table and related entity wiring.
- Fixed `/publications/available` access query and codename mapping.
- Added missing i18n keys for connector tables and search.
- Updated connector list columns and admin notice layout.
- Cleaned schema-ddl utilities and tests.

### Build / Test Status
- Full build successful (64 tasks).
- schema-ddl test suite passed (80 tests).
- No runtime errors reported during build.

### QA Checklist (Pending)
1. Drop and recreate test database (breaking migration).
2. Create Metahub.
3. Create Publication in the Metahub (verify single-publication rule).
4. Create Application + Connector linked to Metahub.
5. Confirm "Create Schema" button appears.
6. Run create schema, verify tables created.
7. Confirm button switches to "Sync Schema".
8. Validate ConnectorDiffDialog output (tables to create).
9. Validate `/publications/available` list shows correct metahub names.

### Risks / Edge Cases
- Existing connectors without publications may fail validation.
- Old migrations in downstream environments may need reset.
- UI still uses "Metahubs" labels while internal links use publications.
- Ensure manual applications (no publication) still follow sync rules.

### Current State Checklist (Completed)
- Migration renames connectors table and FK references to publications.
- ConnectorPublication entity replaces ConnectorMetahub in backend.
- Connector routes accept publicationId and enforce validation.
- Publication available endpoint returns metahub metadata + schema_name.
- Single-publication limit enforced on backend and frontend.
- Connector UI uses publicationId but keeps Metahubs label.
- ConnectorDiffDialog supports create-schema scenario.
- i18n keys added for connector tables and search.
- Admin notice text and layout updated.
- schema-ddl utilities cleaned and tests updated.
- Build succeeded across workspace.
- Memory bank entries prepared for QA closure.

### Open Questions (Before Closure)
- Should old connector-metahub links be auto-migrated for existing data?
- Do we need a backfill script for connectors without publications?
- Is additional UI copy needed to explain single-publication limit?
- Should permissions gate the Create Schema action explicitly?
- Should available publications include more metadata in the list?
- Are extra tests needed for /publications/available access rules?
- Should QA include a check for connector deletion/unlink flows?

### Immediate Next Steps
- Run QA checklist above.
- Log results into progress.md (2026-01-20 entry).
- Close the refactor task in tasks.md after QA sign-off.

### References
- Details: progress.md#2026-01-20
- Related fixes: progress.md#2026-01-19
- Active tasks: tasks.md
