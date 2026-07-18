import { database, type DbExecutor } from '@universo-react/utils'
import { qColumn, qSchemaTable } from '@universo-react/database'
import {
    applyWorkspaceSettingOverrides,
    isWorkspaceSettingAllowed,
    listWorkspaceOverridableSettings,
    parseUnifiedSettingValue,
    resolveEffectiveSetting,
    type EffectiveSetting,
    type UnifiedSettingDefinition
} from '@universo-react/types'

const WORKSPACE_SETTINGS_TABLE = '_app_workspace_settings'
const ACTIVE_ROW_SQL = '_upl_deleted = false AND _app_deleted = false'

export const WORKSPACE_SETTINGS_ERROR_CODES = {
    settingNotAllowed: 'WORKSPACE_SETTING_NOT_ALLOWED',
    settingConflict: 'WORKSPACE_SETTING_VERSION_CONFLICT',
    settingNotFound: 'WORKSPACE_SETTING_NOT_FOUND'
} as const

export type WorkspaceSettingsErrorCode = (typeof WORKSPACE_SETTINGS_ERROR_CODES)[keyof typeof WORKSPACE_SETTINGS_ERROR_CODES]

export class WorkspaceSettingsError extends Error {
    code: WorkspaceSettingsErrorCode

    constructor(code: WorkspaceSettingsErrorCode, message: string) {
        super(message)
        this.name = 'WorkspaceSettingsError'
        this.code = code
    }
}

export type WorkspaceSettingOverrideRow = {
    key: string
    value: unknown
    version: number
}

export type RuntimeWorkspaceSetting = EffectiveSetting & {
    allowed: boolean
    version: number | null
}

type WorkspaceSettingRow = {
    key: string
    value: unknown
    version: string | number
}

const toJsonbParam = (value: unknown): string => JSON.stringify(value ?? null)
const buildWorkspaceSettingLockKey = (schemaName: string, workspaceId: string, key: string): string =>
    `${schemaName}:workspace-settings:${workspaceId}:${key}`

const normalizeVersion = (value: string | number | null | undefined): number => {
    const numeric = Number(value ?? 0)
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 1
}

const normalizeExpectedVersion = (value: number | null | undefined): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined

const assertExpectedVersion = (input: { key: string; expectedVersion?: number; currentVersion?: number }): void => {
    const expectedVersion = normalizeExpectedVersion(input.expectedVersion)
    if (expectedVersion === undefined) {
        return
    }

    if (input.currentVersion !== expectedVersion) {
        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingConflict,
            `Workspace setting "${input.key}" version conflict`
        )
    }
}

const assertWorkspaceSettingAllowed = (applicationSettings: Record<string, unknown>, key: string): void => {
    if (!isWorkspaceSettingAllowed(applicationSettings, key)) {
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingNotAllowed, `Workspace setting "${key}" is not allowed`)
    }
}

const lockWorkspaceSetting = async (
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        key: string
    }
): Promise<void> => {
    await executor.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [
        buildWorkspaceSettingLockKey(input.schemaName, input.workspaceId, input.key)
    ])
}

const readActiveWorkspaceSetting = async (
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        key: string
    }
): Promise<{ id: string; version: string | number } | null> => {
    const workspaceSettingsQt = qSchemaTable(input.schemaName, WORKSPACE_SETTINGS_TABLE)
    const existingRows = await executor.query<{ id: string; version: string | number }>(
        `
        SELECT id, ${qColumn('_upl_version')} AS version
        FROM ${workspaceSettingsQt}
        WHERE workspace_id = $1
          AND key = $2
          AND ${ACTIVE_ROW_SQL}
        LIMIT 1
        FOR UPDATE
        `,
        [input.workspaceId, input.key]
    )

    return existingRows[0] ?? null
}

export async function listWorkspaceSettingOverrides(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
    }
): Promise<WorkspaceSettingOverrideRow[]> {
    const workspaceSettingsQt = qSchemaTable(input.schemaName, WORKSPACE_SETTINGS_TABLE)
    const rows = await executor.query<WorkspaceSettingRow>(
        `
        SELECT
            key,
            value,
            ${qColumn('_upl_version')} AS version
        FROM ${workspaceSettingsQt}
        WHERE workspace_id = $1
          AND ${ACTIVE_ROW_SQL}
        ORDER BY key ASC
        `,
        [input.workspaceId]
    )

    return rows.map((row) => ({
        key: row.key,
        value: row.value,
        version: normalizeVersion(row.version)
    }))
}

export async function getWorkspaceSettingOverrideMap(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
    }
): Promise<Record<string, unknown>> {
    const rows = await listWorkspaceSettingOverrides(executor, input)
    const overrides: Record<string, unknown> = {}

    for (const row of rows) {
        if (isWorkspaceSettingAllowed(input.applicationSettings, row.key)) {
            overrides[row.key] = row.value
        }
    }

    return overrides
}

export async function resolveEffectiveApplicationSettingsForWorkspace(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
    }
): Promise<Record<string, unknown>> {
    const overrides = await getWorkspaceSettingOverrideMap(executor, input)
    return applyWorkspaceSettingOverrides(input.applicationSettings, overrides)
}

export async function listRuntimeWorkspaceSettings(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
    }
): Promise<RuntimeWorkspaceSetting[]> {
    const overrides = await listWorkspaceSettingOverrides(executor, input)
    const overridesByKey = new Map(overrides.map((override) => [override.key, override]))
    const overrideValues: Record<string, unknown> = {}

    for (const override of overrides) {
        overrideValues[override.key] = override.value
    }

    return listWorkspaceOverridableSettings().map((definition: UnifiedSettingDefinition) => {
        const allowed = isWorkspaceSettingAllowed(input.applicationSettings, definition.key)
        const persisted = overridesByKey.get(definition.key)
        const effective = resolveEffectiveSetting(definition, input.applicationSettings, allowed ? overrideValues : {})

        return {
            ...effective,
            allowed,
            version: persisted?.version ?? null
        }
    })
}

export async function upsertWorkspaceSettingOverride(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
        key: string
        value: unknown
        expectedVersion?: number
        actorUserId?: string | null
    }
): Promise<WorkspaceSettingOverrideRow> {
    assertWorkspaceSettingAllowed(input.applicationSettings, input.key)
    await lockWorkspaceSetting(executor, input)
    const parsedValue = parseUnifiedSettingValue(input.key, input.value)
    const workspaceSettingsQt = qSchemaTable(input.schemaName, WORKSPACE_SETTINGS_TABLE)
    const existing = await readActiveWorkspaceSetting(executor, input)

    if (existing) {
        const currentVersion = normalizeVersion(existing.version)
        assertExpectedVersion({ key: input.key, expectedVersion: input.expectedVersion, currentVersion })

        const updatedRows = await executor.query<{ key: string; value: unknown; version: string | number }>(
            `
            UPDATE ${workspaceSettingsQt}
            SET value = $2::jsonb,
                ${qColumn('_upl_updated_at')} = NOW(),
                ${qColumn('_upl_updated_by')} = $3,
                ${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1
            WHERE id = $1
              AND ${ACTIVE_ROW_SQL}
            RETURNING key, value, ${qColumn('_upl_version')} AS version
            `,
            [existing.id, toJsonbParam(parsedValue), input.actorUserId ?? null]
        )

        const updated = updatedRows[0]
        if (!updated) {
            throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingNotFound, `Workspace setting "${input.key}" not found`)
        }

        return {
            key: updated.key,
            value: updated.value,
            version: normalizeVersion(updated.version)
        }
    }

    assertExpectedVersion({ key: input.key, expectedVersion: input.expectedVersion })

    const [{ id }] = await executor.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')

    try {
        const insertedRows = await executor.query<{ key: string; value: unknown; version: string | number }>(
            `
            INSERT INTO ${workspaceSettingsQt} (
                id,
                workspace_id,
                key,
                value,
                ${qColumn('_upl_created_by')},
                ${qColumn('_upl_updated_by')}
            )
            VALUES ($1, $2, $3, $4::jsonb, $5, $6)
            RETURNING key, value, ${qColumn('_upl_version')} AS version
            `,
            [id, input.workspaceId, input.key, toJsonbParam(parsedValue), input.actorUserId ?? null, input.actorUserId ?? null]
        )
        const inserted = insertedRows[0]

        return {
            key: inserted.key,
            value: inserted.value,
            version: normalizeVersion(inserted.version)
        }
    } catch (error) {
        if (!database.isUniqueViolation(error)) {
            throw error
        }

        throw new WorkspaceSettingsError(
            WORKSPACE_SETTINGS_ERROR_CODES.settingConflict,
            `Workspace setting "${input.key}" version conflict`
        )
    }
}

export async function resetWorkspaceSettingOverride(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
        key: string
        expectedVersion?: number
        actorUserId?: string | null
    }
): Promise<void> {
    assertWorkspaceSettingAllowed(input.applicationSettings, input.key)
    await lockWorkspaceSetting(executor, input)
    const workspaceSettingsQt = qSchemaTable(input.schemaName, WORKSPACE_SETTINGS_TABLE)
    const existing = await readActiveWorkspaceSetting(executor, input)
    if (!existing) {
        assertExpectedVersion({ key: input.key, expectedVersion: input.expectedVersion })
        return
    }

    const currentVersion = normalizeVersion(existing.version)
    assertExpectedVersion({ key: input.key, expectedVersion: input.expectedVersion, currentVersion })

    const updatedRows = await executor.query<{ id: string }>(
        `
        UPDATE ${workspaceSettingsQt}
        SET ${qColumn('_upl_deleted')} = true,
            ${qColumn('_upl_deleted_at')} = NOW(),
            ${qColumn('_upl_deleted_by')} = $2,
            ${qColumn('_upl_updated_at')} = NOW(),
            ${qColumn('_upl_updated_by')} = $2,
            ${qColumn('_upl_version')} = COALESCE(${qColumn('_upl_version')}, 1) + 1,
            ${qColumn('_app_deleted')} = true,
            ${qColumn('_app_deleted_at')} = NOW(),
            ${qColumn('_app_deleted_by')} = $2
        WHERE id = $1
          AND ${ACTIVE_ROW_SQL}
        RETURNING id
        `,
        [existing.id, input.actorUserId ?? null]
    )

    if (updatedRows.length === 0) {
        throw new WorkspaceSettingsError(WORKSPACE_SETTINGS_ERROR_CODES.settingNotFound, `Workspace setting "${input.key}" not found`)
    }
}
export async function updateWorkspaceSettingOverrides(
    executor: DbExecutor,
    input: {
        schemaName: string
        workspaceId: string
        applicationSettings: Record<string, unknown>
        settings: Array<{ key: string; value: unknown; expectedVersion?: number }>
        resetKeys: Array<{ key: string; expectedVersion?: number }>
        actorUserId?: string | null
    }
): Promise<RuntimeWorkspaceSetting[]> {
    return executor.transaction(async (tx) => {
        const operations = [
            ...input.settings.map((setting) => ({ kind: 'setting' as const, key: setting.key, setting })),
            ...input.resetKeys.map((reset) => ({ kind: 'reset' as const, key: reset.key, reset }))
        ].sort((left, right) => left.key.localeCompare(right.key))

        for (const operation of operations) {
            if (operation.kind === 'setting') {
                await upsertWorkspaceSettingOverride(tx, {
                    schemaName: input.schemaName,
                    workspaceId: input.workspaceId,
                    applicationSettings: input.applicationSettings,
                    key: operation.setting.key,
                    value: operation.setting.value,
                    expectedVersion: operation.setting.expectedVersion,
                    actorUserId: input.actorUserId
                })
                continue
            }

            await resetWorkspaceSettingOverride(tx, {
                schemaName: input.schemaName,
                workspaceId: input.workspaceId,
                applicationSettings: input.applicationSettings,
                key: operation.reset.key,
                expectedVersion: operation.reset.expectedVersion,
                actorUserId: input.actorUserId
            })
        }

        return listRuntimeWorkspaceSettings(tx, {
            schemaName: input.schemaName,
            workspaceId: input.workspaceId,
            applicationSettings: input.applicationSettings
        })
    })
}
