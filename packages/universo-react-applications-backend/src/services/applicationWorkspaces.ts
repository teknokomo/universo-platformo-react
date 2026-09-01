import { isUuidV7, type DbExecutor, type SqlQueryable } from '@universo-react/utils'
import { qColumn, qSchema, qSchemaTable, qTable } from '@universo-react/database'
import { generateChildTableName, hasPhysicalRuntimeTable, resolveEntityTableName, type EntityDefinition } from '@universo-react/schema-ddl'
import { ApplicationMembershipState, normalizeInterpretationNetworkHexColor, type VersionedLocalizedContent } from '@universo-react/types'
import { WorkspaceSeedResetError, WORKSPACE_SEED_RESET_ERROR_CODES } from './runtimeWorkspaceErrors'
import {
    ensureLedgerIdempotencyIndex,
    ensureWorkspaceScopedColumn,
    ensureWorkspaceScopedPolicies,
    ensureWorkspaceSupportTables
} from '../ddl/applicationWorkspacesSchema'

const WORKSPACES_TABLE = '_app_workspaces'
const WORKSPACE_ROLES_TABLE = '_app_workspace_roles'
const WORKSPACE_USER_ROLES_TABLE = '_app_workspace_user_roles'
const APP_SETTINGS_TABLE = '_app_settings'
const APP_LIMITS_TABLE = '_app_limits'
const WORKSPACE_LIMIT_SCOPE_KIND = 'workspace'
const WORKSPACE_LIMIT_OBJECT_KIND = 'object'
const WORKSPACE_LIMIT_METRIC_KEY = 'rows'
const WORKSPACE_LIMIT_PERIOD_KEY = 'lifetime'
const WORKSPACE_SEED_TEMPLATE_KEY = 'workspace_seed_template'
const WORKSPACE_OPERATIONS_TABLE = '_app_workspace_operation_audit'

const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'
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

type ObjectWorkspaceLimitRow = {
    objectId: string
    maxRows: number | null
}

type ObjectWorkspaceUsageRow = {
    total: number
}

type WorkspaceScopedTableRow = {
    tableName: string
    objectId?: string | null
}

type ActiveWorkspaceSeedRow = {
    id: string
    personalUserId: string | null
}

type RuntimeWorkspaceSeedTemplate = {
    version: 1
    elements: Record<string, unknown[]>
}

type RuntimeObjectSeedObjectRow = {
    objectId: string
    codename: string
    tableName: string
}

type RuntimeObjectSeedComponentRow = {
    objectId: string
    componentId: string
    parentComponentId: string | null
    codename: string
    columnName: string
    dataType: string
    uiConfig: Record<string, unknown> | null
    validationRules: Record<string, unknown> | null
    targetObjectId: string | null
    targetObjectKind: string | null
}

class WorkspaceSeedReferenceResolutionError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'WorkspaceSeedReferenceResolutionError'
    }
}

type RuntimeColumnDefinitionRow = {
    tableName: string
    columnName: string
    udtName: string
}

type WorkspaceSeedExistingRow = {
    id: string
    seedSourceKey: string
    /** Whether the row is still controlled by the published seed source. */
    seedSourceOwned?: boolean
}

type WorkspaceSeedElementRow = {
    id?: unknown
    data?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const resolveWorkspaceSeedStandardKind = (kind: string | null | undefined): 'object' | 'hub' | 'set' | 'enumeration' | 'page' | null => {
    if (kind === 'object' || kind === 'hub' || kind === 'set' || kind === 'enumeration' || kind === 'page') {
        return kind
    }

    return null
}

const isWorkspaceSeedObjectLikeTargetKind = (kind: string | null | undefined): boolean =>
    typeof kind === 'string' && !['hub', 'set', 'enumeration', 'page'].includes(resolveWorkspaceSeedStandardKind(kind) ?? '')

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

const resolveWorkspaceSeedLegacyObjectIdFromTableName = (tableName: string): string | null => {
    const match = /^(?:cat|doc|rel)_([0-9a-f]{32})$/i.exec(tableName)
    if (!match) {
        return null
    }

    const compactId = match[1].toLowerCase()
    return `${compactId.slice(0, 8)}-${compactId.slice(8, 12)}-${compactId.slice(12, 16)}-${compactId.slice(16, 20)}-${compactId.slice(20)}`
}

const buildChildSeedSourceKey = (parentSeedSourceKey: string, tableComponentId: string, index: number): string =>
    `${parentSeedSourceKey}:${tableComponentId}:${index}`

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

const WORKSPACE_SEED_CURRENT_USER_ID_TOKEN = '{{runtime.currentUserId}}'

const resolveWorkspaceSeedRuntimeToken = (value: unknown, currentUserId?: string | null): unknown => {
    if (typeof value === 'string' && value.trim() === WORKSPACE_SEED_CURRENT_USER_ID_TOKEN) {
        return currentUserId ?? null
    }

    if (isRecord(value) && value.runtime === 'currentUserId') {
        return currentUserId ?? null
    }

    return value
}

const WORKSPACE_SEED_POLYMORPHIC_TARGET_OBJECT_CODENAME_BY_TYPE: Record<string, string> = {
    content: 'learningresources',
    quiz: 'quizzes',
    course: 'courses',
    track: 'learningtracks'
}

const readWorkspaceSeedRuntimeRecordPickerConfig = (component: RuntimeObjectSeedComponentRow): Record<string, unknown> | null => {
    if (!isRecord(component.uiConfig)) return null
    const config = component.uiConfig.runtimeRecordPicker
    return isRecord(config) ? config : null
}

const readWorkspaceSeedRecordPickerTargetObjectCodenames = (component: RuntimeObjectSeedComponentRow): string[] => {
    const config = readWorkspaceSeedRuntimeRecordPickerConfig(component)
    const allowed = config?.allowedObjectCodenames
    if (!Array.isArray(allowed)) return []
    return allowed
        .filter((codename): codename is string => typeof codename === 'string' && codename.trim().length > 0)
        .map(normalizeWorkspaceSeedCodename)
}

const resolveWorkspaceSeedStringReferenceTargetObjectId = (input: {
    component: RuntimeObjectSeedComponentRow
    rowData: Record<string, unknown>
    objectIdByCodename: Map<string, string>
}): string | null => {
    if (input.component.dataType !== 'STRING') {
        return null
    }

    const quizzesObjectId = input.objectIdByCodename.get('quizzes')
    const learningResourcesObjectId = input.objectIdByCodename.get('learningresources')
    if (
        normalizeWorkspaceSeedCodename(input.component.codename) === 'quizid' &&
        quizzesObjectId &&
        learningResourcesObjectId &&
        input.component.objectId === learningResourcesObjectId
    ) {
        return quizzesObjectId
    }

    if (normalizeWorkspaceSeedCodename(input.component.codename) !== 'targetid') {
        if (normalizeWorkspaceSeedCodename(input.component.codename) !== 'targetrecordid') {
            return null
        }

        const recordPickerConfig = readWorkspaceSeedRuntimeRecordPickerConfig(input.component)
        const discriminatorField =
            typeof recordPickerConfig?.targetObjectCodenameField === 'string' &&
            recordPickerConfig.targetObjectCodenameField.trim().length > 0
                ? recordPickerConfig.targetObjectCodenameField
                : 'TargetObjectCodename'
        const targetObjectCodename = getCaseInsensitiveRecordValue(input.rowData, discriminatorField)
        if (typeof targetObjectCodename !== 'string') {
            return null
        }

        return input.objectIdByCodename.get(normalizeWorkspaceSeedCodename(targetObjectCodename)) ?? null
    }

    const targetTypeValue = getCaseInsensitiveRecordValue(input.rowData, 'TargetType')
    if (typeof targetTypeValue !== 'string') {
        return null
    }

    const targetObjectCodename = WORKSPACE_SEED_POLYMORPHIC_TARGET_OBJECT_CODENAME_BY_TYPE[normalizeWorkspaceSeedCodename(targetTypeValue)]
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

/**
 * Return every physical runtime table that is partitioned by workspace.
 *
 * TABLE components are materialized as independent `tbl_*` tables, so looking
 * only at `_app_objects.table_name` silently drops tabular parts during
 * workspace copy/archive operations. The component metadata is the canonical
 * source for those child table names. By default only active metadata is
 * considered; archival callers can include inactive metadata so no live rows
 * are left behind when an object definition was archived before its workspace.
 */
export async function listWorkspaceScopedBusinessTables(
    executor: SqlQueryable,
    schemaName: string,
    options: { includeInactiveMetadata?: boolean } = {}
): Promise<string[]> {
    const objectsQt = qSchemaTable(schemaName, '_app_objects')
    const componentsQt = qSchemaTable(schemaName, '_app_components')
    const parentRows = await executor.query<WorkspaceScopedTableRow>(
        `
        SELECT DISTINCT
            c.table_name AS "tableName",
            o.id AS "objectId"
        FROM information_schema.columns c
        INNER JOIN ${objectsQt} o ON o.table_name = c.table_name
        WHERE c.table_schema = $1
          AND c.column_name = 'workspace_id'
          AND o.table_name IS NOT NULL
          ${options.includeInactiveMetadata ? '' : 'AND o._upl_deleted = false AND o._app_deleted = false'}
        ORDER BY c.table_name ASC
        `,
        [schemaName]
    )

    const objectIds = parentRows
        .map((row) => row.objectId)
        .filter((objectId): objectId is string => typeof objectId === 'string' && objectId.length > 0)
    const childComponentRows =
        objectIds.length > 0
            ? await executor.query<{ componentId: string }>(
                  `
                SELECT DISTINCT c.id AS "componentId"
                FROM ${componentsQt} c
                WHERE c.object_id = ANY($1::uuid[])
                  AND c.parent_component_id IS NULL
                  AND c.data_type = 'TABLE'
                  ${options.includeInactiveMetadata ? '' : 'AND c._upl_deleted = false AND c._app_deleted = false'}
                ORDER BY c.id ASC
                `,
                  [objectIds]
              )
            : []

    const candidateNames = Array.from(
        new Set([...parentRows.map((row) => row.tableName), ...childComponentRows.map((row) => generateChildTableName(row.componentId))])
    )
    if (candidateNames.length === 0) {
        return []
    }

    // A stale component row must not make copy/archive issue SQL against a
    // table that has not been materialized yet.
    const existingRows = await executor.query<{ tableName: string }>(
        `
        SELECT table_name AS "tableName"
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_type = 'BASE TABLE'
          AND table_name = ANY($2::text[])
        ORDER BY table_name ASC
        `,
        [schemaName, candidateNames]
    )
    const existingNames = new Set(existingRows.map((row) => row.tableName))
    return candidateNames.filter((tableName) => existingNames.has(tableName))
}

const qWorkspaceColumn = () => qColumn('workspace_id')

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
        if (!hasPhysicalRuntimeTable(entity)) {
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

    for (const entity of input.entities) {
        await ensureLedgerIdempotencyIndex(executor, input.schemaName, entity)
    }

    await ensurePersonalWorkspacesForApplicationMembers(executor, {
        schemaName: input.schemaName,
        applicationId: input.applicationId,
        actorUserId: input.actorUserId,
        seedElements: false
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
    const roleRows = await executor.query<{ id: string }>(
        `
        INSERT INTO ${qt} (
            id,
            codename,
            name,
            _upl_created_by,
            _upl_updated_by
        )
        VALUES ($1, $2, $3::jsonb, $4, $5)
        ON CONFLICT (codename)
            WHERE _upl_deleted = false AND _app_deleted = false
        DO UPDATE SET codename = EXCLUDED.codename
        RETURNING id
        `,
        [id, input.codename, JSON.stringify(input.name), input.actorUserId ?? null, input.actorUserId ?? null]
    )

    const persistedRoleId = roleRows[0]?.id
    if (!persistedRoleId) {
        throw new Error('WORKSPACE_ROLE_CREATE_FAILED')
    }

    return persistedRoleId
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

async function listActiveWorkspaceSeedRows(executor: SqlQueryable, schemaName: string): Promise<ActiveWorkspaceSeedRow[]> {
    const workspacesQt = qSchemaTable(schemaName, WORKSPACES_TABLE)
    const rows = await executor.query<ActiveWorkspaceSeedRow>(
        `
        SELECT id, personal_user_id AS "personalUserId"
        FROM ${workspacesQt}
        WHERE ${ACTIVE_ROW_SQL}
          AND COALESCE(status, 'active') = 'active'
        ORDER BY _upl_created_at ASC, id ASC
        `
    )

    return rows
}

const normalizeWorkspaceSeedValue = (value: unknown, component: RuntimeObjectSeedComponentRow, columnType: string): unknown => {
    if (value === undefined || value === null) {
        return null
    }

    if (component.dataType === 'REF') {
        return normalizeReferenceId(value)
    }

    if (component.dataType === 'STRING' && component.validationRules?.format === 'hexColor') {
        try {
            return normalizeInterpretationNetworkHexColor(value)
        } catch {
            throw new Error(`Invalid hexColor value for ${component.objectId}.${component.codename}`)
        }
    }

    if (columnType === 'jsonb') {
        return JSON.stringify(value)
    }

    return value
}

const resolveWorkspaceSeedStringDependencyObjectIds = (
    component: RuntimeObjectSeedComponentRow,
    objectIdByCodename: Map<string, string>
): string[] => {
    if (normalizeWorkspaceSeedCodename(component.codename) !== 'targetid') {
        if (normalizeWorkspaceSeedCodename(component.codename) === 'targetrecordid') {
            return readWorkspaceSeedRecordPickerTargetObjectCodenames(component)
                .map((codename) => objectIdByCodename.get(codename) ?? null)
                .filter((objectId): objectId is string => typeof objectId === 'string' && objectId.length > 0)
        }

        const quizzesObjectId = objectIdByCodename.get('quizzes')
        const learningResourcesObjectId = objectIdByCodename.get('learningresources')
        if (
            normalizeWorkspaceSeedCodename(component.codename) === 'quizid' &&
            quizzesObjectId &&
            learningResourcesObjectId &&
            component.objectId === learningResourcesObjectId
        ) {
            return [quizzesObjectId]
        }

        return []
    }

    return Object.values(WORKSPACE_SEED_POLYMORPHIC_TARGET_OBJECT_CODENAME_BY_TYPE)
        .map((codename) => objectIdByCodename.get(codename) ?? null)
        .filter((objectId): objectId is string => typeof objectId === 'string' && objectId.length > 0)
}

const resolveWorkspaceSeedObjectOrder = (
    objects: RuntimeObjectSeedObjectRow[],
    components: RuntimeObjectSeedComponentRow[]
): RuntimeObjectSeedObjectRow[] => {
    const objectIds = new Set(objects.map((object) => object.objectId))
    const tableOwnerObjectIdByComponentId = new Map(
        components
            .filter((component) => component.parentComponentId === null && component.dataType === 'TABLE')
            .map((component) => [component.componentId, component.objectId])
    )
    const objectIdByCodename = new Map(
        objects
            .filter((object) => typeof object.codename === 'string' && object.codename.trim().length > 0)
            .map((object) => [normalizeWorkspaceSeedCodename(object.codename), object.objectId])
    )
    const dependenciesByObjectId = new Map<string, Set<string>>()

    for (const object of objects) {
        dependenciesByObjectId.set(object.objectId, new Set())
    }

    for (const component of components) {
        const dependencyOwnerObjectId = objectIds.has(component.objectId)
            ? component.objectId
            : component.parentComponentId
            ? tableOwnerObjectIdByComponentId.get(component.parentComponentId)
            : undefined

        if (
            dependencyOwnerObjectId &&
            component.dataType === 'REF' &&
            isWorkspaceSeedObjectLikeTargetKind(component.targetObjectKind) &&
            typeof component.targetObjectId === 'string' &&
            objectIds.has(component.targetObjectId) &&
            component.targetObjectId !== dependencyOwnerObjectId
        ) {
            dependenciesByObjectId.get(dependencyOwnerObjectId)?.add(component.targetObjectId)
        }

        for (const dependencyObjectId of resolveWorkspaceSeedStringDependencyObjectIds(component, objectIdByCodename)) {
            if (!dependencyOwnerObjectId || !objectIds.has(dependencyObjectId) || dependencyObjectId === dependencyOwnerObjectId) {
                continue
            }

            dependenciesByObjectId.get(dependencyOwnerObjectId)?.add(dependencyObjectId)
        }
    }

    const ordered: RuntimeObjectSeedObjectRow[] = []
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
    component: RuntimeObjectSeedComponentRow,
    columnType: string,
    seedRowIdByObjectAndSourceKey: Map<string, Map<string, string>>,
    seedRowIdBySourceKey: Map<string, string>,
    duplicateSeedSourceKeys: Set<string>,
    rowData: Record<string, unknown>,
    objectIdByCodename: Map<string, string>,
    currentUserId?: string | null
): unknown => {
    const resolvedValue = resolveWorkspaceSeedRuntimeToken(value, currentUserId)

    if (resolvedValue === undefined || resolvedValue === null) {
        return null
    }

    if (
        component.dataType === 'REF' &&
        isWorkspaceSeedObjectLikeTargetKind(component.targetObjectKind) &&
        typeof component.targetObjectId === 'string'
    ) {
        const seedSourceKey = normalizeReferenceId(resolvedValue)
        if (!seedSourceKey) {
            return null
        }

        const targetRowId =
            seedRowIdByObjectAndSourceKey.get(component.targetObjectId)?.get(seedSourceKey) ??
            (!duplicateSeedSourceKeys.has(seedSourceKey) ? seedRowIdBySourceKey.get(seedSourceKey) : undefined)
        if (!targetRowId) {
            throw new WorkspaceSeedReferenceResolutionError(
                `Failed to resolve workspace seed reference for ${component.objectId}.${component.codename} -> ${component.targetObjectId} (${seedSourceKey})`
            )
        }

        return targetRowId
    }

    const publicRuntimeTargetObjectId = resolveWorkspaceSeedStringReferenceTargetObjectId({
        component,
        rowData,
        objectIdByCodename
    })
    if (publicRuntimeTargetObjectId) {
        const seedSourceKey = normalizeReferenceId(resolvedValue)
        if (!seedSourceKey) {
            return null
        }

        const targetRowId =
            seedRowIdByObjectAndSourceKey.get(publicRuntimeTargetObjectId)?.get(seedSourceKey) ??
            (!duplicateSeedSourceKeys.has(seedSourceKey) ? seedRowIdBySourceKey.get(seedSourceKey) : undefined)
        if (!targetRowId) {
            throw new WorkspaceSeedReferenceResolutionError(
                `Failed to resolve workspace seed runtime target for ${component.objectId}.${component.codename} -> ${publicRuntimeTargetObjectId} (${seedSourceKey})`
            )
        }

        return targetRowId
    }

    return normalizeWorkspaceSeedValue(resolvedValue, component, columnType)
}

async function loadRuntimeObjectSeedMetadata(
    executor: SqlQueryable,
    schemaName: string
): Promise<{
    objects: RuntimeObjectSeedObjectRow[]
    components: RuntimeObjectSeedComponentRow[]
    columnTypes: Map<string, string>
    objectIdByCodename: Map<string, string>
}> {
    const objectsQt = qSchemaTable(schemaName, '_app_objects')
    const componentsQt = qSchemaTable(schemaName, '_app_components')

    const [objects, components] = await Promise.all([
        executor.query<RuntimeObjectSeedObjectRow>(
            `
                        SELECT id AS "objectId", ${runtimeCodenameTextSql('codename')} AS codename, table_name AS "tableName"
            FROM ${objectsQt}
                        WHERE COALESCE(kind, '') NOT IN ('hub', 'set', 'enumeration', 'page', 'ledger')
              AND NOT (
                COALESCE((config->'capabilities'->'ledgerSchema'->>'enabled')::boolean, false) = true
                AND jsonb_typeof(config->'ledger') = 'object'
                AND COALESCE(config->'ledger'->>'sourcePolicy', '') = 'registrar'
              )
              AND table_name IS NOT NULL
              AND ${ACTIVE_ROW_SQL}
            ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
            `
        ),
        executor.query<RuntimeObjectSeedComponentRow>(
            `
            SELECT
                object_id AS "objectId",
                id AS "componentId",
                parent_component_id AS "parentComponentId",
                ${runtimeCodenameTextSql('codename')} AS codename,
                column_name AS "columnName",
                data_type AS "dataType",
                ui_config AS "uiConfig",
                validation_rules AS "validationRules",
                target_object_id AS "targetObjectId",
                target_object_kind AS "targetObjectKind"
            FROM ${componentsQt}
            WHERE ${ACTIVE_ROW_SQL}
            ORDER BY sort_order ASC, _upl_created_at ASC, id ASC
            `
        )
    ])

    const runtimeTableNames = new Set(objects.map((object) => object.tableName).filter((tableName) => tableName.length > 0))
    for (const component of components) {
        if (component.parentComponentId === null && component.dataType === 'TABLE') {
            runtimeTableNames.add(generateChildTableName(component.componentId))
        }
    }

    const columns =
        runtimeTableNames.size > 0
            ? await executor.query<RuntimeColumnDefinitionRow>(
                  `
            SELECT
                c.table_name AS "tableName",
                c.column_name AS "columnName",
                c.udt_name AS "udtName"
            FROM information_schema.columns c
            WHERE c.table_schema = $1
              AND c.table_name = ANY($2::text[])
            `,
                  [schemaName, Array.from(runtimeTableNames)]
              )
            : []

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

    return { objects, components, columnTypes, objectIdByCodename }
}

async function upsertWorkspaceSeedRow(
    executor: DbExecutor,
    input: {
        schemaName: string
        tableName: string
        rowId?: string | null
        workspaceId: string
        seedSourceKey: string
        existingSeedSourceOwned?: boolean
        values: Array<{ columnName: string; value: unknown; columnType: string }>
        actorUserId?: string | null
        parentRowId?: string | null
        sortOrder?: number | null
        overwriteExisting?: boolean
    }
): Promise<string> {
    const tableQt = qSchemaTable(input.schemaName, input.tableName)
    const existingId = input.rowId ?? null

    // Seed synchronization is deliberately initial-only. Once a row exists in a
    // workspace, a later publication must not overwrite a user's value or revive
    // a row they removed. An explicit reset flow can opt into overwriteExisting.
    if (existingId && (input.overwriteExisting !== true || input.existingSeedSourceOwned === false)) {
        return existingId
    }

    const rowId = existingId ?? (await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id'))[0]?.id ?? null

    if (!rowId) {
        throw new Error(`Failed to allocate runtime seed row id for ${input.tableName}`)
    }

    const assignments: string[] = []
    const columns: string[] = [qColumn('id'), qWorkspaceColumn(), qColumn('_seed_source_key'), qColumn('_seed_source_owned')]
    const placeholders: string[] = ['$1', '$2', '$3', '$4']
    const parameters: unknown[] = [rowId, input.workspaceId, input.seedSourceKey, true]
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
            `${qColumn('_seed_source_owned')} = true`,
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
        const updatedRows = await executor.query<{ id: string }>(
            `
            UPDATE ${tableQt}
            SET ${updateAssignments.join(',\n                ')}
            WHERE id = $1
              AND ${qWorkspaceColumn()} = $2
            RETURNING id
            `,
            parameters
        )

        if (updatedRows.length === 0) {
            throw new Error(`Workspace seed row ${rowId} was not found in ${input.tableName}`)
        }

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
        tableComponent: RuntimeObjectSeedComponentRow
        childComponents: RuntimeObjectSeedComponentRow[]
        childRows: unknown[]
        columnTypes: Map<string, string>
        seedRowIdByObjectAndSourceKey: Map<string, Map<string, string>>
        seedRowIdBySourceKey: Map<string, string>
        duplicateSeedSourceKeys: Set<string>
        objectIdByCodename: Map<string, string>
        actorUserId?: string | null
        currentUserId?: string | null
        overwriteExisting?: boolean
    }
): Promise<void> {
    const childTableName = generateChildTableName(input.tableComponent.componentId)
    const childTableQt = qSchemaTable(input.schemaName, childTableName)
    const existingRows = await executor.query<WorkspaceSeedExistingRow>(
        `
        SELECT id, _seed_source_key AS "seedSourceKey", _seed_source_owned AS "seedSourceOwned"
        FROM ${childTableQt}
        WHERE ${qWorkspaceColumn()} = $1
          AND _tp_parent_id = $2
          AND ${qColumn('_seed_source_key')} IS NOT NULL
        ORDER BY _upl_created_at ASC, id ASC
        `,
        [input.workspaceId, input.parentRowId]
    )

    const existingBySeedSourceKey = new Map(
        existingRows.map((row) => [row.seedSourceKey, { id: row.id, seedSourceOwned: row.seedSourceOwned !== false }])
    )
    for (const [index, rawChildRow] of input.childRows.entries()) {
        const rowData = isRecord(rawChildRow) ? rawChildRow : {}
        const seedSourceKey = buildChildSeedSourceKey(input.parentSeedSourceKey, input.tableComponent.componentId, index)

        const values = input.childComponents.map((component) => ({
            columnName: component.columnName,
            value: normalizeWorkspaceSeedValueWithReferences(
                rowData[component.codename],
                component,
                input.columnTypes.get(`${childTableName}.${component.columnName}`) ?? 'text',
                input.seedRowIdByObjectAndSourceKey,
                input.seedRowIdBySourceKey,
                input.duplicateSeedSourceKeys,
                rowData,
                input.objectIdByCodename,
                input.currentUserId
            ),
            columnType: input.columnTypes.get(`${childTableName}.${component.columnName}`) ?? 'text'
        }))

        await upsertWorkspaceSeedRow(executor, {
            schemaName: input.schemaName,
            tableName: childTableName,
            rowId: existingBySeedSourceKey.get(seedSourceKey)?.id ?? null,
            workspaceId: input.workspaceId,
            seedSourceKey,
            existingSeedSourceOwned: existingBySeedSourceKey.get(seedSourceKey)?.seedSourceOwned,
            values,
            actorUserId: input.actorUserId,
            parentRowId: input.parentRowId,
            sortOrder: typeof rowData._tp_sort_order === 'number' ? rowData._tp_sort_order : index,
            overwriteExisting: input.overwriteExisting
        })
    }

    // Do not infer deletion from a changed source template. Workspace content is
    // user-owned after first materialization; removal is an explicit user action
    // or an authorized reset, never a publication side effect.
}

export async function syncWorkspaceSeededElements(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        actorUserId?: string | null
        currentUserId?: string | null
        overwriteExisting?: boolean
    }
): Promise<void> {
    const template = await loadWorkspaceSeedTemplate(executor, input.schemaName)
    const { objects, components, columnTypes, objectIdByCodename } = await loadRuntimeObjectSeedMetadata(executor, input.schemaName)
    const seedRowIdByObjectAndSourceKey = new Map<string, Map<string, string>>()
    const seedRowIdBySourceKey = new Map<string, string>()
    const duplicateSeedSourceKeys = new Set<string>()

    const rememberSeedRowId = (objectId: string, seedSourceKey: string, rowId: string): void => {
        const objectSeedRows = seedRowIdByObjectAndSourceKey.get(objectId) ?? new Map<string, string>()
        objectSeedRows.set(seedSourceKey, rowId)
        seedRowIdByObjectAndSourceKey.set(objectId, objectSeedRows)

        const existingGlobalRowId = seedRowIdBySourceKey.get(seedSourceKey)
        if (existingGlobalRowId && existingGlobalRowId !== rowId) {
            duplicateSeedSourceKeys.add(seedSourceKey)
            seedRowIdBySourceKey.delete(seedSourceKey)
            return
        }

        if (!duplicateSeedSourceKeys.has(seedSourceKey)) {
            seedRowIdBySourceKey.set(seedSourceKey, rowId)
        }
    }

    const syncObjectSeededElements = async (object: RuntimeObjectSeedObjectRow): Promise<void> => {
        const topLevelComponents = components.filter(
            (component) => component.objectId === object.objectId && component.parentComponentId === null && component.dataType !== 'TABLE'
        )
        const tableComponents = components.filter(
            (component) => component.objectId === object.objectId && component.parentComponentId === null && component.dataType === 'TABLE'
        )
        const legacyObjectId = resolveWorkspaceSeedLegacyObjectIdFromTableName(object.tableName)
        const directRows = template?.elements?.[object.objectId]
        const legacyRows = legacyObjectId ? template?.elements?.[legacyObjectId] : undefined
        const entityRows = Array.isArray(directRows)
            ? (directRows as unknown[])
            : Array.isArray(legacyRows)
            ? (legacyRows as unknown[])
            : []
        const tableQt = qSchemaTable(input.schemaName, object.tableName)
        const existingRows = await executor.query<WorkspaceSeedExistingRow>(
            `
            SELECT id, _seed_source_key AS "seedSourceKey", _seed_source_owned AS "seedSourceOwned"
            FROM ${tableQt}
            WHERE ${qWorkspaceColumn()} = $1
              AND ${qColumn('_seed_source_key')} IS NOT NULL
            ORDER BY _upl_created_at ASC, id ASC
            `,
            [input.workspaceId]
        )
        const existingBySeedSourceKey = new Map(
            existingRows.map((row) => [row.seedSourceKey, { id: row.id, seedSourceOwned: row.seedSourceOwned !== false }])
        )

        for (const rawElement of entityRows) {
            const element = (rawElement ?? {}) as WorkspaceSeedElementRow
            const seedSourceKey = typeof element.id === 'string' ? element.id : null
            if (!seedSourceKey) {
                continue
            }

            const rowData = isRecord(element.data) ? element.data : {}
            const values = topLevelComponents.map((component) => ({
                columnName: component.columnName,
                value: normalizeWorkspaceSeedValueWithReferences(
                    rowData[component.codename],
                    component,
                    columnTypes.get(`${object.tableName}.${component.columnName}`) ?? 'text',
                    seedRowIdByObjectAndSourceKey,
                    seedRowIdBySourceKey,
                    duplicateSeedSourceKeys,
                    rowData,
                    objectIdByCodename,
                    input.currentUserId
                ),
                columnType: columnTypes.get(`${object.tableName}.${component.columnName}`) ?? 'text'
            }))

            const rowId = await upsertWorkspaceSeedRow(executor, {
                schemaName: input.schemaName,
                tableName: object.tableName,
                rowId: existingBySeedSourceKey.get(seedSourceKey)?.id ?? null,
                workspaceId: input.workspaceId,
                seedSourceKey,
                existingSeedSourceOwned: existingBySeedSourceKey.get(seedSourceKey)?.seedSourceOwned,
                values,
                actorUserId: input.actorUserId,
                overwriteExisting: input.overwriteExisting
            })
            rememberSeedRowId(object.objectId, seedSourceKey, rowId)

            for (const tableComponent of tableComponents) {
                const childRows = Array.isArray(rowData[tableComponent.codename]) ? (rowData[tableComponent.codename] as unknown[]) : []
                const childComponents = components.filter((component) => component.parentComponentId === tableComponent.componentId)
                await syncWorkspaceSeededChildRows(executor, {
                    schemaName: input.schemaName,
                    workspaceId: input.workspaceId,
                    parentRowId: rowId,
                    parentSeedSourceKey: seedSourceKey,
                    tableComponent,
                    childComponents,
                    childRows,
                    columnTypes,
                    seedRowIdByObjectAndSourceKey,
                    seedRowIdBySourceKey,
                    duplicateSeedSourceKeys,
                    objectIdByCodename,
                    actorUserId: input.actorUserId,
                    currentUserId: input.currentUserId,
                    overwriteExisting: input.overwriteExisting
                })
            }
        }

        // A source publication cannot remove or archive workspace rows. This
        // prevents stale-template cleanup from deleting authored content; reset
        // is intentionally a separate, permission-checked operation.
    }

    let pendingObjects = resolveWorkspaceSeedObjectOrder(objects, components)
    let lastReferenceError: WorkspaceSeedReferenceResolutionError | null = null

    while (pendingObjects.length > 0) {
        const deferredObjects: RuntimeObjectSeedObjectRow[] = []
        let progressed = false

        for (const object of pendingObjects) {
            try {
                await syncObjectSeededElements(object)
                progressed = true
            } catch (error) {
                if (error instanceof WorkspaceSeedReferenceResolutionError) {
                    lastReferenceError = error
                    deferredObjects.push(object)
                    continue
                }

                throw error
            }
        }

        if (!progressed) {
            throw lastReferenceError ?? new Error('Failed to resolve workspace seed object order')
        }

        pendingObjects = deferredObjects
    }
}

/**
 * Reset only rows that are still owned by the published seed source.
 * Authored rows retain their stable `_seed_source_key` for reconciliation but set
 * `_seed_source_owned = false`; they are intentionally preserved. The operation
 * is explicit and transactional; regular publication never calls it.
 */
export async function resetWorkspaceSeededElements(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        actorUserId?: string | null
        currentUserId?: string | null
    }
): Promise<{ resetRows: number; operationId: string }> {
    return executor.transaction(async (tx) => {
        const workspaceRows = await tx.query<{ id: string }>(
            `
            SELECT id
            FROM ${qSchemaTable(input.schemaName, WORKSPACES_TABLE)}
            WHERE id = $1
              AND ${ACTIVE_ROW_SQL}
            LIMIT 1
            `,
            [input.workspaceId]
        )
        if (workspaceRows.length === 0) {
            throw new WorkspaceSeedResetError(WORKSPACE_SEED_RESET_ERROR_CODES.workspaceNotFound, 'Workspace not found')
        }

        // Discover only materialized workspace tables. Metadata can refer to a
        // TABLE component before its physical table exists; issuing dynamic SQL
        // against that stale name would make an otherwise safe reset fail.
        const tableNames = await listWorkspaceScopedBusinessTables(tx, input.schemaName)

        let resetRows = 0
        for (const tableName of tableNames) {
            const reset = await tx.query<{ id: string }>(
                `
                UPDATE ${qSchemaTable(input.schemaName, tableName)}
                SET _upl_deleted = true,
                    _upl_deleted_at = NOW(),
                    _upl_deleted_by = $2,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $2,
                    _upl_version = COALESCE(_upl_version, 1) + 1,
                    _app_deleted = true,
                    _app_deleted_at = NOW(),
                    _app_deleted_by = $2
                WHERE ${qWorkspaceColumn()} = $1
                  AND ${qColumn('_seed_source_key')} IS NOT NULL
                  AND COALESCE(${qColumn('_seed_source_owned')}, true) = true
                  AND ${ACTIVE_ROW_SQL}
                RETURNING id
                `,
                [input.workspaceId, input.actorUserId ?? null]
            )
            resetRows += reset.length
        }

        try {
            await syncWorkspaceSeededElements(tx, {
                schemaName: input.schemaName,
                workspaceId: input.workspaceId,
                actorUserId: input.actorUserId,
                currentUserId: input.currentUserId,
                overwriteExisting: true
            })
        } catch (error) {
            if (error instanceof WorkspaceSeedReferenceResolutionError) {
                throw new WorkspaceSeedResetError(
                    WORKSPACE_SEED_RESET_ERROR_CODES.resetFailed,
                    'Workspace seeded content could not be reset',
                    error
                )
            }
            throw error
        }

        const operationRows = await tx.query<{ id: string }>(
            `
            INSERT INTO ${qSchemaTable(input.schemaName, WORKSPACE_OPERATIONS_TABLE)} (
                id,
                workspace_id,
                operation_kind,
                affected_rows,
                actor_user_id,
                source_key,
                _upl_created_by,
                _upl_updated_by
            )
            VALUES (public.uuid_generate_v7(), $1, $2, $3, $4, $5, $4, $4)
            RETURNING id
            `,
            [input.workspaceId, 'seed_reset', resetRows, input.actorUserId ?? null, WORKSPACE_SEED_TEMPLATE_KEY]
        )
        const operationId = operationRows[0]?.id
        if (!isUuidV7(operationId)) {
            throw new WorkspaceSeedResetError(
                WORKSPACE_SEED_RESET_ERROR_CODES.resetFailed,
                'Workspace seeded content reset could not be recorded'
            )
        }

        return { resetRows, operationId }
    })
}

export async function syncWorkspaceSeededElementsForAllActiveWorkspaces(
    executor: DbExecutor,
    input: {
        schemaName: string
        actorUserId?: string | null
    }
): Promise<void> {
    const workspaceRows = await listActiveWorkspaceSeedRows(executor, input.schemaName)
    for (const workspace of workspaceRows) {
        await syncWorkspaceSeededElements(executor, {
            schemaName: input.schemaName,
            workspaceId: workspace.id,
            actorUserId: input.actorUserId,
            currentUserId: workspace.personalUserId
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
        seedElements?: boolean
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

    let workspaceId = existingWorkspaceRows[0]?.id
    let createdWorkspace = false

    if (!workspaceId) {
        const [{ id: generatedWorkspaceId }] = await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
        const insertedWorkspaceRows = await executor.query<{ id: string }>(
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
            ON CONFLICT (personal_user_id)
                WHERE workspace_type = 'personal' AND _upl_deleted = false AND _app_deleted = false
                DO NOTHING
            RETURNING id
            `,
            [
                generatedWorkspaceId,
                JSON.stringify(MAIN_WORKSPACE_NAME),
                JSON.stringify(MAIN_WORKSPACE_DESCRIPTION),
                userId,
                actorUserId ?? null,
                actorUserId ?? null
            ]
        )

        workspaceId = insertedWorkspaceRows[0]?.id
        if (workspaceId) {
            createdWorkspace = true
        } else {
            const concurrentWorkspaceRows = await executor.query<{ id: string }>(
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
            workspaceId = concurrentWorkspaceRows[0]?.id ?? generatedWorkspaceId
            createdWorkspace = concurrentWorkspaceRows.length === 0
        }
    }

    if (!workspaceId) {
        throw new Error('PERSONAL_WORKSPACE_CREATE_FAILED')
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
            ON CONFLICT (workspace_id, user_id)
                WHERE _upl_deleted = false AND _app_deleted = false
            DO NOTHING
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

    if (createdWorkspace && input.seedElements !== false) {
        await syncWorkspaceSeededElements(executor, {
            schemaName,
            workspaceId,
            actorUserId,
            currentUserId: userId
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
        seedElements?: boolean
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
            defaultRoleCodename: 'owner',
            seedElements: input.seedElements
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
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1,
            _app_deleted = true,
            _app_deleted_at = NOW(),
            _app_deleted_by = $2
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
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1,
            _app_deleted = true,
            _app_deleted_at = NOW(),
            _app_deleted_by = $2
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
): Promise<number> {
    if (input.workspaceIds.length === 0) {
        return 0
    }

    const scopedTables = await listWorkspaceScopedBusinessTables(executor, input.schemaName, { includeInactiveMetadata: true })
    let archivedRows = 0

    for (const tableName of scopedTables) {
        const tableIdent = qSchemaTable(input.schemaName, tableName)
        const rows = await executor.query<{ id: string }>(
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
            RETURNING id
            `,
            [input.workspaceIds, input.actorUserId ?? null]
        )
        archivedRows += rows.length
    }

    // Workspace settings are application runtime state, not metadata-backed
    // business tables, so they are intentionally outside the discovery query
    // above. Archive them in the same transaction as content rows to prevent
    // stale overrides surviving a workspace deletion or user/application exit.
    const settingsRows = await executor.query<{ id: string }>(
        `
        UPDATE ${qSchemaTable(input.schemaName, '_app_workspace_settings')}
        SET _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $2,
            _upl_updated_at = NOW(),
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1,
            _app_deleted = true,
            _app_deleted_at = NOW(),
            _app_deleted_by = $2
        WHERE workspace_id = ANY($1::uuid[])
          AND ${ACTIVE_ROW_SQL}
        RETURNING id
        `,
        [input.workspaceIds, input.actorUserId ?? null]
    )
    archivedRows += settingsRows.length

    return archivedRows
}

export async function resolveRuntimeWorkspaceAccess(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspacesEnabled: boolean
        userId: string
        actorUserId?: string | null
        ensurePersonalWorkspace?: boolean
        /**
         * Application administrators may manage an application workspace even
         * when they are not listed in that workspace's membership table. Keep
         * this opt-in so ordinary runtime callers remain membership-scoped.
         */
        allowUnassigned?: boolean
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

    if (input.ensurePersonalWorkspace !== false) {
        await ensurePersonalWorkspaceForUser(executor, {
            schemaName: input.schemaName,
            userId: input.userId,
            actorUserId: input.actorUserId,
            defaultRoleCodename: 'owner'
        })
    }

    const workspaceUserRolesQt = qSchemaTable(input.schemaName, WORKSPACE_USER_ROLES_TABLE)
    const workspaceQt = qSchemaTable(input.schemaName, WORKSPACES_TABLE)
    const rows = await executor.query<{ workspaceId: string; isDefaultWorkspace: boolean }>(
        `
        SELECT
            wur.workspace_id AS "workspaceId",
            wur.is_default_workspace AS "isDefaultWorkspace"
        FROM ${workspaceQt} w
        LEFT JOIN ${workspaceUserRolesQt} wur
          ON wur.workspace_id = w.id
         AND wur.user_id = $1
         AND wur.${'"_upl_deleted"'} = false
         AND wur.${'"_app_deleted"'} = false
        WHERE w.${'"_upl_deleted"'} = false
          AND w.${'"_app_deleted"'} = false
          AND COALESCE(w.status, 'active') = 'active'
          AND (wur.id IS NOT NULL OR $2::boolean = true)
        ORDER BY COALESCE(wur.is_default_workspace, false) DESC, w._upl_created_at ASC, w.id ASC
        `,
        [input.userId, input.allowUnassigned === true]
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

export async function getObjectWorkspaceLimit(
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

export async function listObjectWorkspaceLimits(
    executor: SqlQueryable,
    input: {
        schemaName: string
    }
): Promise<ObjectWorkspaceLimitRow[]> {
    const limitsQt = qSchemaTable(input.schemaName, APP_LIMITS_TABLE)
    const objectsQt = qSchemaTable(input.schemaName, '_app_objects')

    return executor.query<ObjectWorkspaceLimitRow>(
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
        WHERE o.kind = 'object'
          AND o._upl_deleted = false
          AND o._app_deleted = false
        ORDER BY o.codename ASC
        `
    )
}

export async function upsertObjectWorkspaceLimits(
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

export async function getObjectWorkspaceUsage(
    executor: SqlQueryable,
    input: {
        schemaName: string
        tableName: string
        workspaceId: string
        runtimeRowCondition: string
    }
): Promise<number> {
    const tableIdent = `${qSchema(input.schemaName)}.${qTable(input.tableName)}`
    const rows = await executor.query<ObjectWorkspaceUsageRow>(
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

export async function enforceObjectWorkspaceLimit(
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

    const maxRows = await getObjectWorkspaceLimit(executor, {
        schemaName: input.schemaName,
        objectId: input.objectId
    })

    if (maxRows === null) {
        const currentRows = await getObjectWorkspaceUsage(executor, {
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

    const currentRows = await getObjectWorkspaceUsage(executor, {
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
