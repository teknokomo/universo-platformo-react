import {
    DEFAULT_LEDGER_CONFIG,
    normalizeLedgerConfig,
    normalizeLedgerConfigFromConfig,
    type LedgerConfig,
    type LedgerProjectionDefinition,
    type LedgerResourceAggregate
} from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import {
    coerceRuntimeValue,
    IDENTIFIER_REGEX,
    pgNumericToNumber,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    UpdateFailure,
    type RuntimeDataType
} from '../shared/runtimeHelpers'

type RuntimeLedgerObjectRow = {
    id: string
    kind: string
    codename: unknown
    presentation?: unknown
    table_name: string | null
    config?: Record<string, unknown> | null
}

type RuntimeLedgerComponentRow = {
    id: string
    codename: unknown
    column_name: string
    data_type: string
    is_required: boolean
    validation_rules?: Record<string, unknown>
}

export type RuntimeLedgerMetadata = {
    id: string
    codename: string
    presentation?: unknown
    config: LedgerConfig | null
    fields: Array<{
        id: string
        codename: string
        columnName: string
        dataType: string
        role: string | null
        aggregate: string | null
        required: boolean
    }>
}

export type RuntimeLedgerProjectionResult = {
    projection: LedgerProjectionDefinition
    rows: Array<Record<string, unknown>>
    limit: number
    offset: number
}

export type RuntimeLedgerFactAppendInput = {
    data: Record<string, unknown>
}

export type RuntimeLedgerFactReverseInput = {
    factIds: string[]
}

export type RuntimeLedgerWriteOrigin = 'manual' | 'registrar'
export type RuntimeLedgerRegistrarKind = string

type RuntimeLedgerBinding = {
    object: RuntimeLedgerObjectRow
    config: LedgerConfig | null
    attrs: RuntimeLedgerComponentRow[]
    tableIdent: string
    activeCondition: string
    hasWorkspaceColumn: boolean
    hasReversalOfFactColumn: boolean
}

const MAX_LEDGER_LIMIT = 1000
const REVERSAL_IDEMPOTENCY_MARKER = ':reversal:'
const LEDGER_CAPABILITY_CONDITION = `
(
  COALESCE((config->'capabilities'->'ledgerSchema'->>'enabled')::boolean, false) = true
  AND COALESCE((config->'capabilities'->'dataSchema'->>'enabled')::boolean, false) = true
  AND COALESCE((config->'capabilities'->'physicalTable'->>'enabled')::boolean, false) = true
  AND jsonb_typeof(config->'ledger') = 'object'
)`

const normalizeLimit = (value: number | undefined): number => {
    if (!Number.isFinite(value)) return 100
    return Math.max(1, Math.min(MAX_LEDGER_LIMIT, Math.trunc(value as number)))
}

const normalizeOffset = (value: number | undefined): number => {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.trunc(value as number))
}

const readLedgerConfig = (config: Record<string, unknown> | null | undefined): LedgerConfig | null =>
    normalizeLedgerConfigFromConfig(config)

const resolveLedgerConfig = (config: LedgerConfig | null): LedgerConfig => normalizeLedgerConfig(config ?? DEFAULT_LEDGER_CONFIG)

const assertLedgerWriteAllowed = (
    config: LedgerConfig | null,
    origin: RuntimeLedgerWriteOrigin,
    registrarKind?: RuntimeLedgerRegistrarKind | null
): void => {
    const resolved = resolveLedgerConfig(config)
    if (resolved.sourcePolicy === 'registrar' && origin === 'manual') {
        throw new UpdateFailure(403, {
            error: 'Ledger accepts facts only from registrar posting flows',
            code: 'LEDGER_REGISTRAR_ONLY'
        })
    }
    if (resolved.sourcePolicy === 'manual' && origin === 'registrar') {
        throw new UpdateFailure(409, {
            error: 'Ledger accepts only manual facts',
            code: 'LEDGER_MANUAL_ONLY'
        })
    }
    if (origin === 'registrar' && resolved.registrarKinds.length > 0) {
        const normalizedRegistrarKind = String(registrarKind ?? '')
            .trim()
            .toLowerCase()
        const allowedKinds = new Set(resolved.registrarKinds.map((kind) => String(kind).trim().toLowerCase()).filter(Boolean))
        if (!normalizedRegistrarKind || !allowedKinds.has(normalizedRegistrarKind)) {
            throw new UpdateFailure(403, {
                error: 'Ledger rejects facts from this registrar kind',
                code: 'LEDGER_REGISTRAR_KIND_FORBIDDEN',
                registrarKind: normalizedRegistrarKind || null
            })
        }
    }
}

const assertLedgerManualEditAllowed = (config: LedgerConfig | null): void => {
    assertLedgerWriteAllowed(config, 'manual')
    const resolved = resolveLedgerConfig(config)
    if (resolved.mutationPolicy !== 'manualEditable') {
        throw new UpdateFailure(409, {
            error: 'Ledger facts are append-only',
            code: 'LEDGER_APPEND_ONLY'
        })
    }
}

const resolveFieldKey = (cmp: RuntimeLedgerComponentRow): string => {
    const codename = resolveRuntimeCodenameText(cmp.codename).trim()
    return codename.length > 0 ? codename : cmp.column_name
}

const normalizeFieldKey = (value: string): string => value.trim().toLowerCase()
const normalizeFieldIdentity = (value: string): string => value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

const findAttrByFieldKey = (attrs: RuntimeLedgerComponentRow[], fieldKey: string): RuntimeLedgerComponentRow | null => {
    const normalized = normalizeFieldKey(fieldKey)
    const normalizedIdentity = normalizeFieldIdentity(fieldKey)
    return (
        attrs.find(
            (cmp) =>
                normalizeFieldKey(resolveFieldKey(cmp)) === normalized ||
                normalizeFieldKey(cmp.column_name) === normalized ||
                normalizeFieldIdentity(resolveFieldKey(cmp)) === normalizedIdentity ||
                normalizeFieldIdentity(cmp.column_name) === normalizedIdentity
        ) ?? null
    )
}

const applyReversalIdempotencyKey = (binding: RuntimeLedgerBinding, data: Record<string, unknown>, sourceFactId: string): boolean => {
    const keyAttrs = resolveLedgerConfig(binding.config)
        .idempotency.keyFields.map((fieldKey) => findAttrByFieldKey(binding.attrs, fieldKey))
        .filter((cmp): cmp is RuntimeLedgerComponentRow => Boolean(cmp))

    if (keyAttrs.length === 0) {
        return false
    }

    const targetAttr = [...keyAttrs].reverse().find((cmp) => cmp.data_type === 'STRING')
    if (!targetAttr) {
        return false
    }

    const targetFieldKey = resolveFieldKey(targetAttr)
    const currentValue = data[targetFieldKey] ?? data[targetAttr.column_name]
    const baseValue = currentValue === null || currentValue === undefined || currentValue === '' ? 'fact' : String(currentValue)
    data[targetFieldKey] = `${baseValue}${REVERSAL_IDEMPOTENCY_MARKER}${sourceFactId}`
    return true
}

const getFieldRole = (config: LedgerConfig | null, cmp: RuntimeLedgerComponentRow) => {
    if (!config) return null
    const fieldKey = normalizeFieldKey(resolveFieldKey(cmp))
    return (
        config.fieldRoles.find(
            (role) => normalizeFieldKey(role.fieldCodename) === fieldKey || normalizeFieldKey(role.fieldCodename) === cmp.column_name
        ) ?? null
    )
}

const buildResponseRow = (row: Record<string, unknown>, attrs: RuntimeLedgerComponentRow[], aliases: string[]) => {
    const result: Record<string, unknown> = {}
    for (let index = 0; index < aliases.length; index += 1) {
        const cmp = attrs[index]
        if (!cmp) continue
        const value = row[aliases[index]]
        result[resolveFieldKey(cmp)] = cmp.data_type === 'NUMBER' ? pgNumericToNumber(value) : value
    }
    return result
}

const normalizeLedgerSourceValue = (cmp: RuntimeLedgerComponentRow, value: unknown): unknown => {
    if (cmp.data_type === 'DATE' && value instanceof Date) {
        return value.toISOString()
    }
    return value
}

const assertLedgerTableName = (value: string | null): string => {
    if (!value || !IDENTIFIER_REGEX.test(value)) {
        throw new Error('Ledger table name is invalid')
    }
    return value
}

const buildActiveCondition = (hasWorkspaceColumn: boolean, currentWorkspaceId: string | null): string => {
    const clauses = ['_upl_deleted = false', '_app_deleted = false']
    if (hasWorkspaceColumn && currentWorkspaceId) {
        clauses.push('workspace_id = $workspace')
    }
    return clauses.join(' AND ')
}

const replaceWorkspacePlaceholder = (sql: string, parameterIndex: number): string => sql.replace('$workspace', `$${parameterIndex}`)

const ledgerValidationFailure = (error: unknown, body: Record<string, unknown>): UpdateFailure => {
    if (error instanceof UpdateFailure) {
        return error
    }
    return new UpdateFailure(400, {
        ...body,
        detail: error instanceof Error ? error.message : undefined
    })
}

const aggregateSql = (aggregate: LedgerResourceAggregate | undefined, expression: string, projectionKind: string): string => {
    const resolved = aggregate ?? (projectionKind === 'latest' ? 'latest' : 'sum')
    if (resolved === 'count') return `COUNT(${expression})`
    if (resolved === 'min') return `MIN(${expression})`
    if (resolved === 'max') return `MAX(${expression})`
    if (resolved === 'latest') return `(ARRAY_AGG(${expression} ORDER BY _upl_created_at DESC, id DESC))[1]`
    return `SUM(${expression})`
}

export class RuntimeLedgerService {
    async listLedgers(params: { executor: DbExecutor; schemaName: string }): Promise<RuntimeLedgerMetadata[]> {
        const schemaIdent = quoteIdentifier(params.schemaName)
        const ledgers = (await params.executor.query(
            `
        SELECT id, kind, codename, presentation, table_name, config
        FROM ${schemaIdent}._app_objects
        WHERE ${LEDGER_CAPABILITY_CONDITION}
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY id ASC
      `
        )) as RuntimeLedgerObjectRow[]

        if (ledgers.length === 0) {
            return []
        }

        const attrs = (await params.executor.query(
            `
        SELECT id, object_id, codename, column_name, data_type, is_required, validation_rules
        FROM ${schemaIdent}._app_components
        WHERE object_id = ANY($1::uuid[])
          AND parent_component_id IS NULL
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY object_id ASC, sort_order ASC, _upl_created_at ASC NULLS LAST, id ASC
      `,
            [ledgers.map((ledger) => ledger.id)]
        )) as Array<RuntimeLedgerComponentRow & { object_id: string }>

        return ledgers.map((ledger) => {
            const config = readLedgerConfig(ledger.config)
            const ledgerAttrs = attrs.filter((cmp) => cmp.object_id === ledger.id)
            return {
                id: ledger.id,
                codename: resolveRuntimeCodenameText(ledger.codename),
                presentation: ledger.presentation,
                config,
                fields: ledgerAttrs.map((cmp) => {
                    const role = getFieldRole(config, cmp)
                    return {
                        id: cmp.id,
                        codename: resolveFieldKey(cmp),
                        columnName: cmp.column_name,
                        dataType: cmp.data_type,
                        role: role?.role ?? null,
                        aggregate: role?.aggregate ?? null,
                        required: Boolean(cmp.is_required || role?.required)
                    }
                })
            }
        })
    }

    async listFacts(params: {
        executor: DbExecutor
        schemaName: string
        ledgerId: string
        currentWorkspaceId: string | null
        limit?: number
        offset?: number
    }): Promise<{ rows: Array<Record<string, unknown>>; limit: number; offset: number }> {
        const binding = await this.resolveLedgerBinding(params)
        const fields = binding.attrs.filter((cmp) => IDENTIFIER_REGEX.test(cmp.column_name) && cmp.data_type !== 'TABLE')
        const aliases = fields.map((_, index) => `f${index}`)
        const selectColumns = [
            'id',
            '_upl_created_at',
            ...fields.map((cmp, index) => `${quoteIdentifier(cmp.column_name)} AS ${quoteIdentifier(aliases[index])}`)
        ]
        const values: unknown[] = []
        let activeCondition = binding.activeCondition
        if (binding.hasWorkspaceColumn && params.currentWorkspaceId) {
            values.push(params.currentWorkspaceId)
            activeCondition = replaceWorkspacePlaceholder(activeCondition, values.length)
        }
        const limit = normalizeLimit(params.limit)
        const offset = normalizeOffset(params.offset)
        values.push(limit, offset)

        const rows = (await params.executor.query(
            `
        SELECT ${selectColumns.join(', ')}
        FROM ${binding.tableIdent}
        WHERE ${activeCondition}
        ORDER BY _upl_created_at DESC, id DESC
        LIMIT $${values.length - 1}
        OFFSET $${values.length}
      `,
            values
        )) as Array<Record<string, unknown>>

        return {
            rows: rows.map((row) => ({
                id: row.id,
                createdAt: row._upl_created_at,
                data: buildResponseRow(row, fields, aliases)
            })),
            limit,
            offset
        }
    }

    async queryProjection(params: {
        executor: DbExecutor
        schemaName: string
        ledgerId: string
        currentWorkspaceId: string | null
        projectionCodename: string
        filters?: Record<string, unknown>
        limit?: number
        offset?: number
    }): Promise<RuntimeLedgerProjectionResult> {
        const binding = await this.resolveLedgerBinding(params)
        const projection = binding.config?.projections.find(
            (item) => normalizeFieldKey(item.codename) === normalizeFieldKey(params.projectionCodename)
        )
        if (!projection) {
            throw new UpdateFailure(404, {
                error: 'Ledger projection not found',
                code: 'LEDGER_PROJECTION_NOT_FOUND'
            })
        }

        const dimensions = projection.dimensions.map((field) => findAttrByFieldKey(binding.attrs, field))
        const resources = projection.resources.map((field) => findAttrByFieldKey(binding.attrs, field))
        if (dimensions.some((cmp) => !cmp) || resources.some((cmp) => !cmp)) {
            throw new UpdateFailure(409, {
                error: 'Ledger projection references unknown fields',
                code: 'LEDGER_PROJECTION_INVALID'
            })
        }

        const dimensionAttrs = dimensions as RuntimeLedgerComponentRow[]
        const resourceAttrs = resources as RuntimeLedgerComponentRow[]
        const values: unknown[] = []
        const whereClauses = [binding.activeCondition]

        if (binding.hasWorkspaceColumn && params.currentWorkspaceId) {
            values.push(params.currentWorkspaceId)
            whereClauses[0] = replaceWorkspacePlaceholder(whereClauses[0], values.length)
        }

        for (const [key, rawValue] of Object.entries(params.filters ?? {})) {
            const cmp = findAttrByFieldKey(binding.attrs, key)
            if (!cmp || !IDENTIFIER_REGEX.test(cmp.column_name) || cmp.data_type === 'TABLE') {
                throw new UpdateFailure(400, {
                    error: `Ledger filter references an unknown or unsupported field: ${key}`,
                    code: 'LEDGER_FILTER_INVALID',
                    field: key
                })
            }
            try {
                values.push(coerceRuntimeValue(rawValue, cmp.data_type as RuntimeDataType, cmp.validation_rules))
            } catch (error) {
                throw ledgerValidationFailure(error, {
                    error: `Ledger filter contains an invalid value for field: ${key}`,
                    code: 'LEDGER_FILTER_VALUE_INVALID',
                    field: key
                })
            }
            whereClauses.push(`${quoteIdentifier(cmp.column_name)} = $${values.length}`)
        }

        const dimensionAliases = dimensionAttrs.map((_, index) => `d${index}`)
        const resourceAliases = resourceAttrs.map((_, index) => `r${index}`)
        const dimensionSelects = dimensionAttrs.map(
            (cmp, index) => `${quoteIdentifier(cmp.column_name)} AS ${quoteIdentifier(dimensionAliases[index])}`
        )
        const resourceSelects = resourceAttrs.map((cmp, index) => {
            const role = getFieldRole(binding.config, cmp)
            return `${aggregateSql(role?.aggregate, quoteIdentifier(cmp.column_name), projection.kind)} AS ${quoteIdentifier(
                resourceAliases[index]
            )}`
        })
        const groupByClause = dimensionAttrs.length > 0 ? `GROUP BY ${dimensionAttrs.map((_, index) => String(index + 1)).join(', ')}` : ''
        const orderByClause =
            dimensionAttrs.length > 0
                ? `ORDER BY ${dimensionAttrs.map((_, index) => quoteIdentifier(dimensionAliases[index])).join(', ')}`
                : ''
        const limit = normalizeLimit(params.limit)
        const offset = normalizeOffset(params.offset)
        values.push(limit, offset)

        const rows = (await params.executor.query(
            `
        SELECT ${[...dimensionSelects, ...resourceSelects].join(', ')}
        FROM ${binding.tableIdent}
        WHERE ${whereClauses.join(' AND ')}
        ${groupByClause}
        ${orderByClause}
        LIMIT $${values.length - 1}
        OFFSET $${values.length}
      `,
            values
        )) as Array<Record<string, unknown>>

        return {
            projection,
            rows: rows.map((row) => ({
                ...buildResponseRow(row, dimensionAttrs, dimensionAliases),
                ...buildResponseRow(row, resourceAttrs, resourceAliases)
            })),
            limit,
            offset
        }
    }

    async appendFacts(params: {
        executor: DbExecutor
        schemaName: string
        ledgerId?: string
        ledgerCodename?: string
        currentWorkspaceId: string | null
        currentUserId: string | null
        facts: RuntimeLedgerFactAppendInput[]
        writeOrigin?: RuntimeLedgerWriteOrigin
        registrarKind?: RuntimeLedgerRegistrarKind | null
    }): Promise<Array<{ id: string; idempotent?: boolean }>> {
        if (params.facts.length === 0) {
            throw new UpdateFailure(400, {
                error: 'Ledger append requires at least one fact',
                code: 'LEDGER_FACTS_EMPTY'
            })
        }
        if (params.facts.length > 100) {
            throw new UpdateFailure(400, {
                error: 'Ledger append supports at most 100 facts per call',
                code: 'LEDGER_FACTS_TOO_MANY'
            })
        }
        if (!params.currentUserId) {
            throw new UpdateFailure(401, {
                error: 'Ledger append requires a current user id',
                code: 'LEDGER_ACTOR_REQUIRED'
            })
        }

        return params.executor.transaction(async (tx) => {
            const binding = await this.resolveLedgerBinding({ ...params, executor: tx, ledgerId: params.ledgerId ?? null })
            assertLedgerWriteAllowed(binding.config, params.writeOrigin ?? 'manual', params.registrarKind)
            const results: Array<{ id: string; idempotent?: boolean }> = []

            for (const fact of params.facts) {
                const columnValues = this.buildFactColumnValues(binding, fact.data)
                const existingFactId = await this.findIdempotentFactId(tx, binding, columnValues, params.currentWorkspaceId)
                if (existingFactId) {
                    results.push({ id: existingFactId, idempotent: true })
                    continue
                }
                const columns = columnValues.map((item) => quoteIdentifier(item.column))
                const values = columnValues.map((item) => item.value)

                columns.push(quoteIdentifier('_upl_created_by'), quoteIdentifier('_upl_updated_by'))
                values.push(params.currentUserId, params.currentUserId)

                if (binding.hasWorkspaceColumn && params.currentWorkspaceId) {
                    columns.push(quoteIdentifier('workspace_id'))
                    values.push(params.currentWorkspaceId)
                }

                const placeholders = values.map((_, index) => `$${index + 1}`)
                const inserted = (await tx.query(
                    `
            INSERT INTO ${binding.tableIdent} (${columns.join(', ')})
            VALUES (${placeholders.join(', ')})
            ON CONFLICT DO NOTHING
            RETURNING id
          `,
                    values
                )) as Array<{ id: string }>

                const id = inserted[0]?.id
                if (!id) {
                    const conflictingFactId = await this.findIdempotentFactId(tx, binding, columnValues, params.currentWorkspaceId)
                    if (conflictingFactId) {
                        results.push({ id: conflictingFactId, idempotent: true })
                        continue
                    }
                }
                if (!id) {
                    throw new Error('Ledger append failed')
                }
                results.push({ id })
            }

            return results
        })
    }

    async reverseFacts(params: {
        executor: DbExecutor
        schemaName: string
        ledgerId?: string
        ledgerCodename?: string
        currentWorkspaceId: string | null
        currentUserId: string | null
        factIds: string[]
        writeOrigin?: RuntimeLedgerWriteOrigin
        registrarKind?: RuntimeLedgerRegistrarKind | null
    }): Promise<Array<{ id: string }>> {
        if (params.factIds.length === 0) {
            throw new UpdateFailure(400, {
                error: 'Ledger reversal requires at least one fact id',
                code: 'LEDGER_REVERSAL_EMPTY'
            })
        }
        if (params.factIds.length > 100) {
            throw new UpdateFailure(400, {
                error: 'Ledger reversal supports at most 100 facts per call',
                code: 'LEDGER_REVERSAL_TOO_MANY'
            })
        }
        if (!params.currentUserId) {
            throw new UpdateFailure(401, {
                error: 'Ledger reversal requires a current user id',
                code: 'LEDGER_ACTOR_REQUIRED'
            })
        }

        return params.executor.transaction(async (tx) => {
            const binding = await this.resolveLedgerBinding({ ...params, executor: tx, ledgerId: params.ledgerId ?? null })
            assertLedgerWriteAllowed(binding.config, params.writeOrigin ?? 'manual', params.registrarKind)
            const fields = binding.attrs.filter((cmp) => IDENTIFIER_REGEX.test(cmp.column_name) && cmp.data_type !== 'TABLE')
            const values: unknown[] = [params.factIds]
            let activeCondition = binding.activeCondition
            if (binding.hasWorkspaceColumn && params.currentWorkspaceId) {
                values.push(params.currentWorkspaceId)
                activeCondition = replaceWorkspacePlaceholder(activeCondition, values.length)
            }

            const sourceRows = (await tx.query(
                `
          SELECT *
          FROM ${binding.tableIdent}
          WHERE id = ANY($1::uuid[])
            AND ${activeCondition}
        `,
                values
            )) as Array<Record<string, unknown>>

            if (sourceRows.length !== params.factIds.length) {
                throw new UpdateFailure(404, {
                    error: 'One or more ledger facts could not be reversed',
                    code: 'LEDGER_REVERSAL_SOURCE_NOT_FOUND'
                })
            }

            const resourceColumns = new Set(
                fields
                    .filter((cmp) => getFieldRole(binding.config, cmp)?.role === 'resource' && cmp.data_type === 'NUMBER')
                    .map((cmp) => cmp.column_name)
            )
            const reversedFacts = sourceRows.map((sourceRow) => {
                const sourceFactId = typeof sourceRow.id === 'string' ? sourceRow.id : ''
                if (!sourceFactId) {
                    throw new UpdateFailure(409, {
                        error: 'Ledger reversal source fact id is invalid',
                        code: 'LEDGER_REVERSAL_SOURCE_INVALID'
                    })
                }

                const data: Record<string, unknown> = {}
                for (const cmp of fields) {
                    const value = normalizeLedgerSourceValue(cmp, sourceRow[cmp.column_name])
                    data[resolveFieldKey(cmp)] = resourceColumns.has(cmp.column_name) ? -Number(pgNumericToNumber(value) ?? 0) : value
                }
                const hasBusinessReversalKey = applyReversalIdempotencyKey(binding, data, sourceFactId)
                return { data, sourceFactId, hasBusinessReversalKey }
            })

            const results: Array<{ id: string }> = []
            for (const fact of reversedFacts) {
                if (!binding.hasReversalOfFactColumn && !fact.hasBusinessReversalKey) {
                    throw new UpdateFailure(409, {
                        error: 'Ledger reversal requires a system reversal column or a STRING idempotency key field',
                        code: 'LEDGER_REVERSAL_IDEMPOTENCY_UNAVAILABLE'
                    })
                }
                if (binding.hasReversalOfFactColumn) {
                    const existingReversalId = await this.findReversalFactId(tx, binding, fact.sourceFactId, params.currentWorkspaceId)
                    if (existingReversalId) {
                        results.push({ id: existingReversalId })
                        continue
                    }
                }

                const columnValues = this.buildFactColumnValues(binding, fact.data)
                const existingFactId = await this.findIdempotentFactId(tx, binding, columnValues, params.currentWorkspaceId)
                if (existingFactId) {
                    results.push({ id: existingFactId })
                    continue
                }
                const columns = columnValues.map((item) => quoteIdentifier(item.column))
                const insertValues = columnValues.map((item) => item.value)

                columns.push(quoteIdentifier('_upl_created_by'), quoteIdentifier('_upl_updated_by'))
                insertValues.push(params.currentUserId, params.currentUserId)

                if (binding.hasReversalOfFactColumn) {
                    columns.push(quoteIdentifier('_app_reversal_of_fact_id'))
                    insertValues.push(fact.sourceFactId)
                }

                if (binding.hasWorkspaceColumn && params.currentWorkspaceId) {
                    columns.push(quoteIdentifier('workspace_id'))
                    insertValues.push(params.currentWorkspaceId)
                }

                const placeholders = insertValues.map((_, index) => `$${index + 1}`)
                const inserted = (await tx.query(
                    `
            INSERT INTO ${binding.tableIdent} (${columns.join(', ')})
            VALUES (${placeholders.join(', ')})
            ON CONFLICT DO NOTHING
            RETURNING id
          `,
                    insertValues
                )) as Array<{ id: string }>

                const id = inserted[0]?.id
                if (!id) {
                    if (binding.hasReversalOfFactColumn) {
                        const conflictingReversalId = await this.findReversalFactId(
                            tx,
                            binding,
                            fact.sourceFactId,
                            params.currentWorkspaceId
                        )
                        if (conflictingReversalId) {
                            results.push({ id: conflictingReversalId })
                            continue
                        }
                    }
                    const conflictingFactId = await this.findIdempotentFactId(tx, binding, columnValues, params.currentWorkspaceId)
                    if (conflictingFactId) {
                        results.push({ id: conflictingFactId })
                        continue
                    }
                }
                if (!id) {
                    throw new Error('Ledger reversal append failed')
                }
                results.push({ id })
            }

            return results
        })
    }

    async updateFact(params: {
        executor: DbExecutor
        schemaName: string
        ledgerId: string
        factId: string
        currentWorkspaceId: string | null
        currentUserId: string | null
        data: Record<string, unknown>
    }): Promise<{ id: string }> {
        if (!params.currentUserId) {
            throw new UpdateFailure(401, { error: 'Ledger fact update requires a current user id' })
        }

        return params.executor.transaction(async (tx) => {
            const binding = await this.resolveLedgerBinding({ ...params, executor: tx, ledgerId: params.ledgerId, includeAttrs: false })
            assertLedgerManualEditAllowed(binding.config)
            const attrs = await this.loadLedgerComponents(tx, params.schemaName, binding.object.id)
            const columnValues = this.buildFactPatchColumnValues({ ...binding, attrs }, params.data)
            if (columnValues.length === 0) {
                throw new UpdateFailure(400, {
                    error: 'Ledger fact update requires at least one field',
                    code: 'LEDGER_FACT_EMPTY_PATCH'
                })
            }

            const values: unknown[] = [params.factId, params.currentUserId]
            const setClauses = ['_upl_updated_at = NOW()', '_upl_updated_by = $2', '_upl_version = COALESCE(_upl_version, 1) + 1']
            for (const item of columnValues) {
                values.push(item.value)
                setClauses.push(`${quoteIdentifier(item.column)} = $${values.length}`)
            }

            let activeCondition = binding.activeCondition
            if (binding.hasWorkspaceColumn && params.currentWorkspaceId) {
                values.push(params.currentWorkspaceId)
                activeCondition = replaceWorkspacePlaceholder(activeCondition, values.length)
            }

            const rows = (await tx.query(
                `
          UPDATE ${binding.tableIdent}
          SET ${setClauses.join(', ')}
          WHERE id = $1
            AND ${activeCondition}
            AND COALESCE(_upl_locked, false) = false
          RETURNING id
        `,
                values
            )) as Array<{ id: string }>

            const id = rows[0]?.id
            if (!id) {
                throw new UpdateFailure(404, {
                    error: 'Ledger fact not found',
                    code: 'LEDGER_FACT_NOT_FOUND'
                })
            }

            return { id }
        })
    }

    async deleteFact(params: {
        executor: DbExecutor
        schemaName: string
        ledgerId: string
        factId: string
        currentWorkspaceId: string | null
        currentUserId: string | null
    }): Promise<{ id: string }> {
        if (!params.currentUserId) {
            throw new UpdateFailure(401, { error: 'Ledger fact delete requires a current user id' })
        }

        return params.executor.transaction(async (tx) => {
            const binding = await this.resolveLedgerBinding({ ...params, executor: tx, ledgerId: params.ledgerId, includeAttrs: false })
            assertLedgerManualEditAllowed(binding.config)
            const values: unknown[] = [params.factId, params.currentUserId]
            let activeCondition = binding.activeCondition
            if (binding.hasWorkspaceColumn && params.currentWorkspaceId) {
                values.push(params.currentWorkspaceId)
                activeCondition = replaceWorkspacePlaceholder(activeCondition, values.length)
            }

            const rows = (await tx.query(
                `
          UPDATE ${binding.tableIdent}
          SET _upl_deleted = true,
              _app_deleted = true,
              _upl_updated_at = NOW(),
              _upl_updated_by = $2,
              _upl_version = COALESCE(_upl_version, 1) + 1
          WHERE id = $1
            AND ${activeCondition}
            AND COALESCE(_upl_locked, false) = false
          RETURNING id
        `,
                values
            )) as Array<{ id: string }>

            const id = rows[0]?.id
            if (!id) {
                throw new UpdateFailure(404, {
                    error: 'Ledger fact not found',
                    code: 'LEDGER_FACT_NOT_FOUND'
                })
            }

            return { id }
        })
    }

    private buildFactColumnValues(binding: RuntimeLedgerBinding, data: Record<string, unknown>) {
        const writableAttrs = binding.attrs.filter((cmp) => IDENTIFIER_REGEX.test(cmp.column_name) && cmp.data_type !== 'TABLE')
        const allowedKeys = new Set<string>()
        for (const cmp of writableAttrs) {
            allowedKeys.add(normalizeFieldKey(resolveFieldKey(cmp)))
            allowedKeys.add(normalizeFieldKey(cmp.column_name))
        }

        for (const key of Object.keys(data)) {
            if (!allowedKeys.has(normalizeFieldKey(key))) {
                throw new UpdateFailure(400, {
                    error: `Ledger fact contains an unknown field: ${key}`,
                    code: 'LEDGER_FACT_FIELD_INVALID',
                    field: key
                })
            }
        }

        const values: Array<{ column: string; value: unknown }> = []
        for (const cmp of writableAttrs) {
            const role = getFieldRole(binding.config, cmp)
            const fieldKey = resolveFieldKey(cmp)
            const hasValue =
                Object.prototype.hasOwnProperty.call(data, fieldKey) || Object.prototype.hasOwnProperty.call(data, cmp.column_name)
            const rawValue = data[fieldKey] ?? data[cmp.column_name]

            if (!hasValue) {
                if (cmp.is_required || role?.required) {
                    throw new UpdateFailure(400, {
                        error: `Ledger fact is missing required field: ${fieldKey}`,
                        code: 'LEDGER_FACT_FIELD_REQUIRED',
                        field: fieldKey
                    })
                }
                continue
            }

            let coerced: unknown
            try {
                coerced = coerceRuntimeValue(rawValue, cmp.data_type as RuntimeDataType, cmp.validation_rules)
            } catch (error) {
                throw ledgerValidationFailure(error, {
                    error: `Ledger fact contains an invalid value for field: ${fieldKey}`,
                    code: 'LEDGER_FACT_FIELD_VALUE_INVALID',
                    field: fieldKey
                })
            }
            if ((cmp.is_required || role?.required) && coerced === null) {
                throw new UpdateFailure(400, {
                    error: `Ledger fact required field cannot be null: ${fieldKey}`,
                    code: 'LEDGER_FACT_FIELD_REQUIRED',
                    field: fieldKey
                })
            }
            values.push({ column: cmp.column_name, value: coerced })
        }

        return values
    }

    private buildFactPatchColumnValues(binding: RuntimeLedgerBinding, data: Record<string, unknown>) {
        const writableAttrs = binding.attrs.filter((cmp) => IDENTIFIER_REGEX.test(cmp.column_name) && cmp.data_type !== 'TABLE')
        const values: Array<{ column: string; value: unknown }> = []
        const seenColumns = new Set<string>()

        for (const [key, rawValue] of Object.entries(data)) {
            const cmp = findAttrByFieldKey(writableAttrs, key)
            if (!cmp || !IDENTIFIER_REGEX.test(cmp.column_name) || cmp.data_type === 'TABLE') {
                throw new UpdateFailure(400, {
                    error: `Ledger fact contains an unknown field: ${key}`,
                    code: 'LEDGER_FACT_FIELD_INVALID',
                    field: key
                })
            }
            if (seenColumns.has(cmp.column_name)) {
                continue
            }

            const role = getFieldRole(binding.config, cmp)
            const fieldKey = resolveFieldKey(cmp)
            let coerced: unknown
            try {
                coerced = coerceRuntimeValue(rawValue, cmp.data_type as RuntimeDataType, cmp.validation_rules)
            } catch (error) {
                throw ledgerValidationFailure(error, {
                    error: `Ledger fact contains an invalid value for field: ${fieldKey}`,
                    code: 'LEDGER_FACT_FIELD_VALUE_INVALID',
                    field: fieldKey
                })
            }
            if ((cmp.is_required || role?.required) && coerced === null) {
                throw new UpdateFailure(400, {
                    error: `Ledger fact required field cannot be null: ${fieldKey}`,
                    code: 'LEDGER_FACT_FIELD_REQUIRED',
                    field: fieldKey
                })
            }
            seenColumns.add(cmp.column_name)
            values.push({ column: cmp.column_name, value: coerced })
        }

        return values
    }

    private async findIdempotentFactId(
        executor: DbExecutor,
        binding: RuntimeLedgerBinding,
        columnValues: Array<{ column: string; value: unknown }>,
        currentWorkspaceId: string | null
    ): Promise<string | null> {
        const keyFields = resolveLedgerConfig(binding.config).idempotency.keyFields
        if (keyFields.length === 0) {
            return null
        }

        const valueByColumn = new Map(columnValues.map((item) => [normalizeFieldKey(item.column), item.value]))
        const whereClauses: string[] = []
        const values: unknown[] = []

        for (const keyField of keyFields) {
            const cmp = findAttrByFieldKey(binding.attrs, keyField)
            if (!cmp || !IDENTIFIER_REGEX.test(cmp.column_name)) {
                return null
            }
            const value = valueByColumn.get(normalizeFieldKey(cmp.column_name))
            if (value === undefined || value === null) {
                return null
            }
            values.push(value)
            whereClauses.push(`${quoteIdentifier(cmp.column_name)} = $${values.length}`)
        }

        if (whereClauses.length === 0) {
            return null
        }

        let activeCondition = binding.activeCondition
        if (binding.hasWorkspaceColumn && currentWorkspaceId) {
            values.push(currentWorkspaceId)
            activeCondition = replaceWorkspacePlaceholder(activeCondition, values.length)
        }

        const existing = (await executor.query(
            `
        SELECT id
        FROM ${binding.tableIdent}
        WHERE ${activeCondition}
          AND ${whereClauses.join(' AND ')}
        ORDER BY _upl_created_at ASC NULLS LAST, id ASC
        LIMIT 1
      `,
            values
        )) as Array<{ id: string }>

        return existing[0]?.id ?? null
    }

    private async findReversalFactId(
        executor: DbExecutor,
        binding: RuntimeLedgerBinding,
        sourceFactId: string,
        currentWorkspaceId: string | null
    ): Promise<string | null> {
        if (!binding.hasReversalOfFactColumn) {
            return null
        }

        const values: unknown[] = [sourceFactId]
        let activeCondition = binding.activeCondition
        if (binding.hasWorkspaceColumn && currentWorkspaceId) {
            values.push(currentWorkspaceId)
            activeCondition = replaceWorkspacePlaceholder(activeCondition, values.length)
        }

        const existing = (await executor.query(
            `
        SELECT id
        FROM ${binding.tableIdent}
        WHERE ${activeCondition}
          AND ${quoteIdentifier('_app_reversal_of_fact_id')} = $1
        ORDER BY _upl_created_at ASC NULLS LAST, id ASC
        LIMIT 1
      `,
            values
        )) as Array<{ id: string }>

        return existing[0]?.id ?? null
    }

    private async resolveLedgerBinding(params: {
        executor: DbExecutor
        schemaName: string
        ledgerId?: string | null
        ledgerCodename?: string
        currentWorkspaceId: string | null
        includeAttrs?: boolean
    }): Promise<RuntimeLedgerBinding> {
        const schemaIdent = quoteIdentifier(params.schemaName)
        const where = params.ledgerId ? 'id = $1' : `${resolveRuntimeCodenameTextSql('codename')} = $1`
        const value = params.ledgerId ?? params.ledgerCodename?.trim()
        if (!value) {
            throw new UpdateFailure(400, {
                error: 'Ledger id or codename is required',
                code: 'LEDGER_REFERENCE_REQUIRED'
            })
        }

        const ledgers = (await params.executor.query(
            `
        SELECT id, kind, codename, presentation, table_name, config
        FROM ${schemaIdent}._app_objects
        WHERE ${LEDGER_CAPABILITY_CONDITION}
          AND ${where}
          AND _upl_deleted = false
          AND _app_deleted = false
        LIMIT 1
      `,
            [value]
        )) as RuntimeLedgerObjectRow[]

        const object = ledgers[0]
        if (!object) {
            throw new UpdateFailure(404, {
                error: 'Ledger not found',
                code: 'LEDGER_NOT_FOUND'
            })
        }

        let tableName: string
        try {
            tableName = assertLedgerTableName(object.table_name)
        } catch {
            throw new UpdateFailure(409, {
                error: 'Ledger table metadata is invalid',
                code: 'LEDGER_TABLE_INVALID'
            })
        }
        const systemColumnRows = (await params.executor.query(
            `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND column_name IN ('workspace_id', '_app_reversal_of_fact_id')
      `,
            [params.schemaName, tableName]
        )) as Array<Record<string, unknown>>

        const attrs = params.includeAttrs === false ? [] : await this.loadLedgerComponents(params.executor, params.schemaName, object.id)

        const hasWorkspaceColumn = systemColumnRows.some((row) => row.column_name === 'workspace_id')
        const hasReversalOfFactColumn = systemColumnRows.some((row) => row.column_name === '_app_reversal_of_fact_id')
        return {
            object,
            config: readLedgerConfig(object.config),
            attrs,
            tableIdent: `${schemaIdent}.${quoteIdentifier(tableName)}`,
            activeCondition: buildActiveCondition(hasWorkspaceColumn, params.currentWorkspaceId),
            hasWorkspaceColumn,
            hasReversalOfFactColumn
        }
    }

    private async loadLedgerComponents(executor: DbExecutor, schemaName: string, objectId: string): Promise<RuntimeLedgerComponentRow[]> {
        const schemaIdent = quoteIdentifier(schemaName)
        return (await executor.query(
            `
        SELECT id, codename, column_name, data_type, is_required, validation_rules
        FROM ${schemaIdent}._app_components
        WHERE object_id = $1
          AND parent_component_id IS NULL
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, id ASC
      `,
            [objectId]
        )) as RuntimeLedgerComponentRow[]
    }
}

export class RuntimeLedgersService extends RuntimeLedgerService {}

const resolveRuntimeCodenameTextSql = (columnRef: string): string =>
    `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', '')`
