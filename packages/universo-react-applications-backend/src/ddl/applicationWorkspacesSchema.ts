import type { DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable, qTable } from '@universo-react/database'
import {
    hasPhysicalRuntimeTable,
    resolveEntityTableName,
    resolveFieldColumnName,
    type Component,
    type EntityDefinition
} from '@universo-react/schema-ddl'
import {
    isLedgerSchemaCapableEntity,
    normalizeLedgerConfigFromConfig,
    type EntityTypeCapabilities,
    type LedgerConfig
} from '@universo-react/types'

const WORKSPACES_TABLE = '_app_workspaces'
const WORKSPACE_ROLES_TABLE = '_app_workspace_roles'
const WORKSPACE_USER_ROLES_TABLE = '_app_workspace_user_roles'
const APP_LIMITS_TABLE = '_app_limits'
const WORKSPACE_SETTINGS_TABLE = '_app_workspace_settings'
const WORKSPACE_OPERATIONS_TABLE = '_app_workspace_operation_audit'
const WORKSPACE_POLICY_SELECT = 'workspace_select'
const WORKSPACE_POLICY_INSERT = 'workspace_insert'
const WORKSPACE_POLICY_UPDATE = 'workspace_update'
const WORKSPACE_POLICY_DELETE = 'workspace_delete'
const WORKSPACE_LIMIT_SCOPE_KIND = 'workspace'
const WORKSPACE_LIMIT_OBJECT_KIND = 'object'
const WORKSPACE_LIMIT_METRIC_KEY = 'rows'
const WORKSPACE_LIMIT_PERIOD_KEY = 'lifetime'
const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'
const CURRENT_WORKSPACE_SETTING = `NULLIF(current_setting('app.current_workspace_id', true), '')`

const normalizeLedgerFieldKey = (value: string): string => value.trim().toLowerCase()
const normalizeLedgerFieldIdentity = (value: string): string => value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const qWorkspaceColumn = () => qColumn('workspace_id')

const buildWorkspaceAwareActiveRowSql = (): string =>
    `(${qWorkspaceColumn()} IS NOT NULL AND ${qWorkspaceColumn()}::text = ${CURRENT_WORKSPACE_SETTING})`

async function ensureWorkspaceSupportTable(executor: DbExecutor, schemaName: string, tableName: string, ddl: string): Promise<void> {
    const qt = qSchemaTable(schemaName, tableName)
    const rows = await executor.query<{ exists: boolean }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_name = $2
        ) AS exists
        `,
        [schemaName, tableName]
    )

    if (rows[0]?.exists === true) {
        return
    }

    await executor.query(ddl.split('__TABLE__').join(qt))
}

export async function ensureWorkspaceSupportTables(executor: DbExecutor, schemaName: string): Promise<void> {
    await ensureWorkspaceSupportTable(
        executor,
        schemaName,
        WORKSPACES_TABLE,
        `
        CREATE TABLE __TABLE__ (
            id UUID PRIMARY KEY,
            name JSONB NOT NULL,
            description JSONB NOT NULL,
            workspace_type TEXT NOT NULL DEFAULT 'personal',
            codename TEXT NULL,
            personal_user_id UUID NULL,
            status TEXT NOT NULL DEFAULT 'active',
            _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            _upl_created_by UUID NULL,
            _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            _upl_updated_by UUID NULL,
            _upl_deleted BOOLEAN NOT NULL DEFAULT false,
            _upl_deleted_at TIMESTAMPTZ NULL,
            _upl_deleted_by UUID NULL,
            _upl_version BIGINT NOT NULL DEFAULT 1,
            _upl_locked BOOLEAN NOT NULL DEFAULT false,
            _app_deleted BOOLEAN NOT NULL DEFAULT false,
            _app_deleted_at TIMESTAMPTZ NULL,
            _app_deleted_by UUID NULL
        )
        `
    )

    await ensureWorkspaceSupportTable(
        executor,
        schemaName,
        WORKSPACE_ROLES_TABLE,
        `
        CREATE TABLE __TABLE__ (
            id UUID PRIMARY KEY,
            codename TEXT NOT NULL,
            name JSONB NOT NULL,
            _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            _upl_created_by UUID NULL,
            _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            _upl_updated_by UUID NULL,
            _upl_deleted BOOLEAN NOT NULL DEFAULT false,
            _upl_deleted_at TIMESTAMPTZ NULL,
            _upl_deleted_by UUID NULL,
            _upl_version BIGINT NOT NULL DEFAULT 1,
            _app_deleted BOOLEAN NOT NULL DEFAULT false,
            _app_deleted_at TIMESTAMPTZ NULL,
            _app_deleted_by UUID NULL
        )
        `
    )

    await ensureWorkspaceSupportTable(
        executor,
        schemaName,
        WORKSPACE_USER_ROLES_TABLE,
        `
        CREATE TABLE __TABLE__ (
            id UUID PRIMARY KEY,
            workspace_id UUID NOT NULL,
            user_id UUID NOT NULL,
            role_id UUID NOT NULL,
            is_default_workspace BOOLEAN NOT NULL DEFAULT false,
            _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            _upl_created_by UUID NULL,
            _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            _upl_updated_by UUID NULL,
            _upl_deleted BOOLEAN NOT NULL DEFAULT false,
            _upl_deleted_at TIMESTAMPTZ NULL,
            _upl_deleted_by UUID NULL,
            _upl_version BIGINT NOT NULL DEFAULT 1,
            _app_deleted BOOLEAN NOT NULL DEFAULT false,
            _app_deleted_at TIMESTAMPTZ NULL,
            _app_deleted_by UUID NULL
        )
        `
    )

    await ensureWorkspaceSupportTable(
        executor,
        schemaName,
        APP_LIMITS_TABLE,
        `
        CREATE TABLE __TABLE__ (
            id UUID PRIMARY KEY,
            scope_kind TEXT NOT NULL DEFAULT '${WORKSPACE_LIMIT_SCOPE_KIND}',
            scope_id UUID NULL,
            object_kind TEXT NOT NULL DEFAULT '${WORKSPACE_LIMIT_OBJECT_KIND}',
            object_id UUID NULL,
            metric_key TEXT NOT NULL DEFAULT '${WORKSPACE_LIMIT_METRIC_KEY}',
            period_key TEXT NOT NULL DEFAULT '${WORKSPACE_LIMIT_PERIOD_KEY}',
            max_value BIGINT NULL,
            _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            _upl_created_by UUID NULL,
            _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            _upl_updated_by UUID NULL,
            _upl_deleted BOOLEAN NOT NULL DEFAULT false,
            _upl_deleted_at TIMESTAMPTZ NULL,
            _upl_deleted_by UUID NULL,
            _upl_version BIGINT NOT NULL DEFAULT 1,
            _app_deleted BOOLEAN NOT NULL DEFAULT false,
            _app_deleted_at TIMESTAMPTZ NULL,
            _app_deleted_by UUID NULL
        )
        `
    )

    await ensureWorkspaceSupportTable(
        executor,
        schemaName,
        WORKSPACE_SETTINGS_TABLE,
        `
        CREATE TABLE __TABLE__ (
            id UUID PRIMARY KEY,
            workspace_id UUID NOT NULL,
            key TEXT NOT NULL,
            value JSONB NOT NULL,
            _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            _upl_created_by UUID NULL,
            _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            _upl_updated_by UUID NULL,
            _upl_deleted BOOLEAN NOT NULL DEFAULT false,
            _upl_deleted_at TIMESTAMPTZ NULL,
            _upl_deleted_by UUID NULL,
            _upl_version BIGINT NOT NULL DEFAULT 1,
            _app_deleted BOOLEAN NOT NULL DEFAULT false,
            _app_deleted_at TIMESTAMPTZ NULL,
            _app_deleted_by UUID NULL
        )
        `
    )

    await ensureWorkspaceSupportTable(
        executor,
        schemaName,
        WORKSPACE_OPERATIONS_TABLE,
        `
        CREATE TABLE __TABLE__ (
            id UUID PRIMARY KEY DEFAULT public.uuid_generate_v7(),
            workspace_id UUID NOT NULL,
            operation_kind TEXT NOT NULL,
            affected_rows INTEGER NOT NULL DEFAULT 0 CHECK (affected_rows >= 0),
            actor_user_id UUID NULL,
            source_key TEXT NULL,
            _upl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            _upl_created_by UUID NULL,
            _upl_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            _upl_updated_by UUID NULL,
            _upl_deleted BOOLEAN NOT NULL DEFAULT false,
            _upl_deleted_at TIMESTAMPTZ NULL,
            _upl_deleted_by UUID NULL,
            _upl_version BIGINT NOT NULL DEFAULT 1,
            _app_deleted BOOLEAN NOT NULL DEFAULT false,
            _app_deleted_at TIMESTAMPTZ NULL,
            _app_deleted_by UUID NULL,
            CONSTRAINT ${qTable(`${WORKSPACE_OPERATIONS_TABLE}_kind_ck`)}
                CHECK (operation_kind IN ('seed_reset'))
        )
        `
    )

    const workspacesQt = qSchemaTable(schemaName, WORKSPACES_TABLE)
    const workspaceRolesQt = qSchemaTable(schemaName, WORKSPACE_ROLES_TABLE)
    const workspaceUserRolesQt = qSchemaTable(schemaName, WORKSPACE_USER_ROLES_TABLE)
    const appLimitsQt = qSchemaTable(schemaName, APP_LIMITS_TABLE)
    const workspaceSettingsQt = qSchemaTable(schemaName, WORKSPACE_SETTINGS_TABLE)
    const workspaceOperationsQt = qSchemaTable(schemaName, WORKSPACE_OPERATIONS_TABLE)

    await executor.query(
        `
        ALTER TABLE ${workspacesQt}
        ADD COLUMN IF NOT EXISTS codename TEXT NULL;

        ALTER TABLE ${workspaceUserRolesQt}
        DROP CONSTRAINT IF EXISTS ${qTable('_app_workspace_user_roles_workspace_fk')};

        ALTER TABLE ${workspaceUserRolesQt}
        ADD CONSTRAINT ${qTable('_app_workspace_user_roles_workspace_fk')}
        FOREIGN KEY (workspace_id) REFERENCES ${workspacesQt}(id) ON DELETE CASCADE;

        ALTER TABLE ${workspaceUserRolesQt}
        DROP CONSTRAINT IF EXISTS ${qTable('_app_workspace_user_roles_role_fk')};

        ALTER TABLE ${workspaceUserRolesQt}
        ADD CONSTRAINT ${qTable('_app_workspace_user_roles_role_fk')}
        FOREIGN KEY (role_id) REFERENCES ${workspaceRolesQt}(id) ON DELETE RESTRICT;

        ALTER TABLE ${appLimitsQt}
        DROP CONSTRAINT IF EXISTS ${qTable('_app_limits_object_fk')};

        ALTER TABLE ${appLimitsQt}
        ADD CONSTRAINT ${qTable('_app_limits_object_fk')}
        FOREIGN KEY (object_id) REFERENCES ${qSchemaTable(schemaName, '_app_objects')}(id) ON DELETE CASCADE;

        ALTER TABLE ${workspaceSettingsQt}
        DROP CONSTRAINT IF EXISTS ${qTable('_app_workspace_settings_workspace_fk')};

        ALTER TABLE ${workspaceSettingsQt}
        ADD CONSTRAINT ${qTable('_app_workspace_settings_workspace_fk')}
        FOREIGN KEY (workspace_id) REFERENCES ${workspacesQt}(id) ON DELETE CASCADE;

        ALTER TABLE ${workspaceOperationsQt}
        DROP CONSTRAINT IF EXISTS ${qTable('_app_workspace_operation_audit_workspace_fk')};

        ALTER TABLE ${workspaceOperationsQt}
        ADD CONSTRAINT ${qTable('_app_workspace_operation_audit_workspace_fk')}
        FOREIGN KEY (workspace_id) REFERENCES ${workspacesQt}(id) ON DELETE CASCADE;
        `
    )

    await executor.query(
        `
        DROP INDEX IF EXISTS ${qTable(`${WORKSPACE_USER_ROLES_TABLE}_role_active_uidx`)};

        WITH ranked_memberships AS (
            SELECT
                wur.id,
                ROW_NUMBER() OVER (
                    PARTITION BY wur.workspace_id, wur.user_id
                    ORDER BY wur.is_default_workspace DESC, wur._upl_created_at ASC, wur.id ASC
                ) AS row_rank
            FROM ${workspaceUserRolesQt} wur
            WHERE wur._upl_deleted = false
              AND wur._app_deleted = false
        )
        UPDATE ${workspaceUserRolesQt} target
        SET _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_updated_at = NOW(),
            _upl_version = COALESCE(target._upl_version, 1) + 1,
            _app_deleted = true,
            _app_deleted_at = NOW()
        FROM ranked_memberships ranked
        WHERE target.id = ranked.id
          AND ranked.row_rank > 1;

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${WORKSPACE_ROLES_TABLE}_codename_active_uidx`)}
        ON ${workspaceRolesQt}(codename)
        WHERE _upl_deleted = false AND _app_deleted = false;

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${WORKSPACES_TABLE}_personal_user_active_uidx`)}
        ON ${workspacesQt}(personal_user_id)
        WHERE workspace_type = 'personal' AND _upl_deleted = false AND _app_deleted = false;

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${WORKSPACES_TABLE}_codename_active_uidx`)}
        ON ${workspacesQt}(codename)
        WHERE codename IS NOT NULL AND _upl_deleted = false AND _app_deleted = false;

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${WORKSPACE_USER_ROLES_TABLE}_default_active_uidx`)}
        ON ${workspaceUserRolesQt}(user_id)
        WHERE is_default_workspace = true AND _upl_deleted = false AND _app_deleted = false;

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${WORKSPACE_USER_ROLES_TABLE}_membership_active_uidx`)}
        ON ${workspaceUserRolesQt}(workspace_id, user_id)
        WHERE _upl_deleted = false AND _app_deleted = false;

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${APP_LIMITS_TABLE}_workspace_object_global_active_uidx`)}
        ON ${appLimitsQt}(scope_kind, object_kind, object_id, metric_key, period_key)
        WHERE scope_id IS NULL AND _upl_deleted = false AND _app_deleted = false;

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${APP_LIMITS_TABLE}_workspace_object_scoped_active_uidx`)}
        ON ${appLimitsQt}(scope_kind, scope_id, object_kind, object_id, metric_key, period_key)
        WHERE scope_id IS NOT NULL AND _upl_deleted = false AND _app_deleted = false;

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${WORKSPACE_SETTINGS_TABLE}_workspace_key_active_uidx`)}
        ON ${workspaceSettingsQt}(workspace_id, key)
        WHERE _upl_deleted = false AND _app_deleted = false;

        CREATE INDEX IF NOT EXISTS ${qTable(`${WORKSPACE_USER_ROLES_TABLE}_user_idx`)}
        ON ${workspaceUserRolesQt}(user_id);

        CREATE INDEX IF NOT EXISTS ${qTable(`${APP_LIMITS_TABLE}_object_idx`)}
        ON ${appLimitsQt}(object_id);

        CREATE INDEX IF NOT EXISTS ${qTable(`${WORKSPACE_SETTINGS_TABLE}_workspace_idx`)}
        ON ${workspaceSettingsQt}(workspace_id);

        CREATE INDEX IF NOT EXISTS ${qTable(`${WORKSPACE_SETTINGS_TABLE}_key_idx`)}
        ON ${workspaceSettingsQt}(key);

        CREATE INDEX IF NOT EXISTS ${qTable(`${WORKSPACE_OPERATIONS_TABLE}_workspace_created_idx`)}
        ON ${workspaceOperationsQt}(workspace_id, _upl_created_at DESC);

        CREATE INDEX IF NOT EXISTS ${qTable(`${WORKSPACE_OPERATIONS_TABLE}_kind_idx`)}
        ON ${workspaceOperationsQt}(operation_kind);
        `
    )
}

export async function ensureWorkspaceScopedColumn(executor: DbExecutor, schemaName: string, tableName: string): Promise<void> {
    const qt = qSchemaTable(schemaName, tableName)
    const workspacesQt = qSchemaTable(schemaName, WORKSPACES_TABLE)
    const workspaceColumn = qWorkspaceColumn()
    const seedSourceColumn = qColumn('_seed_source_key')
    const seedSourceOwnedColumn = qColumn('_seed_source_owned')
    const workspaceConstraintName = qTable(`${tableName}_workspace_id_fk`)
    await executor.query(
        `
        ALTER TABLE ${qt}
        ADD COLUMN IF NOT EXISTS ${workspaceColumn} UUID NULL;

        ALTER TABLE ${qt}
        ADD COLUMN IF NOT EXISTS ${seedSourceColumn} TEXT NULL;

        ALTER TABLE ${qt}
        ADD COLUMN IF NOT EXISTS ${seedSourceOwnedColumn} BOOLEAN NOT NULL DEFAULT true;

        ALTER TABLE ${qt}
        DROP CONSTRAINT IF EXISTS ${workspaceConstraintName};

        ALTER TABLE ${qt}
        ADD CONSTRAINT ${workspaceConstraintName}
        FOREIGN KEY (${workspaceColumn}) REFERENCES ${workspacesQt}(id) ON DELETE RESTRICT;

        CREATE INDEX IF NOT EXISTS ${qTable(`${tableName}_workspace_id_idx`)}
        ON ${qt}(${workspaceColumn});

        CREATE INDEX IF NOT EXISTS ${qTable(`${tableName}_seed_source_key_idx`)}
        ON ${qt}(${seedSourceColumn});

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${tableName}_workspace_seed_source_active_uidx`)}
        ON ${qt}(${workspaceColumn}, ${seedSourceColumn})
        WHERE ${seedSourceColumn} IS NOT NULL AND _upl_deleted = false AND _app_deleted = false;
        `
    )
}

function resolveLedgerConfig(config: Record<string, unknown> | undefined): LedgerConfig {
    return normalizeLedgerConfigFromConfig(config)
}

function resolveRuntimeComponents(entity: EntityDefinition): EntityTypeCapabilities | undefined {
    if (entity.capabilities) {
        return entity.capabilities
    }
    if (isRecord(entity.config?.capabilities)) {
        return entity.config.capabilities as unknown as EntityTypeCapabilities
    }
    return undefined
}

function isLedgerSchemaRuntimeEntity(entity: EntityDefinition): boolean {
    return isLedgerSchemaCapableEntity(resolveRuntimeComponents(entity))
}

function findLedgerIdempotencyField(fields: Component[], keyField: string): Component | null {
    const normalized = normalizeLedgerFieldKey(keyField)
    const normalizedIdentity = normalizeLedgerFieldIdentity(keyField)

    return (
        fields.find((field) => {
            if (field.dataType === 'TABLE' || field.parentComponentId) {
                return false
            }
            const columnName = resolveFieldColumnName(field)
            return (
                normalizeLedgerFieldKey(field.codename) === normalized ||
                normalizeLedgerFieldKey(columnName) === normalized ||
                normalizeLedgerFieldIdentity(field.codename) === normalizedIdentity ||
                normalizeLedgerFieldIdentity(columnName) === normalizedIdentity
            )
        }) ?? null
    )
}

function buildRuntimeIndexName(tableName: string, suffix: string): string {
    return `${tableName}_${suffix}`.slice(0, 63)
}

export async function ensureLedgerIdempotencyIndex(executor: DbExecutor, schemaName: string, entity: EntityDefinition): Promise<void> {
    if (!isLedgerSchemaRuntimeEntity(entity) || !hasPhysicalRuntimeTable(entity)) {
        return
    }

    const keyFields = resolveLedgerConfig(entity.config).idempotency.keyFields
    if (keyFields.length === 0) {
        return
    }

    const keyColumns = keyFields
        .map((keyField) => findLedgerIdempotencyField(entity.fields, keyField))
        .filter((field): field is Component => Boolean(field))
        .map((field) => resolveFieldColumnName(field))

    if (keyColumns.length !== keyFields.length) {
        return
    }

    const tableName = resolveEntityTableName(entity)
    const tableIdent = qSchemaTable(schemaName, tableName)
    const quotedKeyColumns = keyColumns.map((columnName) => qColumn(columnName))
    const notNullConditions = quotedKeyColumns.map((columnName) => `${columnName} IS NOT NULL`)
    await executor.query(
        `
        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(buildRuntimeIndexName(tableName, 'ledger_idempotency_uidx'))}
        ON ${tableIdent}(${[qColumn('workspace_id'), ...quotedKeyColumns].join(', ')})
        WHERE ${notNullConditions.join(' AND ')} AND ${ACTIVE_ROW_SQL};
        `
    )
}

async function recreateWorkspacePolicy(executor: DbExecutor, tableIdent: string, policyName: string, sql: string): Promise<void> {
    await executor.query(`DROP POLICY IF EXISTS ${qTable(policyName)} ON ${tableIdent}`)
    await executor.query(sql)
}

export async function ensureWorkspaceScopedPolicies(executor: DbExecutor, schemaName: string, tableName: string): Promise<void> {
    const tableIdent = qSchemaTable(schemaName, tableName)
    const workspaceColumn = qWorkspaceColumn()
    const selectPredicate = buildWorkspaceAwareActiveRowSql()
    const mutatePredicate = `${workspaceColumn}::text = ${CURRENT_WORKSPACE_SETTING}`

    await executor.query(`ALTER TABLE ${tableIdent} ENABLE ROW LEVEL SECURITY`)

    await recreateWorkspacePolicy(
        executor,
        tableIdent,
        WORKSPACE_POLICY_SELECT,
        `CREATE POLICY ${qTable(WORKSPACE_POLICY_SELECT)} ON ${tableIdent} FOR SELECT USING (${selectPredicate})`
    )
    await recreateWorkspacePolicy(
        executor,
        tableIdent,
        WORKSPACE_POLICY_INSERT,
        `CREATE POLICY ${qTable(WORKSPACE_POLICY_INSERT)} ON ${tableIdent} FOR INSERT WITH CHECK (${mutatePredicate})`
    )
    await recreateWorkspacePolicy(
        executor,
        tableIdent,
        WORKSPACE_POLICY_UPDATE,
        `CREATE POLICY ${qTable(
            WORKSPACE_POLICY_UPDATE
        )} ON ${tableIdent} FOR UPDATE USING (${mutatePredicate}) WITH CHECK (${mutatePredicate})`
    )
    await recreateWorkspacePolicy(
        executor,
        tableIdent,
        WORKSPACE_POLICY_DELETE,
        `CREATE POLICY ${qTable(WORKSPACE_POLICY_DELETE)} ON ${tableIdent} FOR DELETE USING (${mutatePredicate})`
    )
}
