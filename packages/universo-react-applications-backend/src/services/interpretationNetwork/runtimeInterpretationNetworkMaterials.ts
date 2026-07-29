import type { DbExecutor } from '@universo-react/utils'
import { IDENTIFIER_REGEX, UUID_REGEX, quoteIdentifier } from '../../shared/runtimeHelpers'
import {
    InterpretationNetworkCommandError,
    activeWorkspaceWhere,
    getField,
    insertRow,
    interpretationNetworkCommandErrorCodes,
    tableIdent,
    type ObjectContract
} from './runtimeInterpretationNetworkCore'

/** Loads active Material rows referenced either by physical row id or by a matrix cell id. */
export const loadMaterialsByIdsOrCellIds = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        materialIds: string[]
        cellIds: string[]
        workspaceId: string | null
        forUpdate?: boolean
    }
): Promise<Array<Record<string, unknown>>> => {
    const materialIds = [...new Set(params.materialIds.filter((id) => UUID_REGEX.test(id)))]
    const cellIdColumn = getField(params.contract, 'CellId')?.column_name
    const cellIds = [...new Set(params.cellIds.map((id) => id.trim()).filter(Boolean))]

    if (materialIds.length === 0 && (!cellIdColumn || cellIds.length === 0)) return []

    const values: unknown[] = []
    const idConditions: string[] = []
    if (materialIds.length > 0) {
        values.push(materialIds)
        idConditions.push(`id = ANY($${values.length}::uuid[])`)
    }
    if (cellIdColumn && IDENTIFIER_REGEX.test(cellIdColumn) && cellIds.length > 0) {
        values.push(cellIds)
        idConditions.push(`${quoteIdentifier(cellIdColumn)} = ANY($${values.length}::text[])`)
    }

    return executor.query<Record<string, unknown>>(
        `
        SELECT *
        FROM ${tableIdent(params.schemaName, params.contract.object)}
        WHERE (${idConditions.join(' OR ')})
          AND ${activeWorkspaceWhere(params.workspaceId, values)}
        ORDER BY _upl_created_at ASC NULLS LAST, id ASC
        ${params.forUpdate ? 'FOR UPDATE' : ''}
        `,
        values
    )
}

/** Clones Material business fields while regenerating row ids and optional matrix cell ownership. */
export const cloneMaterials = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        materials: Array<Record<string, unknown>>
        cellIdMap?: Map<string, string>
        templateOwnerId?: string
        workspaceId: string | null
        userId: string
        onBeforeCreate?: (source: Record<string, unknown>, values: Record<string, unknown>) => Promise<void>
        onAfterCreate?: (source: Record<string, unknown>, newId: string, values: Record<string, unknown>) => void
    }
): Promise<Map<string, string>> => {
    const materialIdMap = new Map<string, string>()
    const copyCodenames = ['Title', 'Description', 'Body', 'CellId']
    const cellIdColumn = getField(params.contract, 'CellId')?.column_name
    const templateOwnerColumn = getField(params.contract, 'TemplateOwnerId')?.column_name
    if (params.templateOwnerId && (!templateOwnerColumn || !IDENTIFIER_REGEX.test(templateOwnerColumn))) {
        throw new InterpretationNetworkCommandError(
            501,
            interpretationNetworkCommandErrorCodes.missingMetadata,
            'Interpretation Network material provenance metadata is incomplete',
            { missing: ['Material.TemplateOwnerId'] }
        )
    }
    for (const material of params.materials) {
        const values: Record<string, unknown> = {}
        for (const codename of copyCodenames) {
            const column = getField(params.contract, codename)?.column_name
            if (!column || !IDENTIFIER_REGEX.test(column)) continue
            const value = material[column] ?? null
            values[column] =
                codename === 'CellId' && typeof value === 'string' && params.cellIdMap?.has(value)
                    ? params.cellIdMap.get(value) ?? null
                    : value
        }
        if (params.templateOwnerId && templateOwnerColumn) values[templateOwnerColumn] = params.templateOwnerId
        await params.onBeforeCreate?.(material, values)
        const newId = await insertRow(executor, {
            schemaName: params.schemaName,
            contract: params.contract,
            values,
            workspaceId: params.workspaceId,
            userId: params.userId
        })
        params.onAfterCreate?.(material, newId, values)
        const materialId = String(material.id ?? '').trim()
        if (materialId) materialIdMap.set(materialId, newId)
        if (cellIdColumn && IDENTIFIER_REGEX.test(cellIdColumn)) {
            const sourceCellId = String(material[cellIdColumn] ?? '').trim()
            if (sourceCellId) materialIdMap.set(sourceCellId, newId)
        }
    }
    return materialIdMap
}
