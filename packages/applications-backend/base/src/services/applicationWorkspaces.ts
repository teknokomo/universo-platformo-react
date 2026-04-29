import type { DbExecutor, SqlQueryable } from '@universo/utils'
import { qColumn, qSchema, qSchemaTable, qTable } from '@universo/database'
import { generateChildTableName, resolveEntityTableName, type EntityDefinition } from '@universo/schema-ddl'
import { ApplicationMembershipState, type VersionedLocalizedContent } from '@universo/types'

const WORKSPACES_TABLE = '_app_workspaces'
const WORKSPACE_ROLES_TABLE = '_app_workspace_roles'
const WORKSPACE_USER_ROLES_TABLE = '_app_workspace_user_roles'
const APP_SETTINGS_TABLE = '_app_settings'
const APP_LIMITS_TABLE = '_app_limits'
const WORKSPACE_POLICY_SELECT = 'workspace_select'
const WORKSPACE_POLICY_INSERT = 'workspace_insert'
const WORKSPACE_POLICY_UPDATE = 'workspace_update'
const WORKSPACE_POLICY_DELETE = 'workspace_delete'
const WORKSPACE_LIMIT_SCOPE_KIND = 'workspace'
const WORKSPACE_LIMIT_OBJECT_KIND = 'catalog'
const WORKSPACE_LIMIT_METRIC_KEY = 'rows'
const WORKSPACE_LIMIT_PERIOD_KEY = 'lifetime'
const WORKSPACE_SEED_TEMPLATE_KEY = 'workspace_seed_template'

const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'
const CURRENT_WORKSPACE_SETTING = `NULLIF(current_setting('app.current_workspace_id', true), '')`
const runtimeCodenameTextSql = (columnRef: string): string =>
    `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`

const createStaticVlc = (values: { en: string; ru: string }): VersionedLocalizedContent<string> => {
    const timestamp = new Date(0).toISOString()
    return {
        _schema: '1',
        _primary: 'en',
        locales: {
            en: {
                content: values.en,
                version: 1,
                isActive: true,
                createdAt: timestamp,
                updatedAt: timestamp
            },
            ru: {
                content: values.ru,
                version: 1,
                isActive: true,
                createdAt: timestamp,
                updatedAt: timestamp
            }
        }
    }
}

const MAIN_WORKSPACE_NAME = createStaticVlc({ en: 'Main', ru: 'Основное' })
const MAIN_WORKSPACE_DESCRIPTION = createStaticVlc({
    en: 'Personal workspace for the current user',
    ru: 'Личное рабочее пространство текущего пользователя'
})
const OWNER_ROLE_NAME = createStaticVlc({ en: 'Owner', ru: 'Владелец' })
const MEMBER_ROLE_NAME = createStaticVlc({ en: 'Member', ru: 'Участник' })

export interface RuntimeWorkspaceAccess {
    membershipState: ApplicationMembershipState
    defaultWorkspaceId: string | null
    allowedWorkspaceIds: string[]
}

type WorkspaceRoleRow = {
    id: string
    codename: string
}

type WorkspaceUserRoleRow = {
    workspaceId: string
    userId: string
    isDefaultWorkspace: boolean
}

type ApplicationMemberRow = {
    userId: string
}

type CatalogWorkspaceLimitRow = {
    objectId: string
    maxRows: number | null
}

type CatalogWorkspaceUsageRow = {
    total: number
}

type WorkspaceScopedTableRow = {
    tableName: string
}

type RuntimeWorkspaceSeedTemplate = {
    version: 1
    elements: Record<string, unknown[]>
}

type RuntimeCatalogSeedObjectRow = {
    objectId: string
    codename: string
    tableName: string
}

type RuntimeCatalogSeedAttributeRow = {
    objectId: string
    attributeId: string
    parentAttributeId: string | null
    codename: string
    columnName: string
    dataType: string
    uiConfig: Record<string, unknown> | null
    targetObjectId: string | null
    targetObjectKind: string | null
}

type RuntimeColumnDefinitionRow = {
    tableName: string
    columnName: string
    udtName: string
}

type WorkspaceSeedExistingRow = {
    id: string
    seedSourceKey: string
}

type WorkspaceSeedElementRow = {
    id?: unknown
    data?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const resolveWorkspaceSeedStandardKind = (kind: string | null | undefined): 'catalog' | 'hub' | 'set' | 'enumeration' | null => {
    if (kind === 'catalog' || kind === 'hub' || kind === 'set' || kind === 'enumeration') {
        return kind
    }

    return null
}

const isWorkspaceSeedCatalogLikeTargetKind = (kind: string | null | undefined): boolean =>
    typeof kind === 'string' && !['hub', 'set', 'enumeration'].includes(resolveWorkspaceSeedStandardKind(kind) ?? '')

const normalizeReferenceId = (value: unknown): string | null => {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length > 0 ? trimmed : null
    }

    if (!isRecord(value)) {
        return null
    }

    const directId = value.id
    if (typeof directId === 'string' && directId.trim().length > 0) {
        return directId.trim()
    }

    const nestedValue = value.value
    if (typeof nestedValue === 'string' && nestedValue.trim().length > 0) {
        return nestedValue.trim()
    }

    if (isRecord(nestedValue) && typeof nestedValue.id === 'string' && nestedValue.id.trim().length > 0) {
        return nestedValue.id.trim()
    }

    return null
}

const buildChildSeedSourceKey = (parentSeedSourceKey: string, tableAttributeId: string, index: number): string =>
    `${parentSeedSourceKey}:${tableAttributeId}:${index}`

const normalizeWorkspaceSeedCodename = (value: string): string => value.trim().toLowerCase()

const getCaseInsensitiveRecordValue = (record: Record<string, unknown>, key: string): unknown => {
    const normalizedKey = normalizeWorkspaceSeedCodename(key)

    for (const [entryKey, entryValue] of Object.entries(record)) {
        if (normalizeWorkspaceSeedCodename(entryKey) === normalizedKey) {
            return entryValue
        }
    }

    return undefined
}

const resolveWorkspaceSeedStringReferenceTargetObjectId = (input: {
    attribute: RuntimeCatalogSeedAttributeRow
    rowData: Record<string, unknown>
    objectIdByCodename: Map<string, string>
}): string | null => {
    if (input.attribute.dataType !== 'STRING') {
        return null
    }

    const quizzesObjectId = input.objectIdByCodename.get('quizzes')
    const modulesObjectId = input.objectIdByCodename.get('modules')
    if (
        normalizeWorkspaceSeedCodename(input.attribute.codename) === 'quizid' &&
        quizzesObjectId &&
        modulesObjectId &&
        input.attribute.objectId === modulesObjectId
    ) {
        return quizzesObjectId
    }

    if (normalizeWorkspaceSeedCodename(input.attribute.codename) !== 'targetid') {
        return null
    }

    const accessLinksObjectId = input.objectIdByCodename.get('accesslinks')
    if (!accessLinksObjectId || input.attribute.objectId !== accessLinksObjectId) {
        return null
    }

    const targetTypeValue = getCaseInsensitiveRecordValue(input.rowData, 'TargetType')
    if (typeof targetTypeValue !== 'string') {
        return null
    }

    const targetObjectCodenameByType: Record<string, string> = {
        module: 'modules',
        quiz: 'quizzes'
    }
    const targetObjectCodename = targetObjectCodenameByType[normalizeWorkspaceSeedCodename(targetTypeValue)]
    if (!targetObjectCodename) {
        return null
    }

    return input.objectIdByCodename.get(targetObjectCodename) ?? null
}

const buildWorkspaceContract = (workspacesEnabled: boolean): Record<string, unknown> => ({
    workspaceContract: {
        enabled: workspacesEnabled,
        version: 1
    }
})

export const withWorkspaceContract = (
    schemaSnapshot: Record<string, unknown> | null | undefined,
    workspacesEnabled: boolean
): Record<string, unknown> | null => {
    if (!schemaSnapshot) {
        return schemaSnapshot ?? null
    }

    return {
        ...schemaSnapshot,
        ...buildWorkspaceContract(workspacesEnabled)
    }
}

export async function runtimeWorkspaceTablesExist(executor: SqlQueryable, schemaName: string): Promise<boolean> {
    const [{ exists }] = await executor.query<{ exists: boolean }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_name = $2
        ) AS exists
        `,
        [schemaName, WORKSPACES_TABLE]
    )

    return exists === true
}

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

async function ensureWorkspaceSupportTables(executor: DbExecutor, schemaName: string): Promise<void> {
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

    const workspacesQt = qSchemaTable(schemaName, WORKSPACES_TABLE)
    const workspaceRolesQt = qSchemaTable(schemaName, WORKSPACE_ROLES_TABLE)
    const workspaceUserRolesQt = qSchemaTable(schemaName, WORKSPACE_USER_ROLES_TABLE)
    const appLimitsQt = qSchemaTable(schemaName, APP_LIMITS_TABLE)

    await executor.query(
        `
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

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${WORKSPACE_USER_ROLES_TABLE}_default_active_uidx`)}
        ON ${workspaceUserRolesQt}(user_id)
        WHERE is_default_workspace = true AND _upl_deleted = false AND _app_deleted = false;

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${WORKSPACE_USER_ROLES_TABLE}_membership_active_uidx`)}
        ON ${workspaceUserRolesQt}(workspace_id, user_id)
        WHERE _upl_deleted = false AND _app_deleted = false;

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${APP_LIMITS_TABLE}_workspace_catalog_global_active_uidx`)}
        ON ${appLimitsQt}(scope_kind, object_kind, object_id, metric_key, period_key)
        WHERE scope_id IS NULL AND _upl_deleted = false AND _app_deleted = false;

        CREATE UNIQUE INDEX IF NOT EXISTS ${qTable(`${APP_LIMITS_TABLE}_workspace_catalog_scoped_active_uidx`)}
        ON ${appLimitsQt}(scope_kind, scope_id, object_kind, object_id, metric_key, period_key)
        WHERE scope_id IS NOT NULL AND _upl_deleted = false AND _app_deleted = false;

        CREATE INDEX IF NOT EXISTS ${qTable(`${WORKSPACE_USER_ROLES_TABLE}_user_idx`)}
        ON ${workspaceUserRolesQt}(user_id);

        CREATE INDEX IF NOT EXISTS ${qTable(`${APP_LIMITS_TABLE}_object_idx`)}
        ON ${appLimitsQt}(object_id);
        `
    )
}

async function ensureWorkspaceScopedColumn(executor: DbExecutor, schemaName: string, tableName: string): Promise<void> {
    const qt = qSchemaTable(schemaName, tableName)
    const workspacesQt = qSchemaTable(schemaName, WORKSPACES_TABLE)
    const workspaceColumn = qWorkspaceColumn()
    const seedSourceColumn = qColumn('_seed_source_key')
    const workspaceConstraintName = qTable(`${tableName}_workspace_id_fk`)
    await executor.query(
        `
        ALTER TABLE ${qt}
        ADD COLUMN IF NOT EXISTS ${workspaceColumn} UUID NULL;

        ALTER TABLE ${qt}
        ADD COLUMN IF NOT EXISTS ${seedSourceColumn} TEXT NULL;

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

async function recreateWorkspacePolicy(executor: DbExecutor, tableIdent: string, policyName: string, sql: string): Promise<void> {
    await executor.query(`DROP POLICY IF EXISTS ${qTable(policyName)} ON ${tableIdent}`)
    await executor.query(sql)
}

async function ensureWorkspaceScopedPolicies(executor: DbExecutor, schemaName: string, tableName: string): Promise<void> {
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

export async function ensureApplicationRuntimeWorkspaceSchema(
    executor: DbExecutor,
    input: {
        schemaName: string
        applicationId: string
        entities: EntityDefinition[]
        actorUserId?: string | null
    }
): Promise<void> {
    await ensureWorkspaceSupportTables(executor, input.schemaName)
    await ensureWorkspaceRoleSeeds(executor, input.schemaName, input.actorUserId)

    const scopedTableNames = new Set<string>()
    for (const entity of input.entities) {
        if (entity.kind === 'hub' || entity.kind === 'set' || entity.kind === 'enumeration') {
            continue
        }

        scopedTableNames.add(resolveEntityTableName(entity))
        for (const field of entity.fields) {
            if (field.dataType === 'TABLE') {
                scopedTableNames.add(generateChildTableName(field.id))
            }
        }
    }

    for (const tableName of scopedTableNames) {
        await ensureWorkspaceScopedColumn(executor, input.schemaName, tableName)
        await ensureWorkspaceScopedPolicies(executor, input.schemaName, tableName)
    }

    await ensurePersonalWorkspacesForApplicationMembers(executor, {
        schemaName: input.schemaName,
        applicationId: input.applicationId,
        actorUserId: input.actorUserId
    })
}

async function ensureWorkspaceRole(
    executor: DbExecutor,
    schemaName: string,
    input: { codename: 'owner' | 'member'; name: VersionedLocalizedContent<string>; actorUserId?: string | null }
): Promise<string> {
    const qt = qSchemaTable(schemaName, WORKSPACE_ROLES_TABLE)
    const existingRows = await executor.query<WorkspaceRoleRow>(
        `
        SELECT id, codename
        FROM ${qt}
        WHERE codename = $1
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        `,
        [input.codename]
    )

    if (existingRows[0]) {
        return existingRows[0].id
    }

    const [{ id }] = await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
    await executor.query(
        `
        INSERT INTO ${qt} (
            id,
            codename,
            name,
            _upl_created_by,
            _upl_updated_by
        )
        VALUES ($1, $2, $3::jsonb, $4, $5)
        `,
        [id, input.codename, JSON.stringify(input.name), input.actorUserId ?? null, input.actorUserId ?? null]
    )

    return id
}

export async function ensureWorkspaceRoleSeeds(
    executor: DbExecutor,
    schemaName: string,
    actorUserId?: string | null
): Promise<{ ownerRoleId: string; memberRoleId: string }> {
    const ownerRoleId = await ensureWorkspaceRole(executor, schemaName, {
        codename: 'owner',
        name: OWNER_ROLE_NAME,
        actorUserId
    })
    const memberRoleId = await ensureWorkspaceRole(executor, schemaName, {
        codename: 'member',
        name: MEMBER_ROLE_NAME,
        actorUserId
    })

    return { ownerRoleId, memberRoleId }
}

export async function persistWorkspaceSeedTemplate(
    executor: DbExecutor,
    input: {
        schemaName: string
        elements?: Record<string, unknown[]> | null
        actorUserId?: string | null
    }
): Promise<void> {
    const settingsQt = qSchemaTable(input.schemaName, APP_SETTINGS_TABLE)
    const template: RuntimeWorkspaceSeedTemplate = {
        version: 1,
        elements: input.elements ?? {}
    }

    const existingRows = await executor.query<{ id: string }>(
        `
        SELECT id
        FROM ${settingsQt}
        WHERE key = $1
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        `,
        [WORKSPACE_SEED_TEMPLATE_KEY]
    )

    if (existingRows[0]) {
        await executor.query(
            `
            UPDATE ${settingsQt}
            SET value = $2::jsonb,
                _upl_updated_at = NOW(),
                _upl_updated_by = $3,
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1
            `,
            [existingRows[0].id, JSON.stringify(template), input.actorUserId ?? null]
        )
        return
    }

    const [{ id }] = await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
    await executor.query(
        `
        INSERT INTO ${settingsQt} (
            id,
            key,
            value,
            _upl_created_by,
            _upl_updated_by
        )
        VALUES ($1, $2, $3::jsonb, $4, $5)
        `,
        [id, WORKSPACE_SEED_TEMPLATE_KEY, JSON.stringify(template), input.actorUserId ?? null, input.actorUserId ?? null]
    )
}

async function loadWorkspaceSeedTemplate(executor: SqlQueryable, schemaName: string): Promise<RuntimeWorkspaceSeedTemplate | null> {
    const settingsQt = qSchemaTable(schemaName, APP_SETTINGS_TABLE)
    const rows = await executor.query<{ value: unknown }>(
        `
        SELECT value
        FROM ${settingsQt}
        WHERE key = $1
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        `,
        [WORKSPACE_SEED_TEMPLATE_KEY]
    )

    const value = rows[0]?.value
    if (!isRecord(value) || value.version !== 1 || !isRecord(value.elements)) {
        return null
    }

    return {
        version: 1,
        elements: value.elements as Record<string, unknown[]>
    }
}

async function listActiveWorkspaceIds(executor: SqlQueryable, schemaName: string): Promise<string[]> {
    const workspacesQt = qSchemaTable(schemaName, WORKSPACES_TABLE)
    const rows = await executor.query<{ id: string }>(
        `
        SELECT id
        FROM ${workspacesQt}
        WHERE ${ACTIVE_ROW_SQL}
          AND COALESCE(status, 'active') = 'active'
        ORDER BY _upl_created_at ASC, id ASC
        `
    )

    return rows.map((row) => row.id)
}

const normalizeWorkspaceSeedValue = (value: unknown, attribute: RuntimeCatalogSeedAttributeRow, columnType: string): unknown => {
    if (value === undefined || value === null) {
        return null
    }

    if (attribute.dataType === 'REF') {
        return normalizeReferenceId(value)
    }

    if (columnType === 'jsonb') {
        return JSON.stringify(value)
    }

    return value
}

const resolveWorkspaceSeedStringDependencyObjectIds = (
    attribute: RuntimeCatalogSeedAttributeRow,
    objectIdByCodename: Map<string, string>
): string[] => {
    if (normalizeWorkspaceSeedCodename(attribute.codename) !== 'targetid') {
        const quizzesObjectId = objectIdByCodename.get('quizzes')
        const modulesObjectId = objectIdByCodename.get('modules')
        if (
            normalizeWorkspaceSeedCodename(attribute.codename) === 'quizid' &&
            quizzesObjectId &&
            modulesObjectId &&
            attribute.objectId === modulesObjectId
        ) {
            return [quizzesObjectId]
        }

        return []
    }

    const accessLinksObjectId = objectIdByCodename.get('accesslinks')
    if (!accessLinksObjectId || attribute.objectId !== accessLinksObjectId) {
        return []
    }

    return ['modules', 'quizzes']
        .map((codename) => objectIdByCodename.get(codename) ?? null)
        .filter((objectId): objectId is string => typeof objectId === 'string' && objectId.length > 0)
}

const resolveWorkspaceSeedObjectOrder = (
    objects: RuntimeCatalogSeedObjectRow[],
    attributes: RuntimeCatalogSeedAttributeRow[]
): RuntimeCatalogSeedObjectRow[] => {
    const objectIds = new Set(objects.map((object) => object.objectId))
    const objectIdByCodename = new Map(
        objects
            .filter((object) => typeof object.codename === 'string' && object.codename.trim().length > 0)
            .map((object) => [normalizeWorkspaceSeedCodename(object.codename), object.objectId])
    )
    const dependenciesByObjectId = new Map<string, Set<string>>()

    for (const object of objects) {
        dependenciesByObjectId.set(object.objectId, new Set())
    }

    for (const attribute of attributes) {
        if (
            attribute.parentAttributeId === null &&
            attribute.dataType === 'REF' &&
            isWorkspaceSeedCatalogLikeTargetKind(attribute.targetObjectKind) &&
            typeof attribute.targetObjectId === 'string' &&
            objectIds.has(attribute.targetObjectId) &&
            attribute.targetObjectId !== attribute.objectId
        ) {
            dependenciesByObjectId.get(attribute.objectId)?.add(attribute.targetObjectId)
        }

        for (const dependencyObjectId of resolveWorkspaceSeedStringDependencyObjectIds(attribute, objectIdByCodename)) {
            if (!objectIds.has(dependencyObjectId) || dependencyObjectId === attribute.objectId) {
                continue
            }

            dependenciesByObjectId.get(attribute.objectId)?.add(dependencyObjectId)
        }
    }

    const ordered: RuntimeCatalogSeedObjectRow[] = []
    const resolved = new Set<string>()

    while (ordered.length < objects.length) {
        let progressed = false

        for (const object of objects) {
            if (resolved.has(object.objectId)) {
                continue
            }

            const unresolvedDependencies = Array.from(dependenciesByObjectId.get(object.objectId) ?? []).filter(
                (dependencyId) => !resolved.has(dependencyId)
            )
            if (unresolvedDependencies.length > 0) {
                continue
            }

            ordered.push(object)
            resolved.add(object.objectId)
            progressed = true
        }

        if (!progressed) {
            for (const object of objects) {
                if (!resolved.has(object.objectId)) {
                    ordered.push(object)
                    resolved.add(object.objectId)
                }
            }
        }
    }

    return ordered
}

const normalizeWorkspaceSeedValueWithReferences = (
    value: unknown,
    attribute: RuntimeCatalogSeedAttributeRow,
    columnType: string,
    seedRowIdByObjectAndSourceKey: Map<string, Map<string, string>>,
    rowData: Record<string, unknown>,
    objectIdByCodename: Map<string, string>
): unknown => {
    if (value === undefined || value === null) {
        return null
    }

    if (
        attribute.dataType === 'REF' &&
        isWorkspaceSeedCatalogLikeTargetKind(attribute.targetObjectKind) &&
        typeof attribute.targetObjectId === 'string'
    ) {
        const seedSourceKey = normalizeReferenceId(value)
        if (!seedSourceKey) {
            return null
        }

        const targetRowId = seedRowIdByObjectAndSourceKey.get(attribute.targetObjectId)?.get(seedSourceKey)
        if (!targetRowId) {
            throw new Error(
                `Failed to resolve workspace seed reference for ${attribute.objectId}.${attribute.codename} -> ${attribute.targetObjectId} (${seedSourceKey})`
            )
        }

        return targetRowId
    }

    const publicRuntimeTargetObjectId = resolveWorkspaceSeedStringReferenceTargetObjectId({
        attribute,
        rowData,
        objectIdByCodename
    })
    if (publicRuntimeTargetObjectId) {
        const seedSourceKey = normalizeReferenceId(value)
        if (!seedSourceKey) {
            return null
        }

        const targetRowId = seedRowIdByObjectAndSourceKey.get(publicRuntimeTargetObjectId)?.get(seedSourceKey)
        if (!targetRowId) {
            throw new Error(
                `Failed to resolve workspace seed runtime target for ${attribute.objectId}.${attribute.codename} -> ${publicRuntimeTargetObjectId} (${seedSourceKey})`
            )
        }

        return targetRowId
    }

    return normalizeWorkspaceSeedValue(value, attribute, columnType)
}

async function softDeleteWorkspaceSeedRowsByIds(
    executor: DbExecutor,
    input: {
        schemaName: string
        tableName: string
        rowIds: string[]
        actorUserId?: string | null
    }
): Promise<void> {
    if (input.rowIds.length === 0) {
        return
    }

    const tableQt = qSchemaTable(input.schemaName, input.tableName)
    await executor.query(
        `
        UPDATE ${tableQt}
        SET _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $2,
            _upl_updated_at = NOW(),
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1,
            _app_deleted = true,
            _app_deleted_at = NOW(),
            _app_deleted_by = $2
        WHERE id = ANY($1::uuid[])
          AND ${ACTIVE_ROW_SQL}
        `,
        [input.rowIds, input.actorUserId ?? null]
    )
}

async function loadRuntimeCatalogSeedMetadata(
    executor: SqlQueryable,
    schemaName: string
): Promise<{
    objects: RuntimeCatalogSeedObjectRow[]
    attributes: RuntimeCatalogSeedAttributeRow[]
    columnTypes: Map<string, string>
    objectIdByCodename: Map<string, string>
}> {
    const objectsQt = qSchemaTable(schemaName, '_app_objects')
    const attributesQt = qSchemaTable(schemaName, '_app_attributes')

    const [objects, attributes, columns] = await Promise.all([
        executor.query<RuntimeCatalogSeedObjectRow>(
            `
                        SELECT id AS "objectId", ${runtimeCodenameTextSql('codename')} AS codename, table_name AS "tableName"
            FROM ${objectsQt}
                        WHERE COALESCE(kind, '') NOT IN ('hub', 'set', 'enumeration')
              AND ${ACTIVE_ROW_SQL}
            ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
            `
        ),
        executor.query<RuntimeCatalogSeedAttributeRow>(
            `
            SELECT
                object_id AS "objectId",
                id AS "attributeId",
                parent_attribute_id AS "parentAttributeId",
                ${runtimeCodenameTextSql('codename')} AS codename,
                column_name AS "columnName",
                data_type AS "dataType",
                ui_config AS "uiConfig",
                target_object_id AS "targetObjectId",
                target_object_kind AS "targetObjectKind"
            FROM ${attributesQt}
            WHERE ${ACTIVE_ROW_SQL}
            ORDER BY sort_order ASC, _upl_created_at ASC, id ASC
            `
        ),
        executor.query<RuntimeColumnDefinitionRow>(
            `
            SELECT
                table_name AS "tableName",
                column_name AS "columnName",
                udt_name AS "udtName"
            FROM information_schema.columns
            WHERE table_schema = $1
              AND (table_name LIKE 'cat\\_%' ESCAPE '\\' OR table_name LIKE 'tbl\\_%' ESCAPE '\\')
            `,
            [schemaName]
        )
    ])

    const columnTypes = new Map<string, string>()
    for (const column of columns) {
        columnTypes.set(`${column.tableName}.${column.columnName}`, column.udtName)
    }

    const objectIdByCodename = new Map<string, string>()
    for (const object of objects) {
        if (typeof object.codename === 'string' && object.codename.trim().length > 0) {
            objectIdByCodename.set(normalizeWorkspaceSeedCodename(object.codename), object.objectId)
        }
    }

    return { objects, attributes, columnTypes, objectIdByCodename }
}

async function upsertWorkspaceSeedRow(
    executor: DbExecutor,
    input: {
        schemaName: string
        tableName: string
        rowId?: string | null
        workspaceId: string
        seedSourceKey: string
        values: Array<{ columnName: string; value: unknown; columnType: string }>
        actorUserId?: string | null
        parentRowId?: string | null
        sortOrder?: number | null
    }
): Promise<string> {
    const tableQt = qSchemaTable(input.schemaName, input.tableName)
    const existingId = input.rowId ?? null
    const rowId = existingId ?? (await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id'))[0]?.id ?? null

    if (!rowId) {
        throw new Error(`Failed to allocate runtime seed row id for ${input.tableName}`)
    }

    const assignments: string[] = []
    const columns: string[] = [qColumn('id'), qWorkspaceColumn(), qColumn('_seed_source_key')]
    const placeholders: string[] = ['$1', '$2', '$3']
    const parameters: unknown[] = [rowId, input.workspaceId, input.seedSourceKey]
    let parentPlaceholder: string | null = null
    let sortOrderPlaceholder: string | null = null

    if (input.parentRowId) {
        columns.push(qColumn('_tp_parent_id'))
        parameters.push(input.parentRowId)
        parentPlaceholder = `$${parameters.length}`
        placeholders.push(parentPlaceholder)
    }

    if (input.sortOrder !== null && input.sortOrder !== undefined) {
        columns.push(qColumn('_tp_sort_order'))
        parameters.push(input.sortOrder)
        sortOrderPlaceholder = `$${parameters.length}`
        placeholders.push(sortOrderPlaceholder)
    }

    for (const value of input.values) {
        columns.push(qColumn(value.columnName))
        parameters.push(value.value)
        placeholders.push(value.columnType === 'jsonb' ? `$${parameters.length}::jsonb` : `$${parameters.length}`)
        assignments.push(
            `${qColumn(value.columnName)} = ${value.columnType === 'jsonb' ? `$${parameters.length}::jsonb` : `$${parameters.length}`}`
        )
    }

    if (existingId) {
        parameters.push(input.actorUserId ?? null)
        const updateAssignments = [
            `${qWorkspaceColumn()} = $2`,
            `${qColumn('_seed_source_key')} = $3`,
            ...(parentPlaceholder ? [`${qColumn('_tp_parent_id')} = ${parentPlaceholder}`] : []),
            ...(sortOrderPlaceholder ? [`${qColumn('_tp_sort_order')} = ${sortOrderPlaceholder}`] : []),
            ...assignments,
            '_upl_deleted = false',
            '_upl_deleted_at = NULL',
            '_upl_deleted_by = NULL',
            '_upl_updated_at = NOW()',
            `_upl_updated_by = $${parameters.length}`,
            '_upl_version = COALESCE(_upl_version, 1) + 1',
            '_app_deleted = false',
            '_app_deleted_at = NULL',
            '_app_deleted_by = NULL'
        ]
        await executor.query(
            `
            UPDATE ${tableQt}
            SET ${updateAssignments.join(',\n                ')}
            WHERE id = $1
            `,
            parameters
        )

        return rowId
    }

    parameters.push(input.actorUserId ?? null, input.actorUserId ?? null)
    columns.push(qColumn('_upl_created_by'), qColumn('_upl_updated_by'))
    placeholders.push(`$${parameters.length - 1}`, `$${parameters.length}`)

    await executor.query(
        `
        INSERT INTO ${tableQt} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        `,
        parameters
    )

    return rowId
}

async function syncWorkspaceSeededChildRows(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        parentRowId: string
        parentSeedSourceKey: string
        tableAttribute: RuntimeCatalogSeedAttributeRow
        childAttributes: RuntimeCatalogSeedAttributeRow[]
        childRows: unknown[]
        columnTypes: Map<string, string>
        seedRowIdByObjectAndSourceKey: Map<string, Map<string, string>>
        objectIdByCodename: Map<string, string>
        actorUserId?: string | null
    }
): Promise<void> {
    const childTableName = generateChildTableName(input.tableAttribute.attributeId)
    const childTableQt = qSchemaTable(input.schemaName, childTableName)
    const existingRows = await executor.query<WorkspaceSeedExistingRow>(
        `
        SELECT id, _seed_source_key AS "seedSourceKey"
        FROM ${childTableQt}
        WHERE ${qWorkspaceColumn()} = $1
          AND _tp_parent_id = $2
          AND ${qColumn('_seed_source_key')} IS NOT NULL
          AND ${ACTIVE_ROW_SQL}
        `,
        [input.workspaceId, input.parentRowId]
    )

    const existingBySeedSourceKey = new Map(existingRows.map((row) => [row.seedSourceKey, row.id]))
    const desiredSeedSourceKeys = new Set<string>()

    for (const [index, rawChildRow] of input.childRows.entries()) {
        const rowData = isRecord(rawChildRow) ? rawChildRow : {}
        const seedSourceKey = buildChildSeedSourceKey(input.parentSeedSourceKey, input.tableAttribute.attributeId, index)
        desiredSeedSourceKeys.add(seedSourceKey)

        const values = input.childAttributes.map((attribute) => ({
            columnName: attribute.columnName,
            value: normalizeWorkspaceSeedValueWithReferences(
                rowData[attribute.codename],
                attribute,
                input.columnTypes.get(`${childTableName}.${attribute.columnName}`) ?? 'text',
                input.seedRowIdByObjectAndSourceKey,
                rowData,
                input.objectIdByCodename
            ),
            columnType: input.columnTypes.get(`${childTableName}.${attribute.columnName}`) ?? 'text'
        }))

        await upsertWorkspaceSeedRow(executor, {
            schemaName: input.schemaName,
            tableName: childTableName,
            rowId: existingBySeedSourceKey.get(seedSourceKey) ?? null,
            workspaceId: input.workspaceId,
            seedSourceKey,
            values,
            actorUserId: input.actorUserId,
            parentRowId: input.parentRowId,
            sortOrder: typeof rowData._tp_sort_order === 'number' ? rowData._tp_sort_order : index
        })
    }

    const staleRowIds = existingRows.filter((row) => !desiredSeedSourceKeys.has(row.seedSourceKey)).map((row) => row.id)

    await softDeleteWorkspaceSeedRowsByIds(executor, {
        schemaName: input.schemaName,
        tableName: childTableName,
        rowIds: staleRowIds,
        actorUserId: input.actorUserId
    })
}

export async function syncWorkspaceSeededElements(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        actorUserId?: string | null
    }
): Promise<void> {
    const template = await loadWorkspaceSeedTemplate(executor, input.schemaName)
    const { objects, attributes, columnTypes, objectIdByCodename } = await loadRuntimeCatalogSeedMetadata(executor, input.schemaName)
    const seedRowIdByObjectAndSourceKey = new Map<string, Map<string, string>>()

    for (const object of resolveWorkspaceSeedObjectOrder(objects, attributes)) {
        const topLevelAttributes = attributes.filter(
            (attribute) => attribute.objectId === object.objectId && attribute.parentAttributeId === null && attribute.dataType !== 'TABLE'
        )
        const tableAttributes = attributes.filter(
            (attribute) => attribute.objectId === object.objectId && attribute.parentAttributeId === null && attribute.dataType === 'TABLE'
        )
        const entityRows = Array.isArray(template?.elements?.[object.objectId]) ? (template?.elements?.[object.objectId] as unknown[]) : []
        const desiredSeedSourceKeys = new Set<string>()
        const tableQt = qSchemaTable(input.schemaName, object.tableName)
        const existingRows = await executor.query<WorkspaceSeedExistingRow>(
            `
            SELECT id, _seed_source_key AS "seedSourceKey"
            FROM ${tableQt}
            WHERE ${qWorkspaceColumn()} = $1
              AND ${qColumn('_seed_source_key')} IS NOT NULL
              AND ${ACTIVE_ROW_SQL}
            `,
            [input.workspaceId]
        )
        const existingBySeedSourceKey = new Map(existingRows.map((row) => [row.seedSourceKey, row.id]))

        for (const rawElement of entityRows) {
            const element = (rawElement ?? {}) as WorkspaceSeedElementRow
            const seedSourceKey = typeof element.id === 'string' ? element.id : null
            if (!seedSourceKey) {
                continue
            }

            desiredSeedSourceKeys.add(seedSourceKey)
            const rowData = isRecord(element.data) ? element.data : {}
            const values = topLevelAttributes.map((attribute) => ({
                columnName: attribute.columnName,
                value: normalizeWorkspaceSeedValueWithReferences(
                    rowData[attribute.codename],
                    attribute,
                    columnTypes.get(`${object.tableName}.${attribute.columnName}`) ?? 'text',
                    seedRowIdByObjectAndSourceKey,
                    rowData,
                    objectIdByCodename
                ),
                columnType: columnTypes.get(`${object.tableName}.${attribute.columnName}`) ?? 'text'
            }))

            const rowId = await upsertWorkspaceSeedRow(executor, {
                schemaName: input.schemaName,
                tableName: object.tableName,
                rowId: existingBySeedSourceKey.get(seedSourceKey) ?? null,
                workspaceId: input.workspaceId,
                seedSourceKey,
                values,
                actorUserId: input.actorUserId
            })
            const objectSeedRows = seedRowIdByObjectAndSourceKey.get(object.objectId) ?? new Map<string, string>()
            objectSeedRows.set(seedSourceKey, rowId)
            seedRowIdByObjectAndSourceKey.set(object.objectId, objectSeedRows)

            for (const tableAttribute of tableAttributes) {
                const childRows = Array.isArray(rowData[tableAttribute.codename]) ? (rowData[tableAttribute.codename] as unknown[]) : []
                const childAttributes = attributes.filter((attribute) => attribute.parentAttributeId === tableAttribute.attributeId)
                await syncWorkspaceSeededChildRows(executor, {
                    schemaName: input.schemaName,
                    workspaceId: input.workspaceId,
                    parentRowId: rowId,
                    parentSeedSourceKey: seedSourceKey,
                    tableAttribute,
                    childAttributes,
                    childRows,
                    columnTypes,
                    seedRowIdByObjectAndSourceKey,
                    objectIdByCodename,
                    actorUserId: input.actorUserId
                })
            }
        }

        const staleRows = existingRows.filter((row) => !desiredSeedSourceKeys.has(row.seedSourceKey))
        const staleRowIds = staleRows.map((row) => row.id)
        for (const tableAttribute of tableAttributes) {
            const childTableName = generateChildTableName(tableAttribute.attributeId)
            await executor.query(
                `
                UPDATE ${qSchemaTable(input.schemaName, childTableName)}
                SET _upl_deleted = true,
                    _upl_deleted_at = NOW(),
                    _upl_deleted_by = $2,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $2,
                    _upl_version = COALESCE(_upl_version, 1) + 1,
                    _app_deleted = true,
                    _app_deleted_at = NOW(),
                    _app_deleted_by = $2
                WHERE _tp_parent_id = ANY($1::uuid[])
                  AND ${ACTIVE_ROW_SQL}
                `,
                [staleRowIds, input.actorUserId ?? null]
            )
        }

        await softDeleteWorkspaceSeedRowsByIds(executor, {
            schemaName: input.schemaName,
            tableName: object.tableName,
            rowIds: staleRowIds,
            actorUserId: input.actorUserId
        })
    }
}

export async function syncWorkspaceSeededElementsForAllActiveWorkspaces(
    executor: DbExecutor,
    input: {
        schemaName: string
        actorUserId?: string | null
    }
): Promise<void> {
    const workspaceIds = await listActiveWorkspaceIds(executor, input.schemaName)
    for (const workspaceId of workspaceIds) {
        await syncWorkspaceSeededElements(executor, {
            schemaName: input.schemaName,
            workspaceId,
            actorUserId: input.actorUserId
        })
    }
}

export async function ensurePersonalWorkspaceForUser(
    executor: DbExecutor,
    input: {
        schemaName: string
        userId: string
        actorUserId?: string | null
        defaultRoleCodename?: 'owner' | 'member'
    }
): Promise<{ workspaceId: string }> {
    const { schemaName, userId, actorUserId } = input
    const desiredRoleCodename = input.defaultRoleCodename ?? 'owner'
    const workspacesQt = qSchemaTable(schemaName, WORKSPACES_TABLE)
    const workspaceUserRolesQt = qSchemaTable(schemaName, WORKSPACE_USER_ROLES_TABLE)

    const existingWorkspaceRows = await executor.query<{ id: string }>(
        `
        SELECT id
        FROM ${workspacesQt}
        WHERE workspace_type = 'personal'
          AND personal_user_id = $1
          AND ${ACTIVE_ROW_SQL}
        ORDER BY _upl_created_at ASC, id ASC
        LIMIT 1
        `,
        [userId]
    )

    const workspaceId =
        existingWorkspaceRows[0]?.id ?? (await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id'))[0].id
    const createdWorkspace = !existingWorkspaceRows[0]

    if (createdWorkspace) {
        await executor.query(
            `
            INSERT INTO ${workspacesQt} (
                id,
                name,
                description,
                workspace_type,
                personal_user_id,
                status,
                _upl_created_by,
                _upl_updated_by
            )
            VALUES ($1, $2::jsonb, $3::jsonb, 'personal', $4, 'active', $5, $6)
            `,
            [
                workspaceId,
                JSON.stringify(MAIN_WORKSPACE_NAME),
                JSON.stringify(MAIN_WORKSPACE_DESCRIPTION),
                userId,
                actorUserId ?? null,
                actorUserId ?? null
            ]
        )
    }

    const seededRoles = await ensureWorkspaceRoleSeeds(executor, schemaName, actorUserId)
    const desiredRoleId = desiredRoleCodename === 'member' ? seededRoles.memberRoleId : seededRoles.ownerRoleId

    const existingUserRoleRows = await executor.query<WorkspaceUserRoleRow>(
        `
        SELECT
            workspace_id AS "workspaceId",
            user_id AS "userId",
            is_default_workspace AS "isDefaultWorkspace"
        FROM ${workspaceUserRolesQt}
        WHERE workspace_id = $1
          AND user_id = $2
          AND ${ACTIVE_ROW_SQL}
        `,
        [workspaceId, userId]
    )

    if (existingUserRoleRows.length === 0) {
        const [{ id: relationId }] = await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
        await executor.query(
            `
            UPDATE ${workspaceUserRolesQt}
            SET is_default_workspace = false,
                _upl_updated_at = NOW(),
                _upl_updated_by = $2
            WHERE user_id = $1
              AND is_default_workspace = true
              AND ${ACTIVE_ROW_SQL}
            `,
            [userId, actorUserId ?? null]
        )

        await executor.query(
            `
            INSERT INTO ${workspaceUserRolesQt} (
                id,
                workspace_id,
                user_id,
                role_id,
                is_default_workspace,
                _upl_created_by,
                _upl_updated_by
            )
            VALUES ($1, $2, $3, $4, true, $5, $6)
            `,
            [relationId, workspaceId, userId, desiredRoleId, actorUserId ?? null, actorUserId ?? null]
        )
    } else if (!existingUserRoleRows.some((row) => row.isDefaultWorkspace === true)) {
        const userDefaultWorkspaceRows = await executor.query<{ workspaceId: string }>(
            `
            SELECT workspace_id AS "workspaceId"
            FROM ${workspaceUserRolesQt}
            WHERE user_id = $1
              AND is_default_workspace = true
              AND ${ACTIVE_ROW_SQL}
            LIMIT 1
            `,
            [userId]
        )

        if (userDefaultWorkspaceRows.length === 0) {
            await executor.query(
                `
                UPDATE ${workspaceUserRolesQt}
                SET is_default_workspace = false,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $2
                WHERE user_id = $1
                  AND is_default_workspace = true
                  AND ${ACTIVE_ROW_SQL}
                `,
                [userId, actorUserId ?? null]
            )

            await executor.query(
                `
                UPDATE ${workspaceUserRolesQt}
                SET is_default_workspace = true,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $3
                WHERE workspace_id = $1
                  AND user_id = $2
                  AND ${ACTIVE_ROW_SQL}
                `,
                [workspaceId, userId, actorUserId ?? null]
            )
        }
    }

    if (createdWorkspace) {
        await syncWorkspaceSeededElements(executor, {
            schemaName,
            workspaceId,
            actorUserId
        })
    }

    return { workspaceId }
}

export async function ensurePersonalWorkspacesForApplicationMembers(
    executor: DbExecutor,
    input: {
        schemaName: string
        applicationId: string
        actorUserId?: string | null
    }
): Promise<void> {
    const memberRows = await executor.query<ApplicationMemberRow>(
        `
        SELECT user_id AS "userId"
        FROM applications.rel_application_users
        WHERE application_id = $1
          AND ${ACTIVE_ROW_SQL}
        ORDER BY _upl_created_at ASC, id ASC
        `,
        [input.applicationId]
    )

    for (const member of memberRows) {
        await ensurePersonalWorkspaceForUser(executor, {
            schemaName: input.schemaName,
            userId: member.userId,
            actorUserId: input.actorUserId,
            defaultRoleCodename: 'owner'
        })
    }
}

export async function archivePersonalWorkspaceForUser(
    executor: DbExecutor,
    input: {
        schemaName: string
        userId: string
        actorUserId?: string | null
    }
): Promise<void> {
    const workspacesQt = qSchemaTable(input.schemaName, WORKSPACES_TABLE)
    const workspaceUserRolesQt = qSchemaTable(input.schemaName, WORKSPACE_USER_ROLES_TABLE)

    const workspaceRows = await executor.query<{ id: string }>(
        `
        SELECT id
        FROM ${workspacesQt}
        WHERE workspace_type = 'personal'
          AND personal_user_id = $1
          AND ${ACTIVE_ROW_SQL}
        `,
        [input.userId]
    )

    if (workspaceRows.length === 0) {
        return
    }

    const workspaceIds = workspaceRows.map((row) => row.id)
    await archiveWorkspaceScopedBusinessRows(executor, {
        schemaName: input.schemaName,
        workspaceIds,
        actorUserId: input.actorUserId
    })

    await executor.query(
        `
        UPDATE ${workspaceUserRolesQt}
        SET _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $2,
            _upl_updated_at = NOW(),
            _upl_updated_by = $2
        WHERE workspace_id = ANY($1::uuid[])
          AND ${ACTIVE_ROW_SQL}
        `,
        [workspaceIds, input.actorUserId ?? null]
    )

    await executor.query(
        `
        UPDATE ${workspacesQt}
        SET status = 'archived',
            _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $2,
            _upl_updated_at = NOW(),
            _upl_updated_by = $2
        WHERE id = ANY($1::uuid[])
          AND ${ACTIVE_ROW_SQL}
        `,
        [workspaceIds, input.actorUserId ?? null]
    )
}

export async function archiveWorkspaceScopedBusinessRows(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceIds: string[]
        actorUserId?: string | null
    }
): Promise<void> {
    if (input.workspaceIds.length === 0) {
        return
    }

    const scopedTables = await executor.query<WorkspaceScopedTableRow>(
        `
        SELECT table_name AS "tableName"
        FROM information_schema.columns
        WHERE table_schema = $1
          AND column_name = 'workspace_id'
          AND (table_name LIKE 'cat\\_%' ESCAPE '\\' OR table_name LIKE 'tbl\\_%' ESCAPE '\\')
        ORDER BY table_name ASC
        `,
        [input.schemaName]
    )

    for (const table of scopedTables) {
        const tableIdent = qSchemaTable(input.schemaName, table.tableName)
        await executor.query(
            `
            UPDATE ${tableIdent}
            SET _upl_deleted = true,
                _upl_deleted_at = NOW(),
                _upl_deleted_by = $2,
                _upl_updated_at = NOW(),
                _upl_updated_by = $2,
                _upl_version = COALESCE(_upl_version, 1) + 1,
                _app_deleted = true,
                _app_deleted_at = NOW(),
                _app_deleted_by = $2
            WHERE ${qWorkspaceColumn()} = ANY($1::uuid[])
              AND ${ACTIVE_ROW_SQL}
            `,
            [input.workspaceIds, input.actorUserId ?? null]
        )
    }
}

export async function resolveRuntimeWorkspaceAccess(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspacesEnabled: boolean
        userId: string
        actorUserId?: string | null
    }
): Promise<RuntimeWorkspaceAccess> {
    if (!input.workspacesEnabled) {
        return {
            membershipState: ApplicationMembershipState.JOINED,
            defaultWorkspaceId: null,
            allowedWorkspaceIds: []
        }
    }

    const tablesExist = await runtimeWorkspaceTablesExist(executor, input.schemaName)
    if (!tablesExist) {
        return {
            membershipState: ApplicationMembershipState.JOINED,
            defaultWorkspaceId: null,
            allowedWorkspaceIds: []
        }
    }

    await ensurePersonalWorkspaceForUser(executor, {
        schemaName: input.schemaName,
        userId: input.userId,
        actorUserId: input.actorUserId,
        defaultRoleCodename: 'owner'
    })

    const workspaceUserRolesQt = qSchemaTable(input.schemaName, WORKSPACE_USER_ROLES_TABLE)
    const workspaceQt = qSchemaTable(input.schemaName, WORKSPACES_TABLE)
    const rows = await executor.query<{ workspaceId: string; isDefaultWorkspace: boolean }>(
        `
        SELECT
            wur.workspace_id AS "workspaceId",
            wur.is_default_workspace AS "isDefaultWorkspace"
        FROM ${workspaceUserRolesQt} wur
        INNER JOIN ${workspaceQt} w ON w.id = wur.workspace_id
        WHERE wur.user_id = $1
          AND wur.${'"_upl_deleted"'} = false
          AND wur.${'"_app_deleted"'} = false
          AND w.${'"_upl_deleted"'} = false
          AND w.${'"_app_deleted"'} = false
          AND COALESCE(w.status, 'active') = 'active'
        ORDER BY wur.is_default_workspace DESC, wur._upl_created_at ASC, wur.id ASC
        `,
        [input.userId]
    )

    const uniqueWorkspaceIds = Array.from(new Set(rows.map((row) => row.workspaceId)))
    const defaultWorkspaceId = rows.find((row) => row.isDefaultWorkspace)?.workspaceId ?? uniqueWorkspaceIds[0] ?? null
    return {
        membershipState: ApplicationMembershipState.JOINED,
        defaultWorkspaceId,
        allowedWorkspaceIds: uniqueWorkspaceIds
    }
}

export async function setRuntimeWorkspaceContext(executor: DbExecutor, workspaceId: string | null): Promise<void> {
    await executor.query(`SELECT set_config('app.current_workspace_id', $1::text, true)`, [workspaceId ?? ''])
}

export async function getCatalogWorkspaceLimit(
    executor: SqlQueryable,
    input: {
        schemaName: string
        objectId: string
    }
): Promise<number | null> {
    const qt = qSchemaTable(input.schemaName, APP_LIMITS_TABLE)
    const rows = await executor.query<{ maxRows: number | null }>(
        `
        SELECT max_value::int AS "maxRows"
        FROM ${qt}
        WHERE object_id = $1
          AND scope_kind = $2
          AND scope_id IS NULL
          AND object_kind = $3
          AND metric_key = $4
          AND period_key = $5
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        `,
        [input.objectId, WORKSPACE_LIMIT_SCOPE_KIND, WORKSPACE_LIMIT_OBJECT_KIND, WORKSPACE_LIMIT_METRIC_KEY, WORKSPACE_LIMIT_PERIOD_KEY]
    )

    return rows[0]?.maxRows ?? null
}

export async function listCatalogWorkspaceLimits(
    executor: SqlQueryable,
    input: {
        schemaName: string
    }
): Promise<CatalogWorkspaceLimitRow[]> {
    const limitsQt = qSchemaTable(input.schemaName, APP_LIMITS_TABLE)
    const objectsQt = qSchemaTable(input.schemaName, '_app_objects')

    return executor.query<CatalogWorkspaceLimitRow>(
        `
        SELECT
            o.id AS "objectId",
            l.max_value::int AS "maxRows"
        FROM ${objectsQt} o
        LEFT JOIN ${limitsQt} l
          ON l.object_id = o.id
         AND l.scope_kind = '${WORKSPACE_LIMIT_SCOPE_KIND}'
         AND l.scope_id IS NULL
         AND l.object_kind = '${WORKSPACE_LIMIT_OBJECT_KIND}'
         AND l.metric_key = '${WORKSPACE_LIMIT_METRIC_KEY}'
         AND l.period_key = '${WORKSPACE_LIMIT_PERIOD_KEY}'
         AND l._upl_deleted = false
         AND l._app_deleted = false
        WHERE o.kind = 'catalog'
          AND o._upl_deleted = false
          AND o._app_deleted = false
        ORDER BY o.codename ASC
        `
    )
}

export async function upsertCatalogWorkspaceLimits(
    executor: DbExecutor,
    input: {
        schemaName: string
        actorUserId?: string | null
        limits: Array<{ objectId: string; maxRows: number | null }>
    }
): Promise<void> {
    const limitsQt = qSchemaTable(input.schemaName, APP_LIMITS_TABLE)

    for (const limit of input.limits) {
        if (limit.maxRows === null) {
            await executor.query(
                `
                UPDATE ${limitsQt}
                SET _upl_deleted = true,
                    _upl_deleted_at = NOW(),
                    _upl_deleted_by = $2,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $2
                WHERE object_id = $1
                  AND scope_kind = $3
                  AND scope_id IS NULL
                  AND object_kind = $4
                  AND metric_key = $5
                  AND period_key = $6
                  AND ${ACTIVE_ROW_SQL}
                `,
                [
                    limit.objectId,
                    input.actorUserId ?? null,
                    WORKSPACE_LIMIT_SCOPE_KIND,
                    WORKSPACE_LIMIT_OBJECT_KIND,
                    WORKSPACE_LIMIT_METRIC_KEY,
                    WORKSPACE_LIMIT_PERIOD_KEY
                ]
            )
            continue
        }

        const existingRows = await executor.query<{ id: string }>(
            `
            SELECT id
            FROM ${limitsQt}
            WHERE object_id = $1
              AND scope_kind = $2
              AND scope_id IS NULL
              AND object_kind = $3
              AND metric_key = $4
              AND period_key = $5
              AND ${ACTIVE_ROW_SQL}
            LIMIT 1
            `,
            [
                limit.objectId,
                WORKSPACE_LIMIT_SCOPE_KIND,
                WORKSPACE_LIMIT_OBJECT_KIND,
                WORKSPACE_LIMIT_METRIC_KEY,
                WORKSPACE_LIMIT_PERIOD_KEY
            ]
        )

        if (existingRows[0]) {
            await executor.query(
                `
                UPDATE ${limitsQt}
                SET max_value = $2,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $3,
                    _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE id = $1
                `,
                [existingRows[0].id, limit.maxRows, input.actorUserId ?? null]
            )
            continue
        }

        const [{ id }] = await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
        await executor.query(
            `
            INSERT INTO ${limitsQt} (
                id,
                scope_kind,
                scope_id,
                object_kind,
                object_id,
                metric_key,
                period_key,
                max_value,
                _upl_created_by,
                _upl_updated_by
            )
            VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9)
            `,
            [
                id,
                WORKSPACE_LIMIT_SCOPE_KIND,
                WORKSPACE_LIMIT_OBJECT_KIND,
                limit.objectId,
                WORKSPACE_LIMIT_METRIC_KEY,
                WORKSPACE_LIMIT_PERIOD_KEY,
                limit.maxRows,
                input.actorUserId ?? null,
                input.actorUserId ?? null
            ]
        )
    }
}

export async function getCatalogWorkspaceUsage(
    executor: SqlQueryable,
    input: {
        schemaName: string
        tableName: string
        workspaceId: string
        runtimeRowCondition: string
    }
): Promise<number> {
    const tableIdent = `${qSchema(input.schemaName)}.${qTable(input.tableName)}`
    const rows = await executor.query<CatalogWorkspaceUsageRow>(
        `
        SELECT COUNT(*)::int AS total
        FROM ${tableIdent}
        WHERE ${qWorkspaceColumn()} = $1
          AND ${input.runtimeRowCondition}
        `,
        [input.workspaceId]
    )

    return rows[0]?.total ?? 0
}

export async function enforceCatalogWorkspaceLimit(
    executor: DbExecutor,
    input: {
        schemaName: string
        objectId: string
        tableName: string
        workspaceId: string | null
        runtimeRowCondition: string
    }
): Promise<{ maxRows: number | null; currentRows: number; canCreate: boolean }> {
    if (!input.workspaceId) {
        return { maxRows: null, currentRows: 0, canCreate: true }
    }

    const maxRows = await getCatalogWorkspaceLimit(executor, {
        schemaName: input.schemaName,
        objectId: input.objectId
    })

    if (maxRows === null) {
        const currentRows = await getCatalogWorkspaceUsage(executor, {
            schemaName: input.schemaName,
            tableName: input.tableName,
            workspaceId: input.workspaceId,
            runtimeRowCondition: input.runtimeRowCondition
        })
        return { maxRows, currentRows, canCreate: true }
    }

    await executor.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))`, [
        `workspace-limit:${input.schemaName}:${input.objectId}:${input.workspaceId}`
    ])

    const currentRows = await getCatalogWorkspaceUsage(executor, {
        schemaName: input.schemaName,
        tableName: input.tableName,
        workspaceId: input.workspaceId,
        runtimeRowCondition: input.runtimeRowCondition
    })

    return {
        maxRows,
        currentRows,
        canCreate: currentRows < maxRows
    }
}
