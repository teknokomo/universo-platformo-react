import type { DbExecutor } from '@universo-react/utils'
import {
    INTERPRETATION_NETWORK_CELL_STYLE_STYLES,
    INTERPRETATION_NETWORK_CELL_STYLE_WIDTHS,
    interpretationNetworkCellStylePolicySchema
} from '@universo-react/types'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import {
    coerceRuntimeValue,
    normalizeConfiguredRuntimeJsonValue,
    normalizeRuntimeTableChildInsertValueByMeta,
    toRuntimeInputFormatErrorBody
} from '../../shared/runtimeHelpers'
import {
    InterpretationNetworkCommandError,
    assertColumn,
    getChildField,
    interpretationNetworkCommandErrorCodes,
    selectRowById,
    type ObjectContract,
    type RuntimeSurfaceReady
} from './runtimeInterpretationNetworkCore'

export const failInvalidCell = (message: string, details?: Record<string, unknown>): never => {
    throw new InterpretationNetworkCommandError(400, interpretationNetworkCommandErrorCodes.invalidCell, message, details)
}

const isServerOwned = (field: { ui_config?: Record<string, unknown> | null }): boolean => field.ui_config?.serverOwned === true

const readInput = (data: Record<string, unknown>, codename: string, columnName: string): { present: boolean; value: unknown } => {
    if (Object.prototype.hasOwnProperty.call(data, columnName)) return { present: true, value: data[columnName] }
    if (Object.prototype.hasOwnProperty.call(data, codename)) return { present: true, value: data[codename] }
    return { present: false, value: undefined }
}

const prepareRuntimeChildValue = (field: ObjectContract['childFields'][string], value: unknown): unknown => {
    const coerced = normalizeConfiguredRuntimeJsonValue(coerceRuntimeValue(value, field.data_type, field.validation_rules ?? undefined), {
        data_type: field.data_type,
        ui_config: field.ui_config ?? undefined
    })
    return normalizeRuntimeTableChildInsertValueByMeta(coerced, {
        column_name: field.column_name,
        data_type: field.data_type,
        validation_rules: field.validation_rules ?? undefined
    })
}

export const prepareClientChildValues = (contract: ObjectContract, data: Record<string, unknown>): Record<string, unknown> => {
    const invalidControlField = Object.keys(data).find(
        (key) => key.startsWith('_tp_') || key.startsWith('_upl_') || key.startsWith('_app_')
    )
    if (invalidControlField) failInvalidCell('Runtime control fields cannot be supplied by the client', { field: invalidControlField })

    const values: Record<string, unknown> = {}
    const knownKeys = new Set<string>()
    for (const field of Object.values(contract.childFields)) {
        knownKeys.add(field.codename)
        knownKeys.add(field.column_name)
        const input = readInput(data, field.codename, field.column_name)
        if (!input.present) continue
        if (isServerOwned(field)) failInvalidCell('Matrix placement fields are server-owned', { field: field.codename })
        try {
            values[field.column_name] = prepareRuntimeChildValue(field, input.value)
        } catch (error) {
            const formatError = toRuntimeInputFormatErrorBody(error)
            failInvalidCell(formatError?.error ?? `Invalid value for ${field.codename}`, { field: field.codename })
        }
    }
    const unknownKey = Object.keys(data).find((key) => !knownKeys.has(key))
    if (unknownKey) failInvalidCell('Unknown Matrix cell field', { field: unknownKey })
    return values
}

export type MatrixColumns = {
    cellId: string
    parentCellId: string
    rowKey: string
    colKey: string
    rowLabel?: string
    colLabel?: string
}

export const resolveMatrixColumns = (contract: ObjectContract): MatrixColumns => ({
    cellId: assertColumn(getChildField(contract, 'CellId'), 'InterpretationMatrix.CellId'),
    parentCellId: assertColumn(getChildField(contract, 'ParentCellId'), 'InterpretationMatrix.ParentCellId'),
    rowKey: assertColumn(getChildField(contract, 'RowKey'), 'InterpretationMatrix.RowKey'),
    colKey: assertColumn(getChildField(contract, 'ColKey'), 'InterpretationMatrix.ColKey'),
    rowLabel: getChildField(contract, 'RowLabel')?.column_name,
    colLabel: getChildField(contract, 'ColLabel')?.column_name
})

export const assertInterpretationExists = async (
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    surface: RuntimeSurfaceReady,
    interpretationId: string
): Promise<void> => {
    const interpretation = await selectRowById(executor, {
        schemaName: ctx.schemaName,
        contract: surface.contracts.Interpretation,
        rowId: interpretationId,
        workspaceId: ctx.currentWorkspaceId,
        forUpdate: true
    })
    if (!interpretation) {
        throw new InterpretationNetworkCommandError(404, interpretationNetworkCommandErrorCodes.rowNotFound, 'Interpretation was not found')
    }
    if (interpretation._upl_locked === true) {
        throw new InterpretationNetworkCommandError(423, interpretationNetworkCommandErrorCodes.invalidCell, 'Interpretation is locked')
    }
}

export const normalizeComparable = (value: unknown): string => {
    if (typeof value === 'string') {
        try {
            return JSON.stringify(JSON.parse(value))
        } catch {
            return value
        }
    }
    return JSON.stringify(value ?? null)
}

const MATRIX_STYLE_FIELDS = {
    CellFillColor: 'fillColor',
    TextColor: 'textColor',
    BorderTopColor: 'borderColor',
    BorderRightColor: 'borderColor',
    BorderBottomColor: 'borderColor',
    BorderLeftColor: 'borderColor',
    BorderTopWidth: 'borderWidth',
    BorderRightWidth: 'borderWidth',
    BorderBottomWidth: 'borderWidth',
    BorderLeftWidth: 'borderWidth',
    BorderTopStyle: 'borderStyle',
    BorderRightStyle: 'borderStyle',
    BorderBottomStyle: 'borderStyle',
    BorderLeftStyle: 'borderStyle'
} as const

export const hasCellStylePolicyFields = (contract: ObjectContract, values: Record<string, unknown>): boolean =>
    Object.keys(MATRIX_STYLE_FIELDS).some((codename) => {
        const field = contract.childFields[codename]
        return Boolean(field && Object.prototype.hasOwnProperty.call(values, field.column_name))
    })

const normalizeStyleColor = (value: unknown): string | null => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value !== 'string') return null
    const color = value.trim()
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu.test(color)) return null
    const normalized = color.toUpperCase()
    if (normalized.length === 4)
        return `#${normalized
            .slice(1)
            .split('')
            .map((digit) => `${digit}${digit}`)
            .join('')}`
    return normalized
}

export const validateTouchedCellStylePolicy = (
    surface: RuntimeSurfaceReady,
    contract: ObjectContract,
    values: Record<string, unknown>,
    previousRow?: Record<string, unknown>
): void => {
    const policyResult = interpretationNetworkCellStylePolicySchema.safeParse(surface.widgetConfig.cellStylePolicy)
    if (!policyResult.success) {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.invalidCell,
            'The active Matrix cell-style policy is invalid'
        )
    }
    const policy = policyResult.data
    for (const [codename, capability] of Object.entries(MATRIX_STYLE_FIELDS)) {
        const field = contract.childFields[codename]
        if (!field || !Object.prototype.hasOwnProperty.call(values, field.column_name)) continue
        const value = values[field.column_name]
        if (previousRow && normalizeComparable(previousRow[field.column_name]) === normalizeComparable(value)) continue
        if (!policy.editable[capability]) {
            throw new InterpretationNetworkCommandError(
                403,
                interpretationNetworkCommandErrorCodes.permissionDenied,
                `Changing ${codename} is disabled by the active Matrix style policy`,
                { field: codename }
            )
        }
        if (value === null || value === undefined || value === '') continue
        if (codename.endsWith('Color')) {
            const normalized = normalizeStyleColor(value)
            if (normalized === null) {
                throw new InterpretationNetworkCommandError(
                    400,
                    interpretationNetworkCommandErrorCodes.invalidCell,
                    'Matrix style value must be a hexadecimal color',
                    { field: codename }
                )
            }
            if (!policy.allowCustomColors && !policy.allowedColors.includes(normalized)) {
                throw new InterpretationNetworkCommandError(
                    400,
                    interpretationNetworkCommandErrorCodes.invalidCell,
                    'Matrix color is not included in the active style palette',
                    { field: codename }
                )
            }
        } else if (codename.endsWith('Width') && !INTERPRETATION_NETWORK_CELL_STYLE_WIDTHS.includes(value as never)) {
            throw new InterpretationNetworkCommandError(
                400,
                interpretationNetworkCommandErrorCodes.invalidCell,
                'Invalid Matrix border width',
                {
                    field: codename
                }
            )
        } else if (codename.endsWith('Style') && !INTERPRETATION_NETWORK_CELL_STYLE_STYLES.includes(value as never)) {
            throw new InterpretationNetworkCommandError(
                400,
                interpretationNetworkCommandErrorCodes.invalidCell,
                'Invalid Matrix border style',
                {
                    field: codename
                }
            )
        }
    }
}

export const validateMatrixState = (rows: Array<Record<string, unknown>>, columns: MatrixColumns): void => {
    const rowByCellId = new Map<string, Record<string, unknown>>()
    const coordinateOwners = new Map<string, string>()
    const rowLabels = new Map<string, string>()
    const colLabels = new Map<string, string>()

    for (const row of rows) {
        const cellId = String(row[columns.cellId] ?? '').trim()
        const rowKey = String(row[columns.rowKey] ?? '').trim()
        const colKey = String(row[columns.colKey] ?? '').trim()
        if (!cellId || !rowKey || !colKey) failInvalidCell('Every Matrix cell must have a server-owned identity and coordinates')
        if (rowByCellId.has(cellId)) failInvalidCell('Duplicate Matrix CellId', { cellId })
        rowByCellId.set(cellId, row)
        const coordinate = `${rowKey}\u0000${colKey}`
        const coordinateOwner = coordinateOwners.get(coordinate)
        if (coordinateOwner) failInvalidCell('Matrix coordinates must be unique', { rowKey, colKey, cellIds: [coordinateOwner, cellId] })
        coordinateOwners.set(coordinate, cellId)

        if (columns.rowLabel) {
            const label = normalizeComparable(row[columns.rowLabel])
            const expected = rowLabels.get(rowKey)
            if (expected !== undefined && expected !== label)
                failInvalidCell('Cells on the same row axis must use the same label', { rowKey })
            rowLabels.set(rowKey, label)
        }
        if (columns.colLabel) {
            const label = normalizeComparable(row[columns.colLabel])
            const expected = colLabels.get(colKey)
            if (expected !== undefined && expected !== label)
                failInvalidCell('Cells on the same column axis must use the same label', { colKey })
            colLabels.set(colKey, label)
        }
    }

    for (const [cellId, row] of rowByCellId) {
        const parentCellId = String(row[columns.parentCellId] ?? '').trim()
        if (!parentCellId) continue
        if (!rowByCellId.has(parentCellId)) failInvalidCell('Matrix parent cell does not exist', { cellId, parentCellId })
        const visited = new Set<string>([cellId])
        let cursor = parentCellId
        while (cursor) {
            if (visited.has(cursor)) failInvalidCell('Matrix hierarchy cycle is not allowed', { cellId })
            visited.add(cursor)
            cursor = String(rowByCellId.get(cursor)?.[columns.parentCellId] ?? '').trim()
        }
    }
}

export const toResponseItem = (row: Record<string, unknown>, contract: ObjectContract): Record<string, unknown> => {
    const item = { ...row }
    for (const field of Object.values(contract.childFields)) item[field.codename] = row[field.column_name] ?? null
    return item
}
