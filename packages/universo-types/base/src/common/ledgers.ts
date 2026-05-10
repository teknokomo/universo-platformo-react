import { z } from 'zod'

import type { FieldDefinitionDataType } from './metahubs'

export const LEDGER_MODES = ['facts', 'balance', 'accounting', 'calculation'] as const
export type LedgerMode = (typeof LEDGER_MODES)[number]

export const LEDGER_MUTATION_POLICIES = ['appendOnly', 'manualEditable'] as const
export type LedgerMutationPolicy = (typeof LEDGER_MUTATION_POLICIES)[number]

export const LEDGER_PERIODICITIES = ['none', 'instant', 'day', 'week', 'month', 'quarter', 'year'] as const
export type LedgerPeriodicity = (typeof LEDGER_PERIODICITIES)[number]

export const LEDGER_SOURCE_POLICIES = ['manual', 'registrar', 'both'] as const
export type LedgerSourcePolicy = (typeof LEDGER_SOURCE_POLICIES)[number]

export const LEDGER_FIELD_ROLES = ['dimension', 'resource', 'attribute'] as const
export type LedgerFieldRoleKind = (typeof LEDGER_FIELD_ROLES)[number]

export const LEDGER_RESOURCE_AGGREGATES = ['sum', 'count', 'min', 'max', 'latest'] as const
export type LedgerResourceAggregate = (typeof LEDGER_RESOURCE_AGGREGATES)[number]

export const LEDGER_PROJECTION_KINDS = ['latest', 'turnover', 'balance', 'timeline'] as const
export type LedgerProjectionKind = (typeof LEDGER_PROJECTION_KINDS)[number]

export interface LedgerFieldRole {
    fieldCodename: string
    role: LedgerFieldRoleKind
    aggregate?: LedgerResourceAggregate
    required?: boolean
}

export interface LedgerProjectionDefinition {
    codename: string
    kind: LedgerProjectionKind
    dimensions: string[]
    resources: string[]
    period?: LedgerPeriodicity
}

export interface LedgerIdempotencyConfig {
    keyFields: string[]
}

export interface LedgerConfig {
    mode: LedgerMode
    mutationPolicy: LedgerMutationPolicy
    periodicity: LedgerPeriodicity
    effectiveDateField?: string
    sourcePolicy: LedgerSourcePolicy
    registrarKinds: string[]
    fieldRoles: LedgerFieldRole[]
    projections: LedgerProjectionDefinition[]
    idempotency: LedgerIdempotencyConfig
}

export const DEFAULT_LEDGER_CONFIG: LedgerConfig = {
    mode: 'facts',
    mutationPolicy: 'appendOnly',
    periodicity: 'instant',
    sourcePolicy: 'registrar',
    registrarKinds: [],
    fieldRoles: [],
    projections: [],
    idempotency: {
        keyFields: ['source_object_id', 'source_row_id', 'source_line_id']
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const trimmedStringSchema = z.string().trim().min(1).max(128)
const optionalTrimmedStringSchema = z.preprocess((value) => {
    if (typeof value !== 'string') return value
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}, z.string().min(1).max(128).optional())

export const ledgerFieldRoleSchema = z
    .object({
        fieldCodename: trimmedStringSchema,
        role: z.enum(LEDGER_FIELD_ROLES),
        aggregate: z.enum(LEDGER_RESOURCE_AGGREGATES).optional(),
        required: z.boolean().optional()
    })
    .strict()

export const ledgerProjectionDefinitionSchema = z
    .object({
        codename: trimmedStringSchema,
        kind: z.enum(LEDGER_PROJECTION_KINDS),
        dimensions: z.array(trimmedStringSchema).max(64),
        resources: z.array(trimmedStringSchema).max(64),
        period: z.enum(LEDGER_PERIODICITIES).optional()
    })
    .strict()

export const ledgerIdempotencyConfigSchema = z
    .object({
        keyFields: z.array(trimmedStringSchema).max(16)
    })
    .strict()

export const ledgerConfigSchema = z
    .object({
        mode: z.enum(LEDGER_MODES),
        mutationPolicy: z.enum(LEDGER_MUTATION_POLICIES),
        periodicity: z.enum(LEDGER_PERIODICITIES),
        effectiveDateField: optionalTrimmedStringSchema,
        sourcePolicy: z.enum(LEDGER_SOURCE_POLICIES),
        registrarKinds: z.array(z.string().trim().min(1).max(64)).max(32),
        fieldRoles: z.array(ledgerFieldRoleSchema).max(256),
        projections: z.array(ledgerProjectionDefinitionSchema).max(64),
        idempotency: ledgerIdempotencyConfigSchema
    })
    .strict()

export const ledgerConfigPatchSchema = ledgerConfigSchema
    .partial()
    .extend({
        idempotency: ledgerIdempotencyConfigSchema.partial().strict().optional()
    })
    .strict()

export const normalizeLedgerConfig = (value: unknown): LedgerConfig => {
    const raw = isRecord(value) ? value : {}
    const patch = ledgerConfigPatchSchema.parse(raw)

    return ledgerConfigSchema.parse({
        ...DEFAULT_LEDGER_CONFIG,
        ...patch,
        idempotency: {
            ...DEFAULT_LEDGER_CONFIG.idempotency,
            ...(patch.idempotency ?? {})
        }
    })
}

export const normalizeLedgerConfigFromConfig = (config: Record<string, unknown> | null | undefined): LedgerConfig =>
    normalizeLedgerConfig(isRecord(config?.ledger) ? config.ledger : undefined)

export type LedgerConfigReferenceErrorCode =
    | 'FIELD_NOT_FOUND'
    | 'DUPLICATE_FIELD_ROLE'
    | 'RESOURCE_REQUIRES_NUMBER'
    | 'DUPLICATE_PROJECTION_CODENAME'
    | 'PROJECTION_FIELD_NOT_FOUND'
    | 'PROJECTION_RESOURCE_NOT_CONFIGURED'
    | 'PROJECTION_DIMENSION_NOT_CONFIGURED'
    | 'IDEMPOTENCY_FIELD_NOT_FOUND'
    | 'EFFECTIVE_DATE_FIELD_NOT_FOUND'

export interface LedgerConfigReferenceError {
    path: Array<string | number>
    code: LedgerConfigReferenceErrorCode
}

const normalizeFieldKey = (value: string): string => value.trim().toLowerCase()

const toSnakeCaseFieldAlias = (value: string): string =>
    value
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[\s.-]+/g, '_')
        .toLowerCase()

const buildFieldReferenceKeys = (field: { codename: string; columnName?: string | null; physicalColumnName?: string | null }): string[] => {
    const keys = new Set<string>()
    const codename = field.codename.trim()
    if (codename) {
        keys.add(normalizeFieldKey(codename))
        keys.add(toSnakeCaseFieldAlias(codename))
    }

    for (const columnName of [field.columnName, field.physicalColumnName]) {
        if (typeof columnName === 'string' && columnName.trim()) {
            keys.add(normalizeFieldKey(columnName))
        }
    }

    return Array.from(keys)
}

export const validateLedgerConfigReferences = (params: {
    config: LedgerConfig
    fields: Array<{ codename: string; dataType: FieldDefinitionDataType; columnName?: string | null; physicalColumnName?: string | null }>
}): LedgerConfigReferenceError[] => {
    const fieldsByCodename = new Map<string, { codename: string; dataType: FieldDefinitionDataType }>()
    params.fields.forEach((field) => {
        buildFieldReferenceKeys(field).forEach((key) => {
            fieldsByCodename.set(key, field)
        })
    })
    const errors: LedgerConfigReferenceError[] = []
    const seenRoles = new Set<string>()
    const configuredDimensions = new Set<string>()
    const configuredResources = new Set<string>()

    params.config.fieldRoles.forEach((role, index) => {
        const fieldKey = normalizeFieldKey(role.fieldCodename)
        const field = fieldsByCodename.get(fieldKey)

        if (seenRoles.has(fieldKey)) {
            errors.push({ path: ['fieldRoles', index, 'fieldCodename'], code: 'DUPLICATE_FIELD_ROLE' })
        }
        seenRoles.add(fieldKey)

        if (!field) {
            errors.push({ path: ['fieldRoles', index, 'fieldCodename'], code: 'FIELD_NOT_FOUND' })
            return
        }

        if (role.role === 'dimension') {
            configuredDimensions.add(fieldKey)
        }
        if (role.role === 'resource') {
            configuredResources.add(fieldKey)
            if (role.aggregate !== 'count' && role.aggregate !== 'latest' && field.dataType !== 'NUMBER') {
                errors.push({ path: ['fieldRoles', index, 'aggregate'], code: 'RESOURCE_REQUIRES_NUMBER' })
            }
        }
    })

    const seenProjections = new Set<string>()
    params.config.projections.forEach((projection, projectionIndex) => {
        const projectionKey = normalizeFieldKey(projection.codename)
        if (seenProjections.has(projectionKey)) {
            errors.push({ path: ['projections', projectionIndex, 'codename'], code: 'DUPLICATE_PROJECTION_CODENAME' })
        }
        seenProjections.add(projectionKey)

        projection.dimensions.forEach((fieldCodename, dimensionIndex) => {
            const fieldKey = normalizeFieldKey(fieldCodename)
            if (!fieldsByCodename.has(fieldKey)) {
                errors.push({ path: ['projections', projectionIndex, 'dimensions', dimensionIndex], code: 'PROJECTION_FIELD_NOT_FOUND' })
                return
            }
            if (!configuredDimensions.has(fieldKey)) {
                errors.push({
                    path: ['projections', projectionIndex, 'dimensions', dimensionIndex],
                    code: 'PROJECTION_DIMENSION_NOT_CONFIGURED'
                })
            }
        })

        projection.resources.forEach((fieldCodename, resourceIndex) => {
            const fieldKey = normalizeFieldKey(fieldCodename)
            if (!fieldsByCodename.has(fieldKey)) {
                errors.push({ path: ['projections', projectionIndex, 'resources', resourceIndex], code: 'PROJECTION_FIELD_NOT_FOUND' })
                return
            }
            if (!configuredResources.has(fieldKey)) {
                errors.push({
                    path: ['projections', projectionIndex, 'resources', resourceIndex],
                    code: 'PROJECTION_RESOURCE_NOT_CONFIGURED'
                })
            }
        })
    })

    for (const [index, keyField] of params.config.idempotency.keyFields.entries()) {
        if (!fieldsByCodename.has(normalizeFieldKey(keyField))) {
            errors.push({ path: ['idempotency', 'keyFields', index], code: 'IDEMPOTENCY_FIELD_NOT_FOUND' })
        }
    }

    if (params.config.effectiveDateField && !fieldsByCodename.has(normalizeFieldKey(params.config.effectiveDateField))) {
        errors.push({ path: ['effectiveDateField'], code: 'EFFECTIVE_DATE_FIELD_NOT_FOUND' })
    }

    return errors
}
