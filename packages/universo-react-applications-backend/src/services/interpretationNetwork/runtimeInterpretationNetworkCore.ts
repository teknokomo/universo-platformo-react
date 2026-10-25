import { acquireAdvisoryXactLock, acquireTwoKeyAdvisoryXactLock } from '@universo-react/utils/database'
import { interpretationNetworkStructureModeLockKey } from '../../shared/interpretationNetworkStructureModeGuard'
import { qSchemaTable } from '@universo-react/database'
import type { InterpretationNetworkStructureMode } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { buildVLC, createLocalizedContent, generateUuidV7 } from '@universo-react/utils'
import {
    assertRuntimeEntityMutationAllowed,
    resolveValidatedRuntimeEntityRecordPolicy,
    RuntimeEntityMutationPolicyError
} from '../../shared/entityMutationPolicy'
import {
    IDENTIFIER_REGEX,
    UUID_REGEX,
    coerceRuntimeValue,
    normalizeConfiguredRuntimeJsonValue,
    normalizeRuntimeTableChildInsertValueByMeta,
    quoteIdentifier,
    toRuntimeInputFormatErrorBody,
    type RuntimeTableChildComponentMeta
} from '../../shared/runtimeHelpers'
import { activeWorkspaceWhere } from '../../shared/runtimeWorkspaceSql'
import { assertColumn, getChildField, getField } from './runtimeInterpretationNetworkMetadata'
import { InterpretationNetworkCommandError, interpretationNetworkCommandErrorCodes } from './runtimeInterpretationNetworkErrors'
import {
    type ComponentRow,
    type InterpretationNetworkRuntimeSurface,
    type ObjectContract,
    type ObjectRow,
    type RuntimeSurfaceReady
} from '../../shared/interpretationNetworkRuntimeContracts'
export {
    INTERPRETATION_NETWORK_WIDGET_KEY,
    type ComponentRow,
    type InterpretationNetworkRuntimeSurface,
    type ObjectContract,
    type ObjectRow,
    type RuntimeSurfaceReady,
    type WidgetRow
} from '../../shared/interpretationNetworkRuntimeContracts'
export { activeWorkspaceWhere } from '../../shared/runtimeWorkspaceSql'
export { assertColumn, getChildField, getField } from './runtimeInterpretationNetworkMetadata'
export { InterpretationNetworkCommandError, interpretationNetworkCommandErrorCodes } from './runtimeInterpretationNetworkErrors'

export {
    interpretationNetworkEnsureSystemStructureRequestSchema,
    interpretationNetworkMaterialCreateRequestSchema,
    interpretationNetworkMaterialDeleteRequestSchema,
    interpretationNetworkMaterialPrimaryRequestSchema,
    interpretationNetworkMaterialUpdateRequestSchema,
    interpretationNetworkMatrixCellCreateRequestSchema,
    interpretationNetworkMatrixCellDeleteRequestSchema,
    interpretationNetworkMatrixCellUpdateRequestSchema,
    interpretationNetworkMatrixCellsMoveRequestSchema,
    interpretationNetworkStructureCreateRequestSchema,
    interpretationNetworkStructureDeleteRequestSchema,
    interpretationNetworkStructureRouteParamsSchema,
    interpretationNetworkTemplateDeleteRequestSchema,
    interpretationNetworkTemplateInstantiateRequestSchema,
    interpretationNetworkTemplateSaveRequestSchema,
    interpretationNetworkTemplateUpdateRequestSchema
} from './runtimeInterpretationNetworkSchemas'

export const SYSTEM_STRUCTURE_KEY = 'primary'
export const SYSTEM_STRUCTURE_NAME = buildVLC('System structure', 'Системная структура')
export const SYSTEM_INTERPRETATION_TITLE = buildVLC('System matrix', 'Системная матрица')

export const TEMPLATE_POLICY_STRUCTURE_ONLY = 'structureOnly'
export const TEMPLATE_POLICY_WITH_MATERIALS = 'withMaterials'

/**
 * Interpretation Network aggregate routes are the trusted write boundary for
 * policy-protected entities. Generic runtime routes still enforce
 * runtimeMutation='deny'; aggregate commands validate metadata here and apply
 * their own permission, ownership, version and invariant checks.
 */
export const assertInterpretationNetworkAggregatePolicyValid = (config: unknown): void => {
    try {
        resolveValidatedRuntimeEntityRecordPolicy(config)
    } catch {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.missingMetadata,
            'Interpretation Network entity mutation policy is missing or invalid'
        )
    }
}

/** Generic helper boundary: keep denied entities blocked unless an aggregate explicitly opts in. */
export const assertInterpretationNetworkEntityMutationAllowed = (config: unknown): void => {
    try {
        assertRuntimeEntityMutationAllowed(config)
    } catch (error) {
        if (!(error instanceof RuntimeEntityMutationPolicyError)) throw error
        const message = typeof error.body.error === 'string' ? error.body.error : 'Entity runtime mutation is disabled.'
        throw new InterpretationNetworkCommandError(error.statusCode, error.code, message)
    }
}

export type MaterialCreateResult = {
    id: string
    matrixRowId: string
}

export type SystemStructureAggregate = {
    structureId: string
    interpretationId: string
    rootCellId: string
    created: boolean
    canCreate?: boolean
}

export type TemplateSummary = {
    id: string
    name: unknown
    description: unknown
    includesMaterials: boolean
    version: number
}

export type TemplateDetail = TemplateSummary & {
    matrix: {
        cellCount: number
        rootCount: number
        maxDepth: number
    }
    materialCount: number
}

export type MatrixCopyPlan = {
    rows: Array<Record<string, unknown>>
    cellIdMap: Map<string, string>
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

export const assertReadySurface = (surface: InterpretationNetworkRuntimeSurface, command: string): RuntimeSurfaceReady => {
    if (surface.featureState !== 'ready') {
        throw buildFeatureNotReadyError(surface, command)
    }
    return surface
}

export const assertStructureMode = (surface: RuntimeSurfaceReady, expected: InterpretationNetworkStructureMode, command: string) => {
    if (surface.structureMode !== expected) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.unsupportedMode,
            `Interpretation Network ${command} is not available in ${surface.structureMode} mode`,
            { command, expectedMode: expected, actualMode: surface.structureMode }
        )
    }
}

type RuntimeMutationPermission = 'createContent' | 'editContent' | 'deleteContent'

export const assertRuntimePermissions = (ctx: { permissions: Record<string, boolean> }, ...permissions: RuntimeMutationPermission[]) => {
    const denied = permissions.find((permission) => ctx.permissions[permission] !== true)
    if (!denied) return
    throw new InterpretationNetworkCommandError(
        403,
        interpretationNetworkCommandErrorCodes.permissionDenied,
        'Insufficient permissions for this action',
        { permission: denied }
    )
}

export const buildFeatureNotReadyError = (
    surface: InterpretationNetworkRuntimeSurface,
    command: string
): InterpretationNetworkCommandError =>
    new InterpretationNetworkCommandError(
        501,
        interpretationNetworkCommandErrorCodes.featureNotReady,
        'Interpretation Network runtime commands are not available for this application',
        {
            command,
            featureState: surface.featureState,
            missing: surface.missing
        }
    )

export const findFieldByColumnOrCodename = (contract: ObjectContract, key: string): ComponentRow | undefined =>
    Object.values(contract.fields).find((field) => field.column_name === key || field.codename === key)

export const tableIdent = (schemaName: string, object: ObjectRow): string => qSchemaTable(schemaName, object.table_name)

export const childTableIdent = (schemaName: string, contract: ObjectContract): string => {
    if (!contract.childTableName) {
        throw new InterpretationNetworkCommandError(
            501,
            interpretationNetworkCommandErrorCodes.missingMetadata,
            'Interpretation Network table metadata is incomplete'
        )
    }
    return qSchemaTable(schemaName, contract.childTableName)
}

const lockKey = (surface: RuntimeSurfaceReady, command: string): [string, string] => [
    `interpretation-network:${command}`,
    `${surface.schemaName}:${surface.workspaceId ?? 'global'}:${surface.widgetId}`
]

export const acquireCommandLock = async (executor: DbExecutor, surface: RuntimeSurfaceReady, command: string): Promise<void> => {
    const [left, right] = lockKey(surface, command)
    await acquireTwoKeyAdvisoryXactLock(executor, left, right)
}

/** Serializes structure-mode transitions with Structure aggregate mutations. */
export const acquireStructureModeLock = async (executor: DbExecutor, surface: RuntimeSurfaceReady): Promise<void> => {
    await acquireAdvisoryXactLock(executor, interpretationNetworkStructureModeLockKey(surface.schemaName))
}

export const selectActiveRowsByField = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        field: ComponentRow
        value: unknown
        workspaceId: string | null
        forUpdate?: boolean
    }
): Promise<Array<Record<string, unknown>>> => {
    const values: unknown[] = [params.value]
    const where = [`${quoteIdentifier(params.field.column_name)} = $1`, activeWorkspaceWhere(params.workspaceId, values)]
    const rows = await executor.query<Record<string, unknown>>(
        `
        SELECT *
        FROM ${tableIdent(params.schemaName, params.contract.object)}
        WHERE ${where.join(' AND ')}
        ORDER BY _upl_created_at ASC NULLS LAST, id ASC
        ${params.forUpdate ? 'FOR UPDATE' : ''}
        `,
        values
    )
    return rows
}

export const selectActiveRows = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        workspaceId: string | null
        forUpdate?: boolean
    }
): Promise<Array<Record<string, unknown>>> => {
    const values: unknown[] = []
    return executor.query<Record<string, unknown>>(
        `
        SELECT *
        FROM ${tableIdent(params.schemaName, params.contract.object)}
        WHERE ${activeWorkspaceWhere(params.workspaceId, values)}
        ORDER BY _upl_created_at ASC NULLS LAST, id ASC
        ${params.forUpdate ? 'FOR UPDATE' : ''}
        `,
        values
    )
}

export const selectRowById = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        rowId: string
        workspaceId: string | null
        forUpdate?: boolean
    }
): Promise<Record<string, unknown> | null> => {
    const values: unknown[] = [params.rowId]
    const rows = await executor.query<Record<string, unknown>>(
        `
        SELECT *
        FROM ${tableIdent(params.schemaName, params.contract.object)}
        WHERE id = $1
          AND ${activeWorkspaceWhere(params.workspaceId, values)}
        ${params.forUpdate ? 'FOR UPDATE' : ''}
        `,
        values
    )
    return rows[0] ?? null
}

export const insertRow = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        values: Record<string, unknown>
        workspaceId: string | null
        userId: string
        trustedAggregate?: boolean
    }
): Promise<string> => {
    if (params.trustedAggregate) assertInterpretationNetworkAggregatePolicyValid(params.contract.object.config)
    else assertInterpretationNetworkEntityMutationAllowed(params.contract.object.config)
    const generatedId = generateUuidV7()
    const columns: string[] = ['id']
    const placeholders: string[] = ['$1']
    const values: unknown[] = [generatedId]

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

    const [inserted] = await executor.query<{ id: string }>(
        `
        INSERT INTO ${tableIdent(params.schemaName, params.contract.object)}
            (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING id
        `,
        values
    )

    if (!inserted?.id) {
        throw new InterpretationNetworkCommandError(500, 'INTERPRETATION_NETWORK_INSERT_FAILED', 'Failed to create runtime row')
    }
    return inserted.id
}

export const updateRowValues = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        rowId: string
        values: Record<string, unknown>
        workspaceId: string | null
        userId: string
        expectedVersion?: number
        trustedAggregate?: boolean
    }
): Promise<Record<string, unknown>> => {
    if (params.trustedAggregate) assertInterpretationNetworkAggregatePolicyValid(params.contract.object.config)
    else assertInterpretationNetworkEntityMutationAllowed(params.contract.object.config)
    const setClauses: string[] = []
    const queryValues: unknown[] = []

    for (const [column, value] of Object.entries(params.values)) {
        if (!IDENTIFIER_REGEX.test(column)) continue
        queryValues.push(value)
        setClauses.push(`${quoteIdentifier(column)} = $${queryValues.length}`)
    }

    queryValues.push(params.userId)
    setClauses.push(`_upl_updated_by = $${queryValues.length}`)
    setClauses.push('_upl_updated_at = NOW()')
    setClauses.push('_upl_version = COALESCE(_upl_version, 1) + 1')

    queryValues.push(params.rowId)
    const where = ['id = $' + queryValues.length]
    if (params.expectedVersion !== undefined) {
        queryValues.push(params.expectedVersion)
        where.push(`COALESCE(_upl_version, 1) = $${queryValues.length}`)
    }
    where.push(activeWorkspaceWhere(params.workspaceId, queryValues))

    const [updated] = await executor.query<Record<string, unknown>>(
        `
        UPDATE ${tableIdent(params.schemaName, params.contract.object)}
        SET ${setClauses.join(', ')}
        WHERE ${where.join(' AND ')}
        RETURNING *
        `,
        queryValues
    )

    if (!updated) {
        throw new InterpretationNetworkCommandError(
            params.expectedVersion === undefined ? 404 : 409,
            params.expectedVersion === undefined
                ? interpretationNetworkCommandErrorCodes.templateNotFound
                : interpretationNetworkCommandErrorCodes.versionConflict,
            params.expectedVersion === undefined ? 'Runtime row was not found' : 'Runtime row version conflict',
            params.expectedVersion === undefined ? undefined : { expectedVersion: params.expectedVersion }
        )
    }

    return updated
}

export const softDeleteRow = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        rowId: string
        workspaceId: string | null
        userId: string
        expectedVersion?: number
        trustedAggregate?: boolean
    }
): Promise<void> => {
    if (params.trustedAggregate) assertInterpretationNetworkAggregatePolicyValid(params.contract.object.config)
    else assertInterpretationNetworkEntityMutationAllowed(params.contract.object.config)
    const values: unknown[] = [params.userId, params.rowId]
    const where = ['id = $2']
    if (params.expectedVersion !== undefined) {
        values.push(params.expectedVersion)
        where.push(`COALESCE(_upl_version, 1) = $${values.length}`)
    }
    where.push(activeWorkspaceWhere(params.workspaceId, values))

    const updated = await executor.query<{ id: string }>(
        `
        UPDATE ${tableIdent(params.schemaName, params.contract.object)}
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
        RETURNING id
        `,
        values
    )

    if (updated.length === 0) {
        throw new InterpretationNetworkCommandError(
            params.expectedVersion === undefined ? 404 : 409,
            params.expectedVersion === undefined
                ? interpretationNetworkCommandErrorCodes.templateNotFound
                : interpretationNetworkCommandErrorCodes.versionConflict,
            params.expectedVersion === undefined ? 'Runtime row was not found' : 'Runtime row version conflict',
            params.expectedVersion === undefined ? undefined : { expectedVersion: params.expectedVersion }
        )
    }
}

export const softDeleteChildRows = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        parentIds: string[]
        workspaceId: string | null
        userId: string
        trustedAggregate?: boolean
    }
): Promise<string[]> => {
    const parentIds = [...new Set(params.parentIds.filter((id) => UUID_REGEX.test(id)))]
    if (parentIds.length === 0) return []
    if (params.trustedAggregate) assertInterpretationNetworkAggregatePolicyValid(params.contract.object.config)
    else assertInterpretationNetworkEntityMutationAllowed(params.contract.object.config)
    const values: unknown[] = [params.userId, parentIds]
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE ${childTableIdent(params.schemaName, params.contract)}
        SET _upl_deleted = true,
            _app_deleted = true,
            _upl_deleted_at = NOW(),
            _app_deleted_at = NOW(),
            _upl_deleted_by = $1,
            _app_deleted_by = $1,
            _upl_updated_by = $1,
            _upl_updated_at = NOW(),
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE _tp_parent_id = ANY($2::uuid[])
          AND ${activeWorkspaceWhere(params.workspaceId, values)}
        RETURNING id
        `,
        values
    )
    return rows.map((row) => row.id)
}

export const prepareObjectValues = (
    contract: ObjectContract,
    data: Record<string, unknown>,
    options?: {
        serverValues?: Record<string, unknown>
        allowedCodenames?: Set<string>
    }
): Record<string, unknown> => {
    const values: Record<string, unknown> = {}
    const serverValueColumns = new Set(Object.keys(options?.serverValues ?? {}))

    for (const field of Object.values(contract.fields)) {
        if (!IDENTIFIER_REGEX.test(field.column_name)) continue
        if (options?.allowedCodenames && !options.allowedCodenames.has(field.codename)) continue

        const hasColumnValue = Object.prototype.hasOwnProperty.call(data, field.column_name)
        const hasCodenameValue = Object.prototype.hasOwnProperty.call(data, field.codename)
        const raw = hasColumnValue ? data[field.column_name] : hasCodenameValue ? data[field.codename] : undefined
        if (raw === undefined) continue

        try {
            values[field.column_name] = normalizeConfiguredRuntimeJsonValue(
                coerceRuntimeValue(raw, field.data_type, field.validation_rules ?? undefined),
                {
                    data_type: field.data_type,
                    ui_config: field.ui_config ?? undefined
                }
            )
        } catch (error) {
            const formatError = toRuntimeInputFormatErrorBody(error)
            throw new InterpretationNetworkCommandError(
                400,
                interpretationNetworkCommandErrorCodes.invalidMaterial,
                formatError?.error ?? `Invalid value for ${field.codename}`
            )
        }
    }

    for (const [column, value] of Object.entries(options?.serverValues ?? {})) {
        if (IDENTIFIER_REGEX.test(column)) {
            values[column] = value
        }
    }

    const requiredField = Object.values(contract.fields).find((field) => {
        if (field.data_type === 'BOOLEAN' || serverValueColumns.has(field.column_name)) return false
        if (options?.allowedCodenames && !options.allowedCodenames.has(field.codename)) return false
        return (field.is_required === true || field.validation_rules?.required === true) && values[field.column_name] === undefined
    })
    if (requiredField) {
        throw new InterpretationNetworkCommandError(
            400,
            interpretationNetworkCommandErrorCodes.invalidMaterial,
            `Required field missing: ${requiredField.codename}`
        )
    }

    return values
}

export const insertChildRows = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        parentId: string
        rows: Array<Record<string, unknown>>
        workspaceId: string | null
        userId: string
        trustedAggregate?: boolean
    }
): Promise<void> => {
    if (params.rows.length === 0) return
    if (params.trustedAggregate) assertInterpretationNetworkAggregatePolicyValid(params.contract.object.config)
    else assertInterpretationNetworkEntityMutationAllowed(params.contract.object.config)

    const childAttrsByColumn = new Map<string, RuntimeTableChildComponentMeta>(
        Object.values(params.contract.childFields).map((field) => [
            field.column_name,
            {
                column_name: field.column_name,
                data_type: field.data_type,
                validation_rules: field.validation_rules ?? undefined
            }
        ])
    )
    const dataColumns = [
        ...new Set(
            params.rows.flatMap((row) =>
                Object.keys(row).filter((column) => IDENTIFIER_REGEX.test(column) && childAttrsByColumn.has(column))
            )
        )
    ]
    const headerColumns = ['id', '_tp_parent_id', '_tp_sort_order']
    if (params.workspaceId) headerColumns.push(quoteIdentifier('workspace_id'))
    headerColumns.push('_upl_created_by')
    headerColumns.push('_upl_updated_by')

    const allColumns = [...headerColumns, ...dataColumns.map((column) => quoteIdentifier(column))]
    const values: unknown[] = []
    const tuples: string[] = []

    for (let rowIndex = 0; rowIndex < params.rows.length; rowIndex++) {
        const row = params.rows[rowIndex]
        const tuple: string[] = []
        values.push(generateUuidV7())
        tuple.push(`$${values.length}`)
        values.push(params.parentId)
        tuple.push(`$${values.length}`)
        values.push(typeof row._tp_sort_order === 'number' ? row._tp_sort_order : rowIndex)
        tuple.push(`$${values.length}`)
        if (params.workspaceId) {
            values.push(params.workspaceId)
            tuple.push(`$${values.length}`)
        }
        values.push(params.userId)
        tuple.push(`$${values.length}`)
        values.push(params.userId)
        tuple.push(`$${values.length}`)
        for (const column of dataColumns) {
            values.push(normalizeRuntimeTableChildInsertValueByMeta(row[column] ?? null, childAttrsByColumn.get(column)))
            tuple.push(`$${values.length}`)
        }
        tuples.push(`(${tuple.join(', ')})`)
    }

    const inserted = await executor.query<{ id: string }>(
        `
        INSERT INTO ${childTableIdent(params.schemaName, params.contract)}
            (${allColumns.join(', ')})
        VALUES ${tuples.join(', ')}
        RETURNING id
        `,
        values
    )

    if (inserted.length !== params.rows.length) {
        throw new InterpretationNetworkCommandError(
            500,
            'INTERPRETATION_NETWORK_CHILD_INSERT_FAILED',
            'Failed to create all runtime child rows'
        )
    }
}

export const loadChildRows = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        parentId: string
        workspaceId: string | null
        forUpdate?: boolean
    }
): Promise<Array<Record<string, unknown>>> => {
    const values: unknown[] = [params.parentId]
    const columns = [
        'id',
        '_tp_sort_order',
        '_upl_version',
        ...Object.values(params.contract.childFields)
            .filter((field) => IDENTIFIER_REGEX.test(field.column_name))
            .map((field) => quoteIdentifier(field.column_name))
    ]
    return executor.query<Record<string, unknown>>(
        `
        SELECT ${columns.join(', ')}
        FROM ${childTableIdent(params.schemaName, params.contract)}
        WHERE _tp_parent_id = $1
          AND ${activeWorkspaceWhere(params.workspaceId, values)}
        ORDER BY _tp_sort_order ASC, _upl_created_at ASC NULLS LAST, id ASC
        ${params.forUpdate ? 'FOR UPDATE' : ''}
        `,
        values
    )
}

export const readTemplateIncludesMaterials = (row: Record<string, unknown>, contract: ObjectContract): boolean => {
    const policyColumn = assertColumn(getField(contract, 'MaterialPolicy'), 'TableTemplate.MaterialPolicy')
    const policyValue = row[policyColumn]
    if (policyValue === TEMPLATE_POLICY_WITH_MATERIALS) return true
    if (policyValue === TEMPLATE_POLICY_STRUCTURE_ONLY) return false
    throw new InterpretationNetworkCommandError(
        409,
        interpretationNetworkCommandErrorCodes.invalidMatrix,
        'Table Template material policy is missing or unsupported'
    )
}

export const loadInterpretationsForStructure = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        surface: RuntimeSurfaceReady
        structureId: string
        workspaceId: string | null
        forUpdate?: boolean
    }
): Promise<Array<Record<string, unknown>>> => {
    const parentColumn = assertColumn(
        getField(params.surface.contracts.Interpretation, 'ParentStructure'),
        'Interpretation.ParentStructure'
    )
    const values: unknown[] = [params.structureId]
    const rows = await executor.query<Record<string, unknown>>(
        `
        SELECT *
        FROM ${tableIdent(params.schemaName, params.surface.contracts.Interpretation.object)}
        WHERE ${quoteIdentifier(parentColumn)} = $1
          AND ${activeWorkspaceWhere(params.workspaceId, values)}
        ORDER BY _upl_created_at ASC NULLS LAST, id ASC
        ${params.forUpdate ? 'FOR UPDATE' : ''}
        `,
        values
    )
    return rows
}

export const getRootCellId = (rows: Array<Record<string, unknown>>, contract: ObjectContract): string | null => {
    const cellIdColumn = assertColumn(getChildField(contract, 'CellId'), 'InterpretationMatrix.CellId')
    const parentCellIdColumn = getChildField(contract, 'ParentCellId')?.column_name
    const rootRows =
        parentCellIdColumn && IDENTIFIER_REGEX.test(parentCellIdColumn)
            ? rows.filter((row) => {
                  const parent = row[parentCellIdColumn]
                  return parent === null || parent === undefined || String(parent).trim() === ''
              })
            : rows

    if (rootRows.length !== 1) return null
    const rootCellId = String(rootRows[0][cellIdColumn] ?? '').trim()
    return rootCellId || null
}

export const assertSingleInterpretation = (
    rows: Array<Record<string, unknown>>,
    code: string,
    message: string
): Record<string, unknown> => {
    if (rows.length !== 1 || !rows[0]?.id) {
        throw new InterpretationNetworkCommandError(409, code, message, { count: rows.length })
    }
    return rows[0]
}

export const loadTemplateRow = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        surface: RuntimeSurfaceReady
        templateId: string
        workspaceId: string | null
        forUpdate?: boolean
    }
): Promise<Record<string, unknown> | null> =>
    selectRowById(executor, {
        schemaName: params.schemaName,
        contract: params.surface.contracts.TableTemplate,
        rowId: params.templateId,
        workspaceId: params.workspaceId,
        forUpdate: params.forUpdate
    })

export const toTemplateSummary = (row: Record<string, unknown>, contract: ObjectContract): TemplateSummary => {
    const nameColumn = assertColumn(getField(contract, 'Name'), 'TableTemplate.Name')
    const descriptionColumn = getField(contract, 'Description')?.column_name
    return {
        id: String(row.id),
        name: row[nameColumn] ?? null,
        description: descriptionColumn ? row[descriptionColumn] ?? null : null,
        includesMaterials: readTemplateIncludesMaterials(row, contract),
        version: Number(row._upl_version ?? 1)
    }
}

export const toRootMatrixRow = (contract: ObjectContract, locale: string): Record<string, unknown> => {
    const data: Record<string, unknown> = {}
    const set = (codename: string, value: unknown) => {
        const column = getChildField(contract, codename)?.column_name
        if (column && IDENTIFIER_REGEX.test(column)) data[column] = value
    }
    const cellId = generateUuidV7()
    const localized = createLocalizedContent(locale, locale === 'ru' ? 'Вселенная' : 'Universe')
    set('CellId', cellId)
    set('ParentCellId', null)
    set('ColKey', `axis-${cellId}`)
    set('RowKey', `axis-${cellId}`)
    set('ColLabel', localized)
    set('RowLabel', localized)
    set('CellValue', localized)
    set('CellDescription', createLocalizedContent(locale, ''))
    set('CellFillColor', null)
    set('TextColor', null)
    set('MaterialRef', null)
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        set(`Border${side}Color`, null)
        set(`Border${side}Width`, '1px')
        set(`Border${side}Style`, 'solid')
    }
    return data
}
