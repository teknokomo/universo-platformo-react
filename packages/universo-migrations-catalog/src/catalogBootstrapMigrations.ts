import type { PlatformMigrationFile } from '@universo/migrations-core'

const catalogScope = {
    kind: 'platform_schema' as const,
    key: 'upl_migrations'
}

export const catalogBootstrapMigrations: PlatformMigrationFile[] = [
    {
        id: 'CatalogBootstrap0001MigrationRuns',
        version: '0001',
        scope: catalogScope,
        sourceKind: 'file',
        transactionMode: 'single',
        lockMode: 'transaction_advisory',
        summary: 'Bootstrap upl_migrations.migration_runs catalog kernel',
        async up(ctx) {
            await ctx.raw('CREATE SCHEMA IF NOT EXISTS upl_migrations')
            await ctx.raw(`
                CREATE TABLE IF NOT EXISTS upl_migrations.migration_runs (
                    id uuid PRIMARY KEY,
                    scope_kind text NOT NULL,
                    scope_key text NOT NULL,
                    source_kind text NOT NULL,
                    migration_name text NOT NULL,
                    migration_version text NOT NULL,
                    checksum text NOT NULL,
                    transaction_mode text NOT NULL,
                    lock_mode text NOT NULL,
                    status text NOT NULL,
                    summary text,
                    meta jsonb,
                    snapshot_before jsonb,
                    snapshot_after jsonb,
                    plan jsonb,
                    error jsonb,
                    _upl_created_at timestamptz NOT NULL DEFAULT now(),
                    _upl_updated_at timestamptz NOT NULL DEFAULT now()
                )
            `)
            await ctx.raw(`
                CREATE INDEX IF NOT EXISTS upl_migration_runs_scope_migration_idx
                ON upl_migrations.migration_runs(scope_kind, scope_key, migration_name, migration_version, _upl_created_at DESC)
            `)
            await ctx.raw(`
                CREATE INDEX IF NOT EXISTS upl_migration_runs_scope_status_idx
                ON upl_migrations.migration_runs(scope_kind, scope_key, status, _upl_created_at DESC)
            `)
            await ctx.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS upl_migration_runs_applied_unique_idx
                ON upl_migrations.migration_runs(scope_kind, scope_key, migration_name, migration_version)
                WHERE status = 'applied'
            `)
        }
    },
    {
        id: 'CatalogBootstrap0002DefinitionRegistry',
        version: '0002',
        scope: catalogScope,
        sourceKind: 'file',
        transactionMode: 'single',
        lockMode: 'transaction_advisory',
        summary: 'Bootstrap upl_migrations.definition_registry storage',
        async up(ctx) {
            await ctx.raw(`
                CREATE TABLE IF NOT EXISTS upl_migrations.definition_registry (
                    id uuid PRIMARY KEY,
                    logical_key text NOT NULL UNIQUE,
                    kind text NOT NULL,
                    active_revision_id uuid,
                    source_kind text NOT NULL,
                    meta jsonb,
                    _upl_created_at timestamptz NOT NULL DEFAULT now(),
                    _upl_updated_at timestamptz NOT NULL DEFAULT now()
                )
            `)
        }
    },
    {
        id: 'CatalogBootstrap0003DefinitionRevisions',
        version: '0003',
        scope: catalogScope,
        sourceKind: 'file',
        transactionMode: 'single',
        lockMode: 'transaction_advisory',
        summary: 'Bootstrap upl_migrations.definition_revisions storage',
        async up(ctx) {
            await ctx.raw(`
                CREATE TABLE IF NOT EXISTS upl_migrations.definition_revisions (
                    id uuid PRIMARY KEY,
                    registry_id uuid NOT NULL REFERENCES upl_migrations.definition_registry(id) ON DELETE CASCADE,
                    revision_status text NOT NULL,
                    checksum text NOT NULL,
                    payload jsonb NOT NULL,
                    provenance jsonb,
                    _upl_created_at timestamptz NOT NULL DEFAULT now(),
                    _upl_updated_at timestamptz NOT NULL DEFAULT now()
                )
            `)
        }
    },
    {
        id: 'CatalogBootstrap0004DefinitionExports',
        version: '0004',
        scope: catalogScope,
        sourceKind: 'file',
        transactionMode: 'single',
        lockMode: 'transaction_advisory',
        summary: 'Bootstrap upl_migrations.definition_exports storage',
        async up(ctx) {
            await ctx.raw(`
                CREATE TABLE IF NOT EXISTS upl_migrations.definition_exports (
                    id uuid PRIMARY KEY,
                    registry_id uuid NOT NULL REFERENCES upl_migrations.definition_registry(id) ON DELETE CASCADE,
                    revision_id uuid REFERENCES upl_migrations.definition_revisions(id) ON DELETE SET NULL,
                    export_target text NOT NULL,
                    file_checksum text,
                    meta jsonb,
                    _upl_created_at timestamptz NOT NULL DEFAULT now(),
                    _upl_updated_at timestamptz NOT NULL DEFAULT now()
                )
            `)
        }
    },
    {
        id: 'CatalogBootstrap0005ApprovalEvents',
        version: '0005',
        scope: catalogScope,
        sourceKind: 'file',
        transactionMode: 'single',
        lockMode: 'transaction_advisory',
        summary: 'Bootstrap upl_migrations.approval_events storage',
        async up(ctx) {
            await ctx.raw(`
                CREATE TABLE IF NOT EXISTS upl_migrations.approval_events (
                    id uuid PRIMARY KEY,
                    migration_run_id uuid REFERENCES upl_migrations.migration_runs(id) ON DELETE CASCADE,
                    event_kind text NOT NULL,
                    actor_id uuid,
                    payload jsonb,
                    _upl_created_at timestamptz NOT NULL DEFAULT now()
                )
            `)
        }
    },
    {
        id: 'CatalogBootstrap0006DefinitionDrafts',
        version: '0006',
        scope: catalogScope,
        sourceKind: 'file',
        transactionMode: 'single',
        lockMode: 'transaction_advisory',
        summary: 'Bootstrap upl_migrations.definition_drafts for future editor UI',
        async up(ctx) {
            await ctx.raw(`
                CREATE TABLE IF NOT EXISTS upl_migrations.definition_drafts (
                    id uuid PRIMARY KEY,
                    registry_id uuid REFERENCES upl_migrations.definition_registry(id) ON DELETE CASCADE,
                    status text NOT NULL DEFAULT 'draft',
                    checksum text NOT NULL,
                    payload jsonb NOT NULL,
                    provenance jsonb,
                    author_id uuid,
                    _upl_created_at timestamptz NOT NULL DEFAULT now(),
                    _upl_updated_at timestamptz NOT NULL DEFAULT now()
                )
            `)
        }
    },
    {
        id: 'CatalogBootstrap0007DefinitionExportUniqueIndexes',
        version: '0007',
        scope: catalogScope,
        sourceKind: 'file',
        transactionMode: 'single',
        lockMode: 'transaction_advisory',
        summary: 'Bootstrap unique indexes for race-safe definition export dedupe',
        async up(ctx) {
            await ctx.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_definition_exports_registry_revision_target
                ON upl_migrations.definition_exports(registry_id, revision_id, export_target)
                WHERE revision_id IS NOT NULL
            `)
            await ctx.raw(`
                CREATE UNIQUE INDEX IF NOT EXISTS idx_definition_exports_registry_target_null_revision
                ON upl_migrations.definition_exports(registry_id, export_target)
                WHERE revision_id IS NULL
            `)
        }
    }
]
