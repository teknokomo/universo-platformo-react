import type { DbExecutor } from '@universo-react/utils'
import { generateUuidV7 } from '@universo-react/utils'
import { IDENTIFIER_REGEX, UUID_REGEX, quoteIdentifier } from '../../shared/runtimeHelpers'
import { resolveValidatedRuntimeEntityRecordPolicy } from '../../shared/entityMutationPolicy'
import {
    InterpretationNetworkCommandError,
    activeWorkspaceWhere,
    assertColumn,
    getField,
    interpretationNetworkCommandErrorCodes,
    tableIdent,
    type ObjectContract
} from './runtimeInterpretationNetworkCore'

const materialAggregateFields = ['Title', 'Description', 'Body', 'CellId', 'InterpretationId'] as const

/** Material writes are denied on generic runtime routes and allowed only through this aggregate. */
export const assertMaterialAggregatePolicy = (contract: ObjectContract): void => {
    let policy: ReturnType<typeof resolveValidatedRuntimeEntityRecordPolicy>
    try {
        policy = resolveValidatedRuntimeEntityRecordPolicy(contract.object.config)
    } catch {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.missingMetadata,
            'Interpretation Network Material mutation policy is missing or invalid'
        )
    }
    if (policy?.runtimeMutation !== 'deny') {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.missingMetadata,
            'Interpretation Network Material must deny generic runtime mutations'
        )
    }
}

/** Inserts a Material only after its caller has validated cell ownership and the trusted policy. */
export const insertMaterialAggregateRow = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        values: Record<string, unknown>
        workspaceId: string | null
        userId: string
    }
): Promise<string> => {
    assertMaterialAggregatePolicy(params.contract)
    const id = generateUuidV7()
    const columns = ['id']
    const placeholders = ['$1']
    const values: unknown[] = [id]
    for (const [column, value] of Object.entries(params.values)) {
        if (!IDENTIFIER_REGEX.test(column)) continue
        values.push(value)
        columns.push(quoteIdentifier(column))
        placeholders.push(`$${values.length}`)
    }
    if (params.workspaceId) {
        values.push(params.workspaceId)
        columns.push(quoteIdentifier('workspace_id'))
        placeholders.push(`$${values.length}`)
    }
    values.push(params.userId)
    columns.push('_upl_created_by')
    placeholders.push(`$${values.length}`)
    values.push(params.userId)
    columns.push('_upl_updated_by')
    placeholders.push(`$${values.length}`)
    const rows = await executor.query<{ id: string }>(
        `INSERT INTO ${tableIdent(params.schemaName, params.contract.object)} (${columns.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING id`,
        values
    )
    if (rows.length !== 1 || !rows[0]?.id) {
        throw new InterpretationNetworkCommandError(500, 'INTERPRETATION_NETWORK_INSERT_FAILED', 'Failed to create Material')
    }
    return rows[0].id
}

/** Soft-deletes a Material through its trusted aggregate and fails closed on stale rows. */
export const softDeleteMaterialAggregateRow = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        materialId: string
        workspaceId: string | null
        userId: string
        expectedVersion?: number
    }
): Promise<void> => {
    assertMaterialAggregatePolicy(params.contract)
    const values: unknown[] = [params.userId, params.materialId]
    const where = ['id = $2']
    if (params.expectedVersion !== undefined) {
        values.push(params.expectedVersion)
        where.push(`COALESCE(_upl_version, 1) = $${values.length}`)
    }
    where.push(activeWorkspaceWhere(params.workspaceId, values))
    const rows = await executor.query<{ id: string }>(
        `UPDATE ${tableIdent(params.schemaName, params.contract.object)}
         SET _upl_deleted = true,
             _app_deleted = true,
             _upl_deleted_at = NOW(),
             _app_deleted_at = NOW(),
             _upl_deleted_by = $1,
             _app_deleted_by = $1,
             _upl_updated_by = $1,
             _upl_updated_at = NOW(),
             _upl_version = COALESCE(_upl_version, 1) + 1
         WHERE ${where.join(' AND ')}
         RETURNING id`,
        values
    )
    if (rows.length !== 1) {
        throw new InterpretationNetworkCommandError(
            params.expectedVersion === undefined ? 404 : 409,
            params.expectedVersion === undefined
                ? interpretationNetworkCommandErrorCodes.invalidMaterial
                : interpretationNetworkCommandErrorCodes.versionConflict,
            params.expectedVersion === undefined ? 'Material was not found' : 'Material version conflict'
        )
    }
}

/** Loads active Material rows referenced either by physical row id or by a matrix cell id. */
export const loadMaterialsByIdsOrCellIds = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        materialIds: string[]
        cellIds: string[]
        interpretationId?: string
        templateOwnerId?: string
        workspaceId: string | null
        forUpdate?: boolean
    }
): Promise<Array<Record<string, unknown>>> => {
    const materialIds = [...new Set(params.materialIds.filter((id) => UUID_REGEX.test(id)))]
    const cellIdColumn = getField(params.contract, 'CellId')?.column_name
    const templateOwnerField = params.templateOwnerId ? getField(params.contract, 'TemplateOwnerId') : undefined
    const templateOwnerColumn = assertColumn(getField(params.contract, 'TemplateOwnerId'), 'Material.TemplateOwnerId')
    const interpretationIdColumn = assertColumn(getField(params.contract, 'InterpretationId'), 'Material.InterpretationId')
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
    let ownerScope: string
    if (params.templateOwnerId) {
        assertColumn(templateOwnerField, 'Material.TemplateOwnerId')
        values.push(params.templateOwnerId)
        ownerScope = `${quoteIdentifier(templateOwnerColumn)} = $${values.length}`
    } else {
        if (!params.interpretationId) {
            throw new InterpretationNetworkCommandError(
                409,
                interpretationNetworkCommandErrorCodes.missingMetadata,
                'Interpretation ID is required to resolve cell-owned Materials'
            )
        }
        values.push(params.interpretationId)
        ownerScope = `${quoteIdentifier(interpretationIdColumn)} = $${values.length} AND ${quoteIdentifier(templateOwnerColumn)} IS NULL`
    }

    return executor.query<Record<string, unknown>>(
        `
        SELECT *
        FROM ${tableIdent(params.schemaName, params.contract.object)}
        WHERE (${idConditions.join(' OR ')})
          AND ${ownerScope}
          AND ${activeWorkspaceWhere(params.workspaceId, values)}
        ORDER BY _upl_created_at ASC NULLS LAST, id ASC
        ${params.forUpdate ? 'FOR UPDATE' : ''}
        `,
        values
    )
}

/** Loads the complete template-owned Material set, including records with damaged cell provenance. */
export const loadMaterialsByTemplateOwner = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        templateId: string
        workspaceId: string | null
        forUpdate?: boolean
    }
): Promise<Array<Record<string, unknown>>> => {
    const ownerColumn = assertColumn(getField(params.contract, 'TemplateOwnerId'), 'Material.TemplateOwnerId')
    const values: unknown[] = [params.templateId]
    const workspaceWhere = activeWorkspaceWhere(params.workspaceId, values)
    return executor.query<Record<string, unknown>>(
        `SELECT *
         FROM ${tableIdent(params.schemaName, params.contract.object)}
         WHERE ${quoteIdentifier(ownerColumn)} = $1
           AND ${workspaceWhere}
         ORDER BY _upl_created_at ASC NULLS LAST, id ASC
         ${params.forUpdate ? 'FOR UPDATE' : ''}`,
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
        interpretationId?: string
        templateOwnerId?: string
        workspaceId: string | null
        userId: string
        onBeforeCreate?: (source: Record<string, unknown>, values: Record<string, unknown>) => Promise<void>
        onAfterCreate?: (source: Record<string, unknown>, newId: string, values: Record<string, unknown>) => void
    }
): Promise<Map<string, string>> => {
    const materialIdMap = new Map<string, string>()
    assertMaterialAggregatePolicy(params.contract)
    const copyCodenames = materialAggregateFields
    const templateOwnerColumn = getField(params.contract, 'TemplateOwnerId')?.column_name
    const interpretationIdColumn = assertColumn(getField(params.contract, 'InterpretationId'), 'Material.InterpretationId')
    if (params.templateOwnerId && (!templateOwnerColumn || !IDENTIFIER_REGEX.test(templateOwnerColumn))) {
        throw new InterpretationNetworkCommandError(
            501,
            interpretationNetworkCommandErrorCodes.missingMetadata,
            'Interpretation Network material provenance metadata is incomplete',
            { missing: ['Material.TemplateOwnerId'] }
        )
    }
    if (!params.templateOwnerId && !params.interpretationId) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.missingMetadata,
            'Destination Interpretation ID is required when cloning cell Materials'
        )
    }
    for (const material of params.materials) {
        const values: Record<string, unknown> = {}
        for (const codename of copyCodenames) {
            const column = getField(params.contract, codename)?.column_name
            if (!column || !IDENTIFIER_REGEX.test(column)) continue
            const value = material[column] ?? null
            values[column] =
                codename === 'InterpretationId'
                    ? params.interpretationId ?? null
                    : codename === 'CellId' && typeof value === 'string' && params.cellIdMap?.has(value)
                    ? params.cellIdMap.get(value) ?? null
                    : value
        }
        values[interpretationIdColumn] = params.interpretationId ?? null
        if (params.templateOwnerId && templateOwnerColumn) values[templateOwnerColumn] = params.templateOwnerId
        await params.onBeforeCreate?.(material, values)
        const newId = await insertMaterialAggregateRow(executor, {
            schemaName: params.schemaName,
            contract: params.contract,
            values,
            workspaceId: params.workspaceId,
            userId: params.userId
        })
        params.onAfterCreate?.(material, newId, values)
        const materialId = String(material.id ?? '').trim()
        if (materialId) materialIdMap.set(materialId, newId)
    }
    return materialIdMap
}
