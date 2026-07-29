import { qColumn, qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'

export const INTERPRETATION_NETWORK_WIDGET_KEY = 'interpretationNetworkWorkspace'

const SINGLE_SYSTEM_MODE = 'singleSystem'
const SYSTEM_STRUCTURE_KEY = 'primary'
export const interpretationNetworkStructureModeLockKey = (schemaName: string): string =>
    `${schemaName}:interpretation-network:structure-mode`

export const lockInterpretationNetworkStructureMode = async (executor: DbExecutor, schemaName: string): Promise<void> => {
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [interpretationNetworkStructureModeLockKey(schemaName)])
}

type WidgetModeState = {
    widgetKey: string
    config?: Record<string, unknown> | null
    isActive?: boolean
}

export type InterpretationNetworkStructureModeTransition = {
    current?: WidgetModeState | null
    next: WidgetModeState
}

const runtimeCodenameTextSql = (columnRef: string): string =>
    `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`

const entersActiveSingleSystemMode = ({ current, next }: InterpretationNetworkStructureModeTransition): boolean =>
    next.widgetKey === INTERPRETATION_NETWORK_WIDGET_KEY &&
    next.isActive !== false &&
    next.config?.structureMode === SINGLE_SYSTEM_MODE &&
    !(
        current?.widgetKey === INTERPRETATION_NETWORK_WIDGET_KEY &&
        current.isActive !== false &&
        current.config?.structureMode === SINGLE_SYSTEM_MODE
    )

/**
 * Serializes every entry into the active single-system mode and fails closed
 * while ordinary Structures still exist in any application workspace.
 */
export async function assertInterpretationNetworkSingleSystemTransitionAllowed(
    executor: DbExecutor,
    schemaName: string,
    transitions: InterpretationNetworkStructureModeTransition[],
    options: { lockAlreadyHeld?: boolean } = {}
): Promise<void> {
    const relevantTransitions = transitions.filter(entersActiveSingleSystemMode)
    if (relevantTransitions.length === 0) return

    if (!options.lockAlreadyHeld) {
        await lockInterpretationNetworkStructureMode(executor, schemaName)
    }

    const checkedCodenames = new Set<string>()
    for (const { next } of relevantTransitions) {
        const structureCodename =
            typeof next.config?.conceptCodename === 'string' && next.config.conceptCodename.trim()
                ? next.config.conceptCodename.trim()
                : 'Structure'
        if (checkedCodenames.has(structureCodename)) continue
        checkedCodenames.add(structureCodename)

        const objects = await executor.query<{ tableName: string; objectId: string }>(
            `
            SELECT id AS "objectId", table_name AS "tableName"
            FROM ${qSchemaTable(schemaName, '_app_objects')}
            WHERE ${runtimeCodenameTextSql('codename')} = $1
              AND _upl_deleted = false
              AND _app_deleted = false
            LIMIT 1
            `,
            [structureCodename]
        )
        const structureObject = objects[0]
        if (!structureObject) throw new Error('APPLICATION_INTERPRETATION_NETWORK_METADATA_MISSING')

        const systemKeyFields = await executor.query<{ columnName: string }>(
            `
            SELECT column_name AS "columnName"
            FROM ${qSchemaTable(schemaName, '_app_components')}
            WHERE object_id = $1
              AND ${runtimeCodenameTextSql('codename')} = 'SystemKey'
              AND parent_component_id IS NULL
              AND _upl_deleted = false
              AND _app_deleted = false
            LIMIT 1
            `,
            [structureObject.objectId]
        )
        const systemKeyColumn = systemKeyFields[0]?.columnName
        if (!systemKeyColumn) throw new Error('APPLICATION_INTERPRETATION_NETWORK_METADATA_MISSING')

        const [{ count = 0 } = {}] = await executor.query<{ count: number }>(
            `
            SELECT COUNT(*)::int AS count
            FROM ${qSchemaTable(schemaName, structureObject.tableName)}
            WHERE _upl_deleted = false
              AND _app_deleted = false
              AND COALESCE(${qColumn(systemKeyColumn)}::text, '') <> $1
            `,
            [SYSTEM_STRUCTURE_KEY]
        )
        if (Number(count) > 0) throw new Error('APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST')
    }
}
