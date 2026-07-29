import { qSchemaTable } from '@universo-react/database'
import { LocalizedStringAllowEmptySchema, LocalizedStringSchema, type InterpretationNetworkStructureMode } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { createLocalizedContent, ensureVLC, generateUuidV7 } from '@universo-react/utils'
import { z } from 'zod'
import {
    IDENTIFIER_REGEX,
    UUID_REGEX,
    coerceRuntimeValue,
    normalizeConfiguredRuntimeJsonValue,
    normalizeRuntimeTableChildInsertValueByMeta,
    quoteIdentifier,
    toRuntimeInputFormatErrorBody,
    type RuntimeDataType,
    type RuntimeTableChildComponentMeta
} from '../../shared/runtimeHelpers'

export const INTERPRETATION_NETWORK_WIDGET_KEY = 'interpretationNetworkWorkspace'
export const SYSTEM_STRUCTURE_KEY = 'primary'
export const SYSTEM_STRUCTURE_NAME = createLocalizedContent('en', 'System structure')
export const SYSTEM_INTERPRETATION_TITLE = createLocalizedContent('en', 'System matrix')

export const TEMPLATE_POLICY_STRUCTURE_ONLY = 'structureOnly'
export const TEMPLATE_POLICY_WITH_MATERIALS = 'withMaterials'

export const interpretationNetworkCommandErrorCodes = {
    featureNotReady: 'INTERPRETATION_NETWORK_FEATURE_NOT_READY',
    commandNotImplemented: 'INTERPRETATION_NETWORK_COMMAND_NOT_IMPLEMENTED',
    invalidBody: 'INTERPRETATION_NETWORK_INVALID_BODY',
    invalidParams: 'INTERPRETATION_NETWORK_INVALID_PARAMS',
    duplicateSystemStructure: 'INTERPRETATION_NETWORK_DUPLICATE_SYSTEM_STRUCTURE',
    malformedSystemStructure: 'INTERPRETATION_NETWORK_MALFORMED_SYSTEM_STRUCTURE',
    unsupportedMode: 'INTERPRETATION_NETWORK_UNSUPPORTED_STRUCTURE_MODE',
    sourceNotFound: 'INTERPRETATION_NETWORK_SOURCE_NOT_FOUND',
    templateNotFound: 'INTERPRETATION_NETWORK_TEMPLATE_NOT_FOUND',
    versionConflict: 'INTERPRETATION_NETWORK_VERSION_CONFLICT',
    invalidMatrix: 'INTERPRETATION_NETWORK_INVALID_MATRIX',
    missingMetadata: 'INTERPRETATION_NETWORK_MISSING_METADATA',
    nonSystemStructuresExist: 'INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST',
    invalidMaterial: 'INTERPRETATION_NETWORK_INVALID_MATERIAL',
    invalidCell: 'INTERPRETATION_NETWORK_INVALID_CELL',
    permissionDenied: 'INTERPRETATION_NETWORK_PERMISSION_DENIED',
    rowNotFound: 'INTERPRETATION_NETWORK_ROW_NOT_FOUND'
} as const

export class InterpretationNetworkCommandError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message)
        this.name = 'InterpretationNetworkCommandError'
    }
}

export const interpretationNetworkEnsureSystemStructureRequestSchema = z.object({ locale: z.string().optional() }).strict()

const localizedRequiredTextSchema = z.preprocess((value) => ensureVLC(value, 'en') ?? value, LocalizedStringSchema)
const localizedOptionalTextSchema = z.preprocess((value) => ensureVLC(value, 'en') ?? value, LocalizedStringAllowEmptySchema.optional())

export const interpretationNetworkStructureCreateRequestSchema = z
    .object({
        name: localizedRequiredTextSchema,
        description: localizedOptionalTextSchema,
        locale: z.string().optional()
    })
    .strict()

export const interpretationNetworkTemplateSaveRequestSchema = z
    .object({
        sourceStructureId: z.string().uuid(),
        templateName: localizedRequiredTextSchema,
        description: localizedOptionalTextSchema,
        includeMaterials: z.boolean(),
        expectedVersion: z.number().int().positive().optional(),
        locale: z.string().optional()
    })
    .strict()

export const interpretationNetworkTemplateUpdateRequestSchema = z
    .object({
        templateName: localizedRequiredTextSchema,
        description: localizedOptionalTextSchema,
        expectedVersion: z.number().int().positive().optional(),
        locale: z.string().optional()
    })
    .strict()

export const interpretationNetworkTemplateDeleteRequestSchema = z
    .object({
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

export const interpretationNetworkTemplateInstantiateRequestSchema = z
    .object({
        structureName: localizedRequiredTextSchema,
        description: localizedOptionalTextSchema,
        expectedVersion: z.number().int().positive().optional(),
        locale: z.string().optional()
    })
    .strict()

export const interpretationNetworkStructureDeleteRequestSchema = z
    .object({
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

export const interpretationNetworkStructureRouteParamsSchema = z
    .object({
        applicationId: z.string().min(1),
        structureId: z.string().uuid()
    })
    .strict()

export const interpretationNetworkMaterialCreateRequestSchema = z
    .object({
        interpretationId: z.string().uuid(),
        matrixRowId: z.string().uuid(),
        cellId: z.string().trim().min(1).max(255),
        data: z.record(z.unknown()),
        expectedVersion: z.number().int().positive().optional()
    })
    .strict()

const interpretationNetworkCellPlacementSchema = z
    .object({
        parentCellId: z.string().uuid().nullable().optional(),
        rowKey: z.string().trim().min(1).max(64).optional(),
        colKey: z.string().trim().min(1).max(64).optional(),
        sortOrder: z.number().int().nonnegative().max(2_147_483_647).optional()
    })
    .strict()

export const interpretationNetworkMatrixCellCreateRequestSchema = z
    .object({
        interpretationId: z.string().uuid(),
        data: z.record(z.unknown()),
        placement: interpretationNetworkCellPlacementSchema
    })
    .strict()

export const interpretationNetworkMatrixCellsMoveRequestSchema = z
    .object({
        interpretationId: z.string().uuid(),
        updates: z
            .array(
                z
                    .object({
                        matrixRowId: z.string().uuid(),
                        expectedVersion: z.number().int().positive().optional(),
                        placement: interpretationNetworkCellPlacementSchema,
                        data: z.record(z.unknown()).optional()
                    })
                    .strict()
            )
            .min(1)
            .max(5000)
    })
    .strict()

export type WidgetRow = {
    id: string
    layout_id: string
    widget_key: string
    config: Record<string, unknown> | null
}

export type ObjectRow = {
    id: string
    codename: string
    table_name: string
    config?: Record<string, unknown> | null
}

export type ComponentRow = {
    id: string
    codename: string
    column_name: string
    data_type: RuntimeDataType
    parent_component_id?: string | null
    validation_rules?: Record<string, unknown> | null
    ui_config?: Record<string, unknown> | null
    is_required?: boolean | null
}

export type MaterialCreateResult = {
    id: string
    matrixRowId: string
}

export type ObjectContract = {
    object: ObjectRow
    fields: Record<string, ComponentRow>
    table?: ComponentRow
    childFields: Record<string, ComponentRow>
    childTableName?: string
}

export type RuntimeSurfaceReady = {
    applicationId: string
    schemaName: string
    workspaceId: string | null
    layoutId: string
    widgetId: string
    widgetKey: typeof INTERPRETATION_NETWORK_WIDGET_KEY
    widgetConfig: Record<string, unknown>
    structureMode: InterpretationNetworkStructureMode
    featureState: 'ready'
    missing: []
    contracts: {
        Structure: ObjectContract
        Interpretation: ObjectContract
        Material: ObjectContract
        TableTemplate: ObjectContract
    }
    resolvedObjects: {
        Structure: string
        Interpretation: string
        Material: string
        TableTemplate: string
    }
}

export type InterpretationNetworkRuntimeSurface =
    | RuntimeSurfaceReady
    | {
          applicationId: string
          schemaName: string
          workspaceId: string | null
          layoutId: string | null
          widgetId: string | null
          widgetKey: typeof INTERPRETATION_NETWORK_WIDGET_KEY
          widgetConfig: Record<string, unknown>
          structureMode: InterpretationNetworkStructureMode
          featureState: 'missing-widget' | 'missing-metadata' | 'ambiguous-widget'
          missing: string[]
          resolvedObjects: Record<string, string>
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

export const getField = (contract: ObjectContract, codename: string): ComponentRow | undefined => contract.fields[codename]

export const getChildField = (contract: ObjectContract, codename: string): ComponentRow | undefined => contract.childFields[codename]

export const findFieldByColumnOrCodename = (contract: ObjectContract, key: string): ComponentRow | undefined =>
    Object.values(contract.fields).find((field) => field.column_name === key || field.codename === key)

export const assertColumn = (field: ComponentRow | undefined, label: string): string => {
    if (!field?.column_name || !IDENTIFIER_REGEX.test(field.column_name)) {
        throw new InterpretationNetworkCommandError(
            501,
            interpretationNetworkCommandErrorCodes.missingMetadata,
            'Interpretation Network metadata is incomplete',
            { missing: [label] }
        )
    }
    return field.column_name
}

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

export const activeWorkspaceWhere = (workspaceId: string | null, params: unknown[], alias?: string): string => {
    const prefix = alias ? `${alias}.` : ''
    const conditions = [`${prefix}_upl_deleted = false`, `${prefix}_app_deleted = false`]
    if (workspaceId) {
        params.push(workspaceId)
        conditions.push(`${prefix}${quoteIdentifier('workspace_id')} = $${params.length}`)
    }
    return conditions.join(' AND ')
}

const lockKey = (surface: RuntimeSurfaceReady, command: string): [string, string] => [
    `interpretation-network:${command}`,
    `${surface.schemaName}:${surface.workspaceId ?? 'global'}:${surface.widgetId}`
]

export const acquireCommandLock = async (executor: DbExecutor, surface: RuntimeSurfaceReady, command: string): Promise<void> => {
    const [left, right] = lockKey(surface, command)
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [left, right])
}

/** Serializes structure-mode transitions with Structure aggregate mutations. */
export const acquireStructureModeLock = async (executor: DbExecutor, surface: RuntimeSurfaceReady): Promise<void> => {
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${surface.schemaName}:interpretation-network:structure-mode`])
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
    }
): Promise<string> => {
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
    }
): Promise<Record<string, unknown>> => {
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
    }
): Promise<void> => {
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
    }
): Promise<string[]> => {
    const parentIds = [...new Set(params.parentIds.filter((id) => UUID_REGEX.test(id)))]
    if (parentIds.length === 0) return []
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

export const softDeleteRowsByField = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        field: ComponentRow
        value: string
        workspaceId: string | null
        userId: string
    }
): Promise<string[]> => {
    const column = assertColumn(params.field, params.field.codename)
    const values: unknown[] = [params.userId, params.value]
    const rows = await executor.query<{ id: string }>(
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
        WHERE ${quoteIdentifier(column)} = $2
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
    }
): Promise<void> => {
    if (params.rows.length === 0) return

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

export const loadMaterialsByIds = async (
    executor: DbExecutor,
    params: {
        schemaName: string
        contract: ObjectContract
        materialIds: string[]
        workspaceId: string | null
        forUpdate?: boolean
    }
): Promise<Array<Record<string, unknown>>> => {
    const ids = [...new Set(params.materialIds.filter((id) => UUID_REGEX.test(id)))]
    if (ids.length === 0) return []
    const values: unknown[] = [ids]
    return executor.query<Record<string, unknown>>(
        `
        SELECT *
        FROM ${tableIdent(params.schemaName, params.contract.object)}
        WHERE id = ANY($1::uuid[])
          AND ${activeWorkspaceWhere(params.workspaceId, values)}
        ${params.forUpdate ? 'FOR UPDATE' : ''}
        `,
        values
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
