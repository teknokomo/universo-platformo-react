import { generateUuidV7, type DbExecutor } from '@universo-react/utils'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    UUID_REGEX,
    quoteIdentifier,
    formatRuntimeFieldPath,
    getRuntimeInputValue,
    getEnumPresentationMode,
    getSetConstantConfig,
    resolveRefId,
    ensureEnumerationValueBelongsToTarget,
    coerceRuntimeValue,
    toRuntimeInputFormatErrorBody
} from '../shared/runtimeHelpers'
import type { resolveTabularContext } from '../shared/runtimeHelpers'

export const resolveHierarchyAttrs = (
    tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>
): { identityAttr: (typeof tc.childAttrs)[number]; parentAttr: (typeof tc.childAttrs)[number] } | null => {
    const parentAttr = tc.childAttrs.find(
        (attr) => typeof attr.ui_config?.hierarchyIdentityField === 'string' && attr.ui_config.hierarchyIdentityField.trim()
    )
    if (!parentAttr) return null

    const identityField = String(parentAttr.ui_config?.hierarchyIdentityField).trim()
    const identityAttr = tc.childAttrs.find((attr) => attr.codename === identityField || attr.column_name === identityField)
    if (!identityAttr || !IDENTIFIER_REGEX.test(identityAttr.column_name) || !IDENTIFIER_REGEX.test(parentAttr.column_name)) {
        throw new UpdateFailure(400, { error: 'Invalid hierarchy metadata' })
    }
    return { identityAttr, parentAttr }
}

export const validateTabularHierarchy = async (
    manager: DbExecutor,
    tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
    recordId: string,
    runtimeRowCondition: string,
    updates: Array<{ childRowId?: string; data: Record<string, unknown> }>
): Promise<void> => {
    const hierarchyAttrs = resolveHierarchyAttrs(tc)
    if (!hierarchyAttrs) return
    const { identityAttr, parentAttr } = hierarchyAttrs

    const rows = (await manager.query(
        `
    SELECT id,
           ${quoteIdentifier(identityAttr.column_name)} AS identity,
           ${quoteIdentifier(parentAttr.column_name)} AS parent_identity
    FROM ${tc.tabTableIdent}
    WHERE _tp_parent_id = $1
      AND ${runtimeRowCondition}
    FOR UPDATE
  `,
        [recordId]
    )) as Array<{ id: string; identity?: unknown; parent_identity?: unknown }>
    const identityByRowId = new Map<string, string>()
    const parentByIdentity = new Map<string, string | null>()

    for (const row of rows) {
        if (typeof row.identity !== 'string' || !UUID_REGEX.test(row.identity)) {
            throw new UpdateFailure(400, { error: 'Invalid hierarchy identity' })
        }
        if (parentByIdentity.has(row.identity)) {
            throw new UpdateFailure(400, { error: 'Duplicate hierarchy identity' })
        }
        identityByRowId.set(row.id, row.identity)
        parentByIdentity.set(row.identity, typeof row.parent_identity === 'string' && row.parent_identity ? row.parent_identity : null)
    }

    const proposedParentByIdentity = new Map(parentByIdentity)
    for (const update of updates) {
        const identityInput = getRuntimeInputValue(update.data, identityAttr.column_name, identityAttr.codename)
        const submittedIdentity = typeof identityInput.value === 'string' && identityInput.value ? identityInput.value : undefined
        const existingIdentity = update.childRowId ? identityByRowId.get(update.childRowId) : undefined
        if (update.childRowId && !existingIdentity) continue
        if (identityInput.hasUserValue && !submittedIdentity) {
            throw new UpdateFailure(400, { error: 'Invalid hierarchy identity' })
        }
        if (identityInput.hasUserValue && existingIdentity && submittedIdentity !== existingIdentity) {
            throw new UpdateFailure(400, { error: 'Hierarchy identity cannot be changed' })
        }
        const identity = submittedIdentity ?? existingIdentity
        const parentInput = getRuntimeInputValue(update.data, parentAttr.column_name, parentAttr.codename)
        if (!identity || !UUID_REGEX.test(identity)) {
            throw new UpdateFailure(400, { error: 'Invalid hierarchy identity' })
        }
        if (!update.childRowId && parentByIdentity.has(identity)) {
            throw new UpdateFailure(400, { error: 'Duplicate hierarchy identity' })
        }
        if (!parentInput.hasUserValue) {
            if (!update.childRowId) proposedParentByIdentity.set(identity, null)
            continue
        }
        const parentIdentity = parentInput.value == null || parentInput.value === '' ? null : String(parentInput.value)
        if (parentIdentity !== null && !UUID_REGEX.test(parentIdentity)) {
            throw new UpdateFailure(400, { error: 'Invalid hierarchy parent identity' })
        }
        proposedParentByIdentity.set(identity, parentIdentity)
    }

    const verified = new Set<string>()
    for (const [identity, parentIdentity] of proposedParentByIdentity) {
        if (parentIdentity === null) continue
        if (!proposedParentByIdentity.has(parentIdentity)) {
            throw new UpdateFailure(400, { error: 'Hierarchy parent does not exist' })
        }
        if (verified.has(identity)) continue
        const visited = new Set<string>([identity])
        let current: string | null = parentIdentity
        while (current) {
            if (verified.has(current)) break
            if (visited.has(current)) {
                throw new UpdateFailure(400, { error: 'Hierarchy cycle is not allowed' })
            }
            visited.add(current)
            current = proposedParentByIdentity.get(current) ?? null
        }
        for (const id of visited) {
            verified.add(id)
        }
    }
}

export const validateTabularCoordinates = async (
    manager: DbExecutor,
    tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
    recordId: string,
    runtimeRowCondition: string,
    updates: Array<{ childRowId?: string; data: Record<string, unknown> }>
): Promise<void> => {
    if (tc.tableAttr.validation_rules?.matrixUniqueCoordinates !== true) return
    const rowKeyAttr = tc.childAttrs.find((attr) => attr.codename === 'RowKey' || attr.column_name === 'RowKey')
    const colKeyAttr = tc.childAttrs.find((attr) => attr.codename === 'ColKey' || attr.column_name === 'ColKey')
    if (!rowKeyAttr || !colKeyAttr) return
    if (!IDENTIFIER_REGEX.test(rowKeyAttr.column_name) || !IDENTIFIER_REGEX.test(colKeyAttr.column_name)) {
        throw new UpdateFailure(400, { error: 'Invalid coordinate metadata' })
    }

    const rows = (await manager.query(
        `
    SELECT id,
           ${quoteIdentifier(rowKeyAttr.column_name)} AS row_key,
           ${quoteIdentifier(colKeyAttr.column_name)} AS col_key
    FROM ${tc.tabTableIdent}
    WHERE _tp_parent_id = $1
      AND ${runtimeRowCondition}
    FOR UPDATE
  `,
        [recordId]
    )) as Array<{ id: string; row_key?: unknown; col_key?: unknown }>

    const proposedCoordinates = new Map<string, { rowKey: string | null; colKey: string | null }>()
    for (const row of rows) {
        proposedCoordinates.set(row.id, {
            rowKey: typeof row.row_key === 'string' ? row.row_key : null,
            colKey: typeof row.col_key === 'string' ? row.col_key : null
        })
    }

    let newRowIndex = 0
    for (const update of updates) {
        const rowId = update.childRowId ?? `__new_${newRowIndex++}`
        const existing = update.childRowId ? proposedCoordinates.get(update.childRowId) : undefined
        const rowInput = getRuntimeInputValue(update.data, rowKeyAttr.column_name, rowKeyAttr.codename)
        const colInput = getRuntimeInputValue(update.data, colKeyAttr.column_name, colKeyAttr.codename)
        const nextRowKey = rowInput.hasUserValue ? (typeof rowInput.value === 'string' ? rowInput.value : null) : existing?.rowKey ?? null
        const nextColKey = colInput.hasUserValue ? (typeof colInput.value === 'string' ? colInput.value : null) : existing?.colKey ?? null

        proposedCoordinates.set(rowId, { rowKey: nextRowKey, colKey: nextColKey })
    }

    const ownerByCoordinate = new Map<string, string>()
    for (const [rowId, coordinate] of proposedCoordinates) {
        if (coordinate.rowKey === null || coordinate.colKey === null) continue
        const key = `${coordinate.rowKey}\u0000${coordinate.colKey}`
        const owner = ownerByCoordinate.get(key)
        if (owner && owner !== rowId) {
            throw new UpdateFailure(409, { error: 'Duplicate tabular coordinates' })
        }
        ownerByCoordinate.set(key, rowId)
    }
}

export const assertAllowedUniformTabularUpdates = (
    tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
    uniformUpdates: Array<{ data: Record<string, unknown> }>
): void => {
    if (uniformUpdates.length === 0) return
    if (tc.tableAttr.validation_rules?.matrixUniqueCoordinates !== true) {
        throw new UpdateFailure(400, { error: 'Uniform tabular updates are available only for Matrix axis labels' })
    }

    const allowedFields = new Set<string>()
    for (const codename of ['RowLabel', 'ColLabel']) {
        const attr = tc.childAttrs.find((field) => field.codename === codename || field.column_name === codename)
        if (attr) {
            allowedFields.add(attr.codename)
            allowedFields.add(attr.column_name)
        }
    }

    for (const update of uniformUpdates) {
        const [field] = Object.keys(update.data)
        if (!field || !allowedFields.has(field)) {
            throw new UpdateFailure(400, { error: 'Uniform tabular updates are available only for Matrix axis labels' })
        }
    }
}

export const prepareHierarchyCreateData = (
    tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
    data: Record<string, unknown>
): Record<string, unknown> => {
    const hierarchyAttrs = resolveHierarchyAttrs(tc)
    if (!hierarchyAttrs) return data

    const { identityAttr } = hierarchyAttrs
    const generatedIdentity = generateUuidV7()
    return {
        ...data,
        [identityAttr.column_name]: generatedIdentity,
        [identityAttr.codename]: generatedIdentity
    }
}

export const isServerOwnedChildAttr = (attr: { ui_config?: Record<string, unknown> | null }): boolean =>
    attr.ui_config?.serverOwned === true

export const assertNoClientSuppliedServerOwnedChildFields = (
    tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
    data: Record<string, unknown>
): void => {
    const serverOwnedAttr = tc.childAttrs.find(
        (attr) => isServerOwnedChildAttr(attr) && getRuntimeInputValue(data, attr.column_name, attr.codename).hasUserValue
    )
    if (!serverOwnedAttr) return
    throw new UpdateFailure(400, {
        error: `Field is server-owned: ${formatRuntimeFieldPath(tc.tableAttr.codename, serverOwnedAttr.codename)}`
    })
}

export const assertNoGenericMatrixPlacement = (
    tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
    data: Record<string, unknown>
): void => {
    if (tc.tableAttr.validation_rules?.matrixUniqueCoordinates !== true) return
    if (!Object.prototype.hasOwnProperty.call(data, '_tp_sort_order')) return
    throw new UpdateFailure(400, {
        error: 'Matrix placement is server-owned; use the Matrix cell command'
    })
}

export const buildChildRowUpdate = async (
    manager: DbExecutor,
    schemaIdent: string,
    tc: Exclude<Awaited<ReturnType<typeof resolveTabularContext>>, { error: string }>,
    data: Record<string, unknown>,
    userId: string
): Promise<{ setClauses: string[]; values: unknown[]; nextParamIndex: number } | { error: Record<string, unknown> }> => {
    const setClauses: string[] = []
    const values: unknown[] = []
    let pIdx = 1

    for (const cAttr of tc.childAttrs) {
        if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue
        const childFieldPath = formatRuntimeFieldPath(tc.tableAttr.codename, cAttr.codename)
        const { hasUserValue, value: raw } = getRuntimeInputValue(data, cAttr.column_name, cAttr.codename)
        if (raw === undefined) continue
        if (isServerOwnedChildAttr(cAttr) && hasUserValue) {
            return { error: { error: `Field is server-owned: ${childFieldPath}` } }
        }
        let normalizedRaw = raw
        if (
            cAttr.data_type === 'REF' &&
            cAttr.target_object_kind === 'enumeration' &&
            getEnumPresentationMode(cAttr.ui_config) === 'label'
        ) {
            return { error: { error: `Field is read-only: ${childFieldPath}` } }
        }
        const setConstantConfig =
            cAttr.data_type === 'REF' && cAttr.target_object_kind === 'set' ? getSetConstantConfig(cAttr.ui_config) : null
        if (setConstantConfig) {
            const providedRefId = resolveRefId(raw)
            if (!providedRefId) {
                normalizedRaw = setConstantConfig.id
            } else if (providedRefId !== setConstantConfig.id) {
                return { error: { error: `Field is read-only: ${childFieldPath}` } }
            } else {
                normalizedRaw = setConstantConfig.id
            }
        }
        if (normalizedRaw === null && cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
            return { error: { error: `Required field cannot be set to null: ${childFieldPath}` } }
        }
        try {
            const coerced = coerceRuntimeValue(normalizedRaw, cAttr.data_type, cAttr.validation_rules)
            if (
                cAttr.data_type === 'REF' &&
                cAttr.target_object_kind === 'enumeration' &&
                typeof cAttr.target_object_id === 'string' &&
                coerced
            ) {
                await ensureEnumerationValueBelongsToTarget(manager, schemaIdent, String(coerced), cAttr.target_object_id)
            }
            setClauses.push(`${quoteIdentifier(cAttr.column_name)} = $${pIdx}`)
            values.push(coerced)
            pIdx++
        } catch (err) {
            const formatError = toRuntimeInputFormatErrorBody(err)
            if (formatError) {
                return { error: formatError }
            }
            return {
                error: {
                    error: `Invalid value for ${childFieldPath}: ${err instanceof Error ? err.message : String(err)}`
                }
            }
        }
    }

    if (typeof data._tp_sort_order === 'number') {
        setClauses.push(`_tp_sort_order = $${pIdx}`)
        values.push(data._tp_sort_order)
        pIdx++
    }

    if (setClauses.length === 0) {
        return { error: { error: 'No valid fields to update' } }
    }

    setClauses.push('_upl_updated_at = NOW()')
    setClauses.push(`_upl_updated_by = $${pIdx}`)
    values.push(userId)
    pIdx++
    setClauses.push('_upl_version = COALESCE(_upl_version, 1) + 1')

    return { setClauses, values, nextParamIndex: pIdx }
}

// ============ LIST CHILD ROWS ============
