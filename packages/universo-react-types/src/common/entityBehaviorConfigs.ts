import { z } from 'zod'

import type { ComponentDefinitionDataType } from './metahubs'
import { LEDGER_MODES, LEDGER_PERIODICITIES } from './ledgers'

const trimString = (max = 128) => z.string().trim().min(1).max(max)
const codenameSchema = trimString(128)

export const SINGLE_VALUE_SCOPES = ['global', 'workspace', 'owner', 'period'] as const
export type SingleValueScope = (typeof SINGLE_VALUE_SCOPES)[number]

export const singleValueBehaviorSchema = z
    .object({
        kind: z.literal('singleValue'),
        dataType: z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'DATE'] satisfies readonly ComponentDefinitionDataType[]),
        scope: z.enum(SINGLE_VALUE_SCOPES).default('workspace'),
        periodicity: z.enum(LEDGER_PERIODICITIES).default('none'),
        defaultValue: z.unknown().optional(),
        allowRuntimeEdit: z.boolean().default(true),
        auditChanges: z.boolean().default(true)
    })
    .strict()
export type SingleValueBehaviorConfig = z.infer<typeof singleValueBehaviorSchema>

export const catalogBehaviorSchema = z
    .object({
        kind: z.literal('catalog'),
        code: z
            .object({
                enabled: z.boolean().default(true),
                autoNumbering: z.boolean().default(false),
                unique: z.boolean().default(true),
                periodicity: z.enum(['none', 'day', 'month', 'quarter', 'year']).default('none')
            })
            .strict(),
        hierarchy: z
            .object({
                mode: z.enum(['none', 'groups-and-items', 'items-only']).default('none'),
                ownerSubordination: z.boolean().default(false)
            })
            .strict(),
        predefinedRows: z
            .array(z.object({ codename: codenameSchema, presentation: trimString(256) }).strict())
            .max(512)
            .default([])
    })
    .strict()
export type CatalogBehaviorConfig = z.infer<typeof catalogBehaviorSchema>

export const documentBehaviorSchema = z
    .object({
        kind: z.literal('document'),
        number: z
            .object({
                enabled: z.boolean().default(true),
                autoNumbering: z.boolean().default(true),
                unique: z.boolean().default(true),
                periodicity: z.enum(['none', 'day', 'month', 'quarter', 'year']).default('year'),
                minLength: z.number().int().min(1).max(32).default(9)
            })
            .strict(),
        date: z
            .object({
                fieldCodename: codenameSchema.default('Date'),
                defaultToNow: z.boolean().default(true)
            })
            .strict(),
        lifecycle: z
            .object({
                stateFieldCodename: codenameSchema.default('State'),
                states: z
                    .array(
                        z
                            .object({
                                codename: codenameSchema,
                                title: trimString(128),
                                isInitial: z.boolean().optional(),
                                isFinal: z.boolean().optional()
                            })
                            .strict()
                    )
                    .max(32)
                    .default([
                        { codename: 'Draft', title: 'Draft', isInitial: true },
                        { codename: 'Posted', title: 'Posted' },
                        { codename: 'Voided', title: 'Voided', isFinal: true }
                    ])
            })
            .strict(),
        immutability: z.enum(['none', 'posted', 'final']).default('posted')
    })
    .strict()
export type DocumentBehaviorConfig = z.infer<typeof documentBehaviorSchema>

export const documentPostingMovementSchema = z
    .object({
        targetRegisterCodename: codenameSchema,
        sourceTableCodename: codenameSchema.optional(),
        directionFieldCodename: codenameSchema.optional(),
        dimensionMappings: z.record(codenameSchema),
        resourceMappings: z.record(codenameSchema)
    })
    .strict()
export type DocumentPostingMovementConfig = z.infer<typeof documentPostingMovementSchema>

export const documentPostingSchema = z
    .object({
        kind: z.literal('documentPosting'),
        movements: z.array(documentPostingMovementSchema).max(64).default([]),
        moduleCodename: codenameSchema.optional(),
        repostPolicy: z.enum(['replace-existing-batch', 'reject-posted']).default('replace-existing-batch')
    })
    .strict()
export type DocumentPostingConfig = z.infer<typeof documentPostingSchema>

export const journalBehaviorSchema = z
    .object({
        kind: z.literal('journal'),
        sources: z
            .array(
                z
                    .object({
                        documentCodename: codenameSchema,
                        labelFieldCodename: codenameSchema.optional(),
                        numberFieldCodename: codenameSchema.default('Number'),
                        dateFieldCodename: codenameSchema.default('Date'),
                        statusFieldCodename: codenameSchema.default('State')
                    })
                    .strict()
            )
            .min(1)
            .max(64),
        defaultSort: z
            .array(z.object({ field: codenameSchema, direction: z.enum(['asc', 'desc']) }).strict())
            .max(5)
            .default([{ field: 'Date', direction: 'desc' }])
    })
    .strict()
export type JournalBehaviorConfig = z.infer<typeof journalBehaviorSchema>

export const registerBehaviorSchema = z
    .object({
        kind: z.literal('register'),
        mode: z.enum(LEDGER_MODES),
        periodicity: z.enum(LEDGER_PERIODICITIES).default('instant'),
        registrarPolicy: z.enum(['manual', 'registrar', 'both']).default('registrar'),
        movementDirection: z.enum(['none', 'debit-credit', 'in-out']).default('none'),
        dimensions: z.array(codenameSchema).max(128).default([]),
        resources: z.array(codenameSchema).max(128).default([]),
        projections: z
            .array(
                z
                    .object({
                        codename: codenameSchema,
                        dimensions: z.array(codenameSchema).max(64).default([]),
                        resources: z.array(codenameSchema).max(64).default([])
                    })
                    .strict()
            )
            .max(64)
            .default([])
    })
    .strict()
export type RegisterBehaviorConfig = z.infer<typeof registerBehaviorSchema>

export const accountChartBehaviorSchema = z
    .object({
        kind: z.literal('accountChart'),
        hierarchy: z.boolean().default(true),
        supportsOffBalance: z.boolean().default(true),
        supportsQuantity: z.boolean().default(true),
        supportsCurrency: z.boolean().default(true),
        subcontoCharacteristicChartCodename: codenameSchema.optional()
    })
    .strict()
export type AccountChartBehaviorConfig = z.infer<typeof accountChartBehaviorSchema>

export const dynamicCharacteristicSchema = z
    .object({
        kind: z.literal('dynamicCharacteristic'),
        allowedDataTypes: z
            .array(z.enum(['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'REF']))
            .min(1)
            .max(16),
        valueCatalogCodename: codenameSchema.optional()
    })
    .strict()
export type DynamicCharacteristicConfig = z.infer<typeof dynamicCharacteristicSchema>

export const calculationTypeGraphSchema = z
    .object({
        kind: z.literal('calculationTypeGraph'),
        baseTypes: z.array(codenameSchema).max(128).default([]),
        displacementTypes: z.array(codenameSchema).max(128).default([]),
        leadingTypes: z.array(codenameSchema).max(128).default([])
    })
    .strict()
export type CalculationTypeGraphConfig = z.infer<typeof calculationTypeGraphSchema>

export const entityBehaviorConfigSchema = z.discriminatedUnion('kind', [
    singleValueBehaviorSchema,
    catalogBehaviorSchema,
    documentBehaviorSchema,
    documentPostingSchema,
    journalBehaviorSchema,
    registerBehaviorSchema,
    accountChartBehaviorSchema,
    dynamicCharacteristicSchema,
    calculationTypeGraphSchema
])
export type EntityBehaviorConfig = z.infer<typeof entityBehaviorConfigSchema>

export type EntityBehaviorConfigKey =
    | 'singleValue'
    | 'catalogBehavior'
    | 'documentBehavior'
    | 'documentPosting'
    | 'journalBehavior'
    | 'registerBehavior'
    | 'accountChartBehavior'
    | 'dynamicCharacteristic'
    | 'calculationTypeGraph'

export const ENTITY_BEHAVIOR_CONFIG_KEYS = [
    'singleValue',
    'catalogBehavior',
    'documentBehavior',
    'documentPosting',
    'journalBehavior',
    'registerBehavior',
    'accountChartBehavior',
    'dynamicCharacteristic',
    'calculationTypeGraph'
] as const satisfies readonly EntityBehaviorConfigKey[]

export const normalizeEntityBehaviorConfig = (value: unknown): EntityBehaviorConfig => entityBehaviorConfigSchema.parse(value)

export const getEntityBehaviorConfig = <K extends EntityBehaviorConfigKey>(
    config: Record<string, unknown> | null | undefined,
    key: K
): Extract<EntityBehaviorConfig, { kind: string }> | null => {
    const value = config?.[key]
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null
    }
    return entityBehaviorConfigSchema.parse(value) as Extract<EntityBehaviorConfig, { kind: string }>
}

export type EntityBehaviorReferenceErrorCode =
    | 'TARGET_REGISTER_NOT_FOUND'
    | 'MODULE_NOT_FOUND'
    | 'SOURCE_TABLE_NOT_FOUND'
    | 'FIELD_MAPPING_NOT_FOUND'
    | 'JOURNAL_SOURCE_NOT_FOUND'
    | 'CHART_NOT_FOUND'
    | 'PROJECTION_NOT_FOUND'
    | 'UNKNOWN_BEHAVIOR_KIND'

export interface EntityBehaviorReferenceError {
    path: Array<string | number>
    code: EntityBehaviorReferenceErrorCode
}

export interface EntityBehaviorReferenceContext {
    registers?: readonly string[]
    modules?: readonly string[]
    sourceTables?: readonly string[]
    fields?: readonly string[]
    documents?: readonly string[]
    charts?: readonly string[]
    projections?: readonly string[]
}

const hasReference = (values: readonly string[] | undefined, codename: string): boolean =>
    Boolean(values?.some((value) => value.trim().toLowerCase() === codename.trim().toLowerCase()))

export const validateEntityBehaviorReferences = (
    config: EntityBehaviorConfig,
    context: EntityBehaviorReferenceContext
): EntityBehaviorReferenceError[] => {
    const errors: EntityBehaviorReferenceError[] = []

    if (config.kind === 'documentPosting') {
        if (config.moduleCodename && !hasReference(context.modules, config.moduleCodename)) {
            errors.push({ path: ['moduleCodename'], code: 'MODULE_NOT_FOUND' })
        }
        config.movements.forEach((movement, index) => {
            if (!hasReference(context.registers, movement.targetRegisterCodename)) {
                errors.push({ path: ['movements', index, 'targetRegisterCodename'], code: 'TARGET_REGISTER_NOT_FOUND' })
            }
            if (movement.sourceTableCodename && !hasReference(context.sourceTables, movement.sourceTableCodename)) {
                errors.push({ path: ['movements', index, 'sourceTableCodename'], code: 'SOURCE_TABLE_NOT_FOUND' })
            }
            for (const [field, mappedField] of Object.entries({
                ...movement.dimensionMappings,
                ...movement.resourceMappings
            })) {
                if (!hasReference(context.fields, mappedField)) {
                    errors.push({ path: ['movements', index, 'fieldMappings', field], code: 'FIELD_MAPPING_NOT_FOUND' })
                }
            }
        })
    }

    if (config.kind === 'journal') {
        config.sources.forEach((source, index) => {
            if (!hasReference(context.documents, source.documentCodename)) {
                errors.push({ path: ['sources', index, 'documentCodename'], code: 'JOURNAL_SOURCE_NOT_FOUND' })
            }
        })
    }

    if (config.kind === 'register') {
        config.projections.forEach((projection, index) => {
            if (context.projections && !hasReference(context.projections, projection.codename)) {
                errors.push({ path: ['projections', index, 'codename'], code: 'PROJECTION_NOT_FOUND' })
            }
        })
    }

    if (config.kind === 'accountChart' && config.subcontoCharacteristicChartCodename) {
        if (!hasReference(context.charts, config.subcontoCharacteristicChartCodename)) {
            errors.push({ path: ['subcontoCharacteristicChartCodename'], code: 'CHART_NOT_FOUND' })
        }
    }

    return errors
}
