import type { Request, Response } from 'express'
import { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import { escapeLikeWildcards } from '@universo-react/utils'
import {
    isBuiltinEntityKind,
    normalizeRuntimePageBlocks,
    recordsUnionDatasourceSchema,
    runtimeDatasourceFilterSchema,
    runtimeDatasourceSortSchema,
    sanitizeApplicationLearningContentSettings,
    COMPLETION_ITEM_STATUSES,
    calculateWeightedProgress,
    sequencePolicySchema,
    evaluateSequenceStepAvailability,
    workflowActionSchema,
    type CompletionItem,
    type BuiltinEntityKind,
    type RuntimeDatasourceFilter,
    type RuntimeDatasourceSort,
    type RecordsUnionDatasource,
    type SequencePolicy,
    type SequenceStep,
    type WorkflowAction
} from '@universo-react/types'
import {
    normalizeObjectCollectionRuntimeViewConfig,
    resolveObjectCollectionLayoutBehaviorConfig,
    resolveObjectCollectionRuntimeDashboardLayoutConfig,
    resolveApplicationLifecycleContractFromConfig
} from '@universo-react/utils'
import { generateChildTableName } from '@universo-react/schema-ddl'
import { getObjectWorkspaceLimit, getObjectWorkspaceUsage, enforceObjectWorkspaceLimit } from '../services/applicationWorkspaces'
import {
    assertRuntimeRecordMutable,
    isRuntimeRecordBehaviorEnabled,
    normalizeRuntimeRecordBehavior,
    RuntimeRecordCommandService
} from '../services/runtimeRecordBehavior'
import { RuntimeModulesService } from '../services/runtimeModulesService'
import { RuntimePostingMovementService } from '../services/runtimePostingMovements'
import { applyWorkflowAction, type WorkflowStatusValueMap } from '../services/runtimeWorkflowActions'
import type { RolePermission } from '../routes/guards'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    UUID_REGEX,
    quoteIdentifier,
    normalizeLocale,
    runtimeCodenameTextSql,
    runtimeObjectFilterSql,
    runtimeStandardKindSql,
    runtimeLayoutCapableFilterSql,
    resolveRuntimeCodenameText,
    resolvePresentationName,
    resolveLocalizedContent,
    formatRuntimeFieldLabel,
    formatRuntimeFieldPath,
    getRuntimeInputValue,
    pgNumericToNumber,
    resolveRuntimeValue,
    isSoftDeleteLifecycle,
    buildRuntimeActiveRowCondition,
    buildRuntimeDeletedRowCondition,
    buildRuntimeSoftDeleteSetClause,
    buildRuntimeRestoreSetClause,
    RUNTIME_WRITABLE_TYPES,
    coerceRuntimeValue,
    normalizeConfiguredRuntimeJsonValue,
    normalizeRuntimeTableChildInsertValue,
    normalizeRuntimeTableChildInsertValueByMeta,
    getTableRowLimits,
    getTableRowCountError,
    getEnumPresentationMode,
    getDefaultEnumValueId,
    getSetConstantConfig,
    resolveSetConstantLabel,
    resolveRefId,
    ensureEnumerationValueBelongsToTarget,
    createQueryHelper,
    resolveRuntimeSchema,
    ensureRuntimePermission,
    type RuntimeDataType,
    type RuntimeRefOption,
    type RuntimeTableChildComponentMeta,
    type SetConstantUiConfig
} from '../shared/runtimeHelpers'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const parseJsonQueryValue = (value: unknown): unknown => {
    if (typeof value !== 'string') {
        return value
    }

    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

const runtimeQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(10000).default(100),
    offset: z.coerce.number().int().min(0).default(0),
    locale: z.string().optional(),
    objectCollectionId: z.string().uuid().optional(),
    objectCollectionCodename: z.string().trim().min(1).max(128).optional(),
    lifecycleState: z.enum(['active', 'deleted']).default('active'),
    libraryView: z.enum(['all', 'recent', 'starred', 'shared']).default('all'),
    search: z.string().trim().max(200).optional(),
    sort: z.preprocess(parseJsonQueryValue, z.array(runtimeDatasourceSortSchema).max(5).optional()),
    filters: z.preprocess(parseJsonQueryValue, z.array(runtimeDatasourceFilterSchema).max(20).optional())
})

const runtimeRecordsUnionBodySchema = z
    .object({
        datasource: recordsUnionDatasourceSchema,
        limit: z.coerce.number().int().positive().max(1000).default(100),
        offset: z.coerce.number().int().min(0).default(0),
        locale: z.string().optional()
    })
    .strict()

const runtimeUpdateBodySchema = z.object({
    field: z.string().min(1),
    value: z.unknown(),
    objectCollectionId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive().optional()
})

const runtimeBulkUpdateBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    data: z.record(z.unknown()),
    expectedVersion: z.number().int().positive().optional()
})

const runtimeCreateBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    data: z.record(z.unknown())
})

const runtimeCopyBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    copyChildTables: z.boolean().optional(),
    data: z.record(z.unknown()).optional(),
    expectedVersion: z.number().int().positive().optional()
})

const runtimeReorderBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    orderedRowIds: z.array(z.string().uuid()).min(1).max(1000),
    expectedVersionsByRowId: z.record(z.string().uuid(), z.number().int().positive()).optional()
})

const runtimeRecordCommandBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive().optional()
})

const runtimeRestoreBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive().optional(),
    restoreTarget: z
        .discriminatedUnion('mode', [
            z.object({ mode: z.literal('original') }),
            z.object({
                mode: z.literal('target'),
                targetObjectCollectionId: z.string().uuid(),
                targetRecordId: z.string().uuid(),
                targetWorkspaceId: z.string().uuid().nullable().optional(),
                parentFieldCodename: z
                    .string()
                    .trim()
                    .min(1)
                    .max(128)
                    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
                    .optional()
            })
        ])
        .optional()
})

const runtimeLibraryRelationActionBodySchema = z
    .object({
        objectCollectionId: z.string().uuid(),
        active: z.boolean(),
        principalType: z.enum(['workspaceMember', 'user']).optional(),
        principalId: z.string().uuid().optional()
    })
    .strict()
    .superRefine((value, ctx) => {
        if (Boolean(value.principalType) !== Boolean(value.principalId)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Principal type and principal id must be provided together.'
            })
        }
    })

const runtimeLibraryRelationKeyParamSchema = z.enum(['recent', 'starred', 'shared'])

const buildRuntimeExpectedVersionPredicate = (expectedVersion: number | undefined, parameterIndex: number): string =>
    expectedVersion === undefined ? '' : `\n                AND COALESCE(_upl_version, 1) = $${parameterIndex}`

const createRuntimeVersionConflictFailure = (expectedVersion: number, actualVersion?: number): UpdateFailure =>
    new UpdateFailure(409, {
        error: 'Record version conflict',
        code: 'RUNTIME_RECORD_VERSION_CONFLICT',
        expectedVersion,
        ...(actualVersion === undefined ? {} : { actualVersion })
    })

const runtimeWorkflowActionBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive()
})

const runtimeContentProgressBodySchema = z
    .object({
        targetObjectCodename: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
        targetRecordId: z.string().uuid(),
        action: z.enum(['view', 'complete', 'recalculate']).default('view')
    })
    .strict()

const runtimeWorkflowActionParamSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)

const RUNTIME_RECORD_SYSTEM_FIELDS = [
    '_app_record_number',
    '_app_record_date',
    '_app_record_state',
    '_app_posted_at',
    '_app_posted_by',
    '_app_posting_batch_id',
    '_app_posting_movements',
    '_app_voided_at',
    '_app_voided_by'
] as const

const RUNTIME_OBJECT_FILTER_SQL = runtimeObjectFilterSql()
const RUNTIME_LAYOUT_CAPABLE_FILTER_SQL = runtimeLayoutCapableFilterSql()

const resolveRuntimeStandardKind = (kind: unknown): BuiltinEntityKind | null =>
    typeof kind === 'string' && isBuiltinEntityKind(kind) ? kind : null

const isRuntimeObjectTargetKind = (kind: unknown): kind is string =>
    typeof kind === 'string' && !['hub', 'set', 'enumeration', 'page', 'ledger'].includes(resolveRuntimeStandardKind(kind) ?? '')

const isRuntimeEnumerationKind = (kind: unknown): kind is string =>
    typeof kind === 'string' && resolveRuntimeStandardKind(kind) === 'enumeration'

const isRuntimeSetKind = (kind: unknown): kind is string => typeof kind === 'string' && resolveRuntimeStandardKind(kind) === 'set'

const isRuntimeHubKind = (kind: unknown): kind is string => typeof kind === 'string' && resolveRuntimeStandardKind(kind) === 'hub'

export type RuntimeObjectCollectionAttr = {
    id: string
    codename: unknown
    column_name: string
    data_type: string
    is_required: boolean
    validation_rules?: Record<string, unknown>
    target_object_id?: string | null
    target_object_kind?: string | null
    ui_config?: Record<string, unknown>
}

type RuntimeObjectCollectionRow = {
    id: string
    kind: string | null
    codename: unknown
    table_name: string
    presentation?: unknown
    config?: Record<string, unknown> | null
    lifecycleContract: ReturnType<typeof resolveApplicationLifecycleContractFromConfig>
}

type RuntimeReadableComponent = RuntimeObjectCollectionAttr & {
    data_type: RuntimeDataType
    is_display_component?: boolean
    presentation?: unknown
    sort_order?: number
}

type RuntimeColumnDefinition = {
    id: string
    codename: string
    field: string
    dataType: RuntimeDataType
    isRequired: boolean
    isDisplayComponent: boolean
    headerName: string
    validationRules: Record<string, unknown>
    uiConfig: Record<string, unknown>
    refTargetEntityId: string | null
    refTargetEntityKind: string | null
    refTargetConstantId: string | null
    refOptions?: RuntimeRefOption[]
    enumOptions?: RuntimeRefOption[]
    childColumns?: RuntimeColumnDefinition[]
}

type RuntimeRecordPickerReferenceConfig = {
    targetObjectCodenameField: string
    allowedObjectCodenames?: string[]
}

type RuntimeDateOrderRule = {
    startField: string
    endField: string
    allowEqual: boolean
    message?: string
}

type RuntimeFieldCondition = {
    field: string
    equals?: unknown
    notEquals?: unknown
    in?: unknown[]
    notIn?: unknown[]
}

type RuntimeRequiredWhenRule = {
    field: string
    when: RuntimeFieldCondition
    message?: string
}

type RuntimeDateOffsetDerivationRule = {
    targetField: string
    startField: string
    offsetDaysField: string
    when?: RuntimeFieldCondition
    clearWhen?: RuntimeFieldCondition
}

const runtimeCopyRelationRefRemapSchema = z
    .object({
        fieldCodename: z.string().trim().min(1).max(128),
        sourceObjectCodename: z.string().trim().min(1).max(128)
    })
    .strict()

const runtimeCopyRelationSchema = z
    .object({
        objectCodename: z.string().trim().min(1).max(128),
        parentFieldCodename: z.string().trim().min(1).max(128),
        orderFieldCodename: z.string().trim().min(1).max(128).optional(),
        refRemaps: z.array(runtimeCopyRelationRefRemapSchema).max(16).default([])
    })
    .strict()

type RuntimeCopyRelation = z.infer<typeof runtimeCopyRelationSchema>

type RuntimeCopyRelationsConfig =
    | {
          relations: RuntimeCopyRelation[]
          invalid: false
      }
    | {
          invalid: true
      }

const runtimeLibraryRelationSchema = z
    .object({
        objectCodename: z.string().trim().min(1).max(128),
        targetObjectFieldCodename: z.string().trim().min(1).max(128),
        targetRecordFieldCodename: z.string().trim().min(1).max(128),
        actorFieldCodename: z.string().trim().min(1).max(128).optional(),
        timestampFieldCodename: z.string().trim().min(1).max(128).optional(),
        principalTypeFieldCodename: z.string().trim().min(1).max(128).optional(),
        principalIdFieldCodename: z.string().trim().min(1).max(128).optional(),
        accessLevelFieldCodename: z.string().trim().min(1).max(128).optional(),
        defaultAccessLevel: z.enum(['canView', 'canEdit']).optional(),
        allowedPrincipalTypes: z
            .array(z.enum(['workspaceMember', 'user']))
            .max(2)
            .optional()
    })
    .strict()

const runtimeLibraryConfigSchema = z
    .object({
        recent: runtimeLibraryRelationSchema.optional(),
        starred: runtimeLibraryRelationSchema.optional(),
        shared: runtimeLibraryRelationSchema.optional()
    })
    .strict()

const runtimeRecordAccessConfigSchema = z
    .object({
        mode: z.literal('ownerOrShared'),
        ownerFieldCodename: z.string().trim().min(1).max(128).optional(),
        ownerColumnName: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
            .optional(),
        sharedRelationKey: z.literal('shared').default('shared')
    })
    .strict()
    .superRefine((value, ctx) => {
        if (!value.ownerFieldCodename && !value.ownerColumnName) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Record access requires an owner field codename or owner column name.'
            })
        }
    })

const runtimeRecordParentAccessConfigSchema = z
    .object({
        mode: z.literal('parentRecord'),
        parentObjectCodename: z.string().trim().min(1).max(128),
        parentFieldCodename: z.string().trim().min(1).max(128)
    })
    .strict()

const runtimeAccessEntryConfigSchema = z
    .object({
        principalTypeFieldCodename: z.string().trim().min(1).max(128),
        principalIdFieldCodename: z.string().trim().min(1).max(128),
        targetObjectFieldCodename: z.string().trim().min(1).max(128).optional(),
        targetRecordFieldCodename: z.string().trim().min(1).max(128).optional(),
        accessLevelFieldCodename: z.string().trim().min(1).max(128).optional(),
        supportedPrincipalTypes: z
            .array(z.enum(['workspaceMember', 'user']))
            .min(1)
            .max(2)
    })
    .strict()
    .superRefine((value, ctx) => {
        if (Boolean(value.targetObjectFieldCodename) !== Boolean(value.targetRecordFieldCodename)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Access entry target object and target record fields must be configured together.'
            })
        }
    })

type RuntimeLibraryRelation = z.infer<typeof runtimeLibraryRelationSchema>
type RuntimeLibraryConfig = z.infer<typeof runtimeLibraryConfigSchema>
type RuntimeLibraryRelationKey = z.infer<typeof runtimeLibraryRelationKeyParamSchema>
type RuntimeRecordAccessConfig = z.infer<typeof runtimeRecordAccessConfigSchema>
type RuntimeRecordParentAccessConfig = z.infer<typeof runtimeRecordParentAccessConfigSchema>
type RuntimeAccessEntryConfig = z.infer<typeof runtimeAccessEntryConfigSchema>

const normalizeRuntimeAccessLevel = (value: string | null | undefined): 'canView' | 'canEdit' | null => {
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase()
    if (normalized === 'canview') return 'canView'
    if (normalized === 'canedit') return 'canEdit'
    return null
}

type RuntimeRelationBinding = {
    tableIdent: string
    activeCondition: string
    targetObjectColumnName: string
    targetRecordColumnName: string
    actorColumnName?: string
    timestampColumnName?: string
    principalTypeColumnName?: string
    principalIdColumnName?: string
    accessLevelColumnName?: string
    allowedPrincipalTypes: Array<'workspaceMember' | 'user'>
    isSoftDelete: boolean
    lifecycleContract: ReturnType<typeof resolveApplicationLifecycleContractFromConfig>
    config?: Record<string, unknown> | null
}

const buildRuntimeRelationTimestampValueSql = (params: {
    binding: RuntimeRelationBinding
    currentObjectCodename: string
    currentUserId: string
    outerRowIdSql: string
    values: unknown[]
}): string | null => {
    if (!params.binding.actorColumnName || !params.binding.timestampColumnName) return null

    params.values.push(params.currentObjectCodename)
    const objectPlaceholder = `$${params.values.length}`
    params.values.push(params.currentUserId)
    const userPlaceholder = `$${params.values.length}`

    const relationPredicates = [
        `rel.${quoteIdentifier(params.binding.targetObjectColumnName)}::text = ${objectPlaceholder}::text`,
        `rel.${quoteIdentifier(params.binding.targetRecordColumnName)}::text = ${params.outerRowIdSql}::text`,
        `rel.${quoteIdentifier(params.binding.actorColumnName)}::text = ${userPlaceholder}::text`,
        params.binding.activeCondition
    ]

    return `(
      SELECT rel.${quoteIdentifier(params.binding.timestampColumnName)}
      FROM ${params.binding.tableIdent} rel
      WHERE ${relationPredicates.join(' AND ')}
      ORDER BY rel.${quoteIdentifier(params.binding.timestampColumnName)} DESC NULLS LAST
      LIMIT 1
    )`
}

const buildRuntimeSharedRelationTimestampValueSql = (params: {
    binding: RuntimeRelationBinding
    currentObjectCodename: string
    currentUserId: string
    outerRowIdSql: string
    values: unknown[]
}): string | null => {
    if (!params.binding.principalTypeColumnName || !params.binding.principalIdColumnName || !params.binding.timestampColumnName) {
        return null
    }

    params.values.push(params.currentObjectCodename)
    const objectPlaceholder = `$${params.values.length}`
    params.values.push(params.currentUserId)
    const userPlaceholder = `$${params.values.length}`
    params.values.push(params.binding.allowedPrincipalTypes)
    const principalTypesPlaceholder = `$${params.values.length}`

    const relationPredicates = [
        `rel.${quoteIdentifier(params.binding.targetObjectColumnName)}::text = ${objectPlaceholder}::text`,
        `rel.${quoteIdentifier(params.binding.targetRecordColumnName)}::text = ${params.outerRowIdSql}::text`,
        `rel.${quoteIdentifier(params.binding.principalTypeColumnName)} = ANY(${principalTypesPlaceholder}::text[])`,
        `rel.${quoteIdentifier(params.binding.principalIdColumnName)}::text = ${userPlaceholder}::text`,
        params.binding.activeCondition
    ]

    return `(
      SELECT rel.${quoteIdentifier(params.binding.timestampColumnName)}
      FROM ${params.binding.tableIdent} rel
      WHERE ${relationPredicates.join(' AND ')}
      ORDER BY rel.${quoteIdentifier(params.binding.timestampColumnName)} DESC NULLS LAST
      LIMIT 1
    )`
}

type RuntimeMenuPartitionPlacement = 'primary' | 'overflow' | 'hidden'

export const partitionRuntimeMenuItems = <T>(
    resolvedItems: readonly T[],
    maxPrimaryItems: number | null,
    workspaceItem: T | null,
    workspacePlacement: RuntimeMenuPartitionPlacement
): { primaryItems: T[]; overflowItems: T[] } => {
    const workspaceInPrimary = workspaceItem !== null && workspacePlacement === 'primary'
    const effectiveMaxPrimary = maxPrimaryItems === null ? null : Math.max(0, maxPrimaryItems - (workspaceInPrimary ? 1 : 0))

    const primaryItems = effectiveMaxPrimary === null ? [...resolvedItems] : resolvedItems.slice(0, effectiveMaxPrimary)
    const overflowItems = effectiveMaxPrimary === null ? [] : resolvedItems.slice(effectiveMaxPrimary)

    if (workspaceItem !== null) {
        if (workspacePlacement === 'primary') {
            primaryItems.push(workspaceItem)
        } else if (workspacePlacement === 'overflow') {
            overflowItems.push(workspaceItem)
        }
    }

    return { primaryItems, overflowItems }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const isRecordValue = (value: unknown): value is Record<string, unknown> =>
    Boolean(value && typeof value === 'object' && !Array.isArray(value))

const readTrimmedStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined
    const values = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    return values.length > 0 ? values : undefined
}

const readRuntimeRecordPickerReferenceConfig = (attr: RuntimeObjectCollectionAttr): RuntimeRecordPickerReferenceConfig | null => {
    const uiConfig = attr.ui_config ?? {}
    const rawPicker = uiConfig.runtimeRecordPicker
    const pickerConfig = isRecordValue(rawPicker) ? rawPicker : {}
    const widget =
        typeof uiConfig.widget === 'string' ? uiConfig.widget : typeof pickerConfig.widget === 'string' ? pickerConfig.widget : null
    const enabled = rawPicker === true || widget === 'runtimeRecordPicker' || widget === 'recordPicker'
    if (!enabled) return null

    const targetObjectCodenameField =
        typeof pickerConfig.targetObjectCodenameField === 'string' && pickerConfig.targetObjectCodenameField.trim().length > 0
            ? pickerConfig.targetObjectCodenameField.trim()
            : typeof uiConfig.targetObjectCodenameField === 'string' && uiConfig.targetObjectCodenameField.trim().length > 0
            ? uiConfig.targetObjectCodenameField.trim()
            : null
    if (!targetObjectCodenameField) return null

    return {
        targetObjectCodenameField,
        allowedObjectCodenames: readTrimmedStringArray(pickerConfig.allowedObjectCodenames ?? uiConfig.allowedObjectCodenames)
    }
}

const readRuntimeAttrStringValue = (row: Record<string, unknown>, attr: RuntimeObjectCollectionAttr | undefined): string | null => {
    if (!attr) return null
    const value = row[attr.column_name] ?? row[resolveRuntimeCodenameText(attr.codename)]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

const readRuntimeDateOrderRules = (config: Record<string, unknown> | null | undefined): RuntimeDateOrderRule[] => {
    const validationRoot = isRecordValue(config?.runtimeValidations)
        ? config.runtimeValidations
        : isRecordValue(config?.runtimeValidation)
        ? config.runtimeValidation
        : null
    const rawRules = Array.isArray(validationRoot?.dateOrder) ? validationRoot.dateOrder : []

    return rawRules.flatMap((rawRule): RuntimeDateOrderRule[] => {
        if (!isRecordValue(rawRule)) return []
        const startField = typeof rawRule.startField === 'string' ? rawRule.startField.trim() : ''
        const endField = typeof rawRule.endField === 'string' ? rawRule.endField.trim() : ''
        if (!startField || !endField) return []

        return [
            {
                startField,
                endField,
                allowEqual: rawRule.allowEqual !== false,
                message: typeof rawRule.message === 'string' && rawRule.message.trim().length > 0 ? rawRule.message.trim() : undefined
            }
        ]
    })
}

const readRuntimeFieldCondition = (value: unknown): RuntimeFieldCondition | null => {
    if (!isRecordValue(value)) return null
    const rawField = value.field ?? value.fieldId ?? value.codename
    if (typeof rawField !== 'string' || rawField.trim().length === 0) return null

    const condition: RuntimeFieldCondition = { field: rawField.trim() }
    if ('equals' in value) condition.equals = value.equals
    if ('value' in value && !('equals' in value)) condition.equals = value.value
    if ('notEquals' in value) condition.notEquals = value.notEquals
    if (Array.isArray(value.in)) condition.in = value.in
    if (Array.isArray(value.notIn)) condition.notIn = value.notIn
    return condition
}

const readRuntimeRequiredWhenRules = (config: Record<string, unknown> | null | undefined): RuntimeRequiredWhenRule[] => {
    const validationRoot = isRecordValue(config?.runtimeValidations)
        ? config.runtimeValidations
        : isRecordValue(config?.runtimeValidation)
        ? config.runtimeValidation
        : null
    const rawRules = Array.isArray(validationRoot?.requiredWhen) ? validationRoot.requiredWhen : []

    return rawRules.flatMap((rawRule): RuntimeRequiredWhenRule[] => {
        if (!isRecordValue(rawRule)) return []
        const rawField = rawRule.field ?? rawRule.fieldId ?? rawRule.codename
        const field = typeof rawField === 'string' ? rawField.trim() : ''
        const when = readRuntimeFieldCondition(rawRule.when)
        if (!field || !when) return []

        return [
            {
                field,
                when,
                message: typeof rawRule.message === 'string' && rawRule.message.trim().length > 0 ? rawRule.message.trim() : undefined
            }
        ]
    })
}

const readRuntimeDateOffsetDerivationRules = (config: Record<string, unknown> | null | undefined): RuntimeDateOffsetDerivationRule[] => {
    const derivationRoot = isRecordValue(config?.runtimeDerivations)
        ? config.runtimeDerivations
        : isRecordValue(config?.runtimeDerivedFields)
        ? config.runtimeDerivedFields
        : null
    const rawRules = Array.isArray(derivationRoot?.dateOffset) ? derivationRoot.dateOffset : []

    return rawRules.flatMap((rawRule): RuntimeDateOffsetDerivationRule[] => {
        if (!isRecordValue(rawRule)) return []
        const targetField = typeof rawRule.targetField === 'string' ? rawRule.targetField.trim() : ''
        const startField = typeof rawRule.startField === 'string' ? rawRule.startField.trim() : ''
        const offsetDaysField = typeof rawRule.offsetDaysField === 'string' ? rawRule.offsetDaysField.trim() : ''
        if (!targetField || !startField || !offsetDaysField) return []

        const when = readRuntimeFieldCondition(rawRule.when)
        const clearWhen = readRuntimeFieldCondition(rawRule.clearWhen)

        return [
            {
                targetField,
                startField,
                offsetDaysField,
                when: when ?? undefined,
                clearWhen: clearWhen ?? undefined
            }
        ]
    })
}

const buildRuntimeAttrLookup = (attrs: RuntimeObjectCollectionAttr[]): Map<string, RuntimeObjectCollectionAttr> => {
    const attrsByKey = new Map<string, RuntimeObjectCollectionAttr>()
    for (const attr of attrs) {
        const columnName = attr.column_name.trim()
        const codename = resolveRuntimeCodenameText(attr.codename).trim()
        attrsByKey.set(columnName, attr)
        attrsByKey.set(columnName.toLowerCase(), attr)
        attrsByKey.set(codename, attr)
        attrsByKey.set(codename.toLowerCase(), attr)
    }
    return attrsByKey
}

const readRuntimeAttrValue = (row: Record<string, unknown>, attr: RuntimeObjectCollectionAttr): unknown =>
    row[attr.column_name] ?? row[resolveRuntimeCodenameText(attr.codename)]

const runtimeValuesEqual = (left: unknown, right: unknown): boolean => {
    if (Object.is(left, right)) return true
    if (left == null || right == null) return false
    return String(left) === String(right)
}

const runtimeValuePresent = (value: unknown): boolean => {
    if (value === null || value === undefined) return false
    if (typeof value === 'string') return value.trim().length > 0
    return true
}

const matchesRuntimeFieldCondition = (
    condition: RuntimeFieldCondition,
    attrsByKey: Map<string, RuntimeObjectCollectionAttr>,
    row: Record<string, unknown>
): string | boolean => {
    const conditionAttr = attrsByKey.get(condition.field)
    if (!conditionAttr) return `Runtime required validation references missing field: ${condition.field}`

    const currentValue = readRuntimeAttrValue(row, conditionAttr)
    let hasOperator = false

    if ('equals' in condition) {
        hasOperator = true
        if (!runtimeValuesEqual(currentValue, condition.equals)) return false
    }

    if ('notEquals' in condition) {
        hasOperator = true
        if (runtimeValuesEqual(currentValue, condition.notEquals)) return false
    }

    if (condition.in) {
        hasOperator = true
        if (!condition.in.some((candidate) => runtimeValuesEqual(currentValue, candidate))) return false
    }

    if (condition.notIn) {
        hasOperator = true
        if (condition.notIn.some((candidate) => runtimeValuesEqual(currentValue, candidate))) return false
    }

    return hasOperator ? true : runtimeValuePresent(currentValue)
}

const parseRuntimeDateValue = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null
    if (value instanceof Date) {
        return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    }
    if (typeof value !== 'string' && typeof value !== 'number') return Number.NaN

    const raw = String(value).trim()
    if (!raw) return Number.NaN
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
    if (dateOnlyMatch) {
        const year = Number(dateOnlyMatch[1])
        const month = Number(dateOnlyMatch[2])
        const day = Number(dateOnlyMatch[3])
        const time = Date.UTC(year, month - 1, day)
        const date = new Date(time)
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? time : Number.NaN
    }

    const dateTime = new Date(raw)
    if (Number.isNaN(dateTime.getTime())) return Number.NaN
    return Date.UTC(dateTime.getUTCFullYear(), dateTime.getUTCMonth(), dateTime.getUTCDate())
}

const formatRuntimeDateOnly = (time: number): string => new Date(time).toISOString().slice(0, 10)

const addRuntimeDateOnlyDays = (time: number, days: number): string => {
    const date = new Date(time)
    date.setUTCDate(date.getUTCDate() + days)
    return formatRuntimeDateOnly(date.getTime())
}

const readRuntimeOffsetDays = (value: unknown): number | null => {
    const numeric = typeof value === 'number' ? value : typeof value === 'string' && value.trim().length > 0 ? Number(value) : Number.NaN
    if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 0 || numeric > 3650) return null
    return numeric
}

const applyRuntimeDateOffsetDerivations = ({
    config,
    attrs,
    row
}: {
    config: Record<string, unknown> | null | undefined
    attrs: RuntimeObjectCollectionAttr[]
    row: Record<string, unknown>
}): { row: Record<string, unknown>; error: string | null } => {
    const rules = readRuntimeDateOffsetDerivationRules(config)
    if (rules.length === 0) return { row, error: null }

    const attrsByKey = buildRuntimeAttrLookup(attrs)
    const nextRow = { ...row }

    for (const rule of rules) {
        const targetAttr = attrsByKey.get(rule.targetField)
        const startAttr = attrsByKey.get(rule.startField)
        const offsetAttr = attrsByKey.get(rule.offsetDaysField)
        if (!targetAttr || !startAttr || !offsetAttr) {
            return {
                row,
                error: `Runtime date derivation references missing field: ${
                    !targetAttr ? rule.targetField : !startAttr ? rule.startField : rule.offsetDaysField
                }`
            }
        }
        if (targetAttr.data_type !== 'DATE' || startAttr.data_type !== 'DATE' || offsetAttr.data_type !== 'NUMBER') {
            return {
                row,
                error: `Runtime date derivation fields must be DATE, DATE, NUMBER: ${rule.targetField}, ${rule.startField}, ${rule.offsetDaysField}`
            }
        }

        if (rule.clearWhen) {
            const clearConditionResult = matchesRuntimeFieldCondition(rule.clearWhen, attrsByKey, nextRow)
            if (typeof clearConditionResult === 'string') return { row, error: clearConditionResult }
            if (clearConditionResult) {
                nextRow[targetAttr.column_name] = null
                continue
            }
        }

        if (rule.when) {
            const conditionResult = matchesRuntimeFieldCondition(rule.when, attrsByKey, nextRow)
            if (typeof conditionResult === 'string') return { row, error: conditionResult }
            if (!conditionResult) continue
        }

        const startValue = parseRuntimeDateValue(readRuntimeAttrValue(nextRow, startAttr))
        const offsetDays = readRuntimeOffsetDays(readRuntimeAttrValue(nextRow, offsetAttr))
        if (startValue === null || Number.isNaN(startValue)) {
            return { row, error: `Runtime date derivation requires valid date: ${formatRuntimeFieldLabel(startAttr.codename)}` }
        }
        if (offsetDays === null) {
            return { row, error: `Runtime date derivation requires valid day offset: ${formatRuntimeFieldLabel(offsetAttr.codename)}` }
        }

        nextRow[targetAttr.column_name] = addRuntimeDateOnlyDays(startValue, offsetDays)
    }

    return { row: nextRow, error: null }
}

const validateRuntimeRequiredWhenRules = ({
    config,
    attrs,
    row
}: {
    config: Record<string, unknown> | null | undefined
    attrs: RuntimeObjectCollectionAttr[]
    row: Record<string, unknown>
}): string | null => {
    const requiredRules = readRuntimeRequiredWhenRules(config)
    if (requiredRules.length === 0) return null

    const attrsByKey = buildRuntimeAttrLookup(attrs)
    for (const rule of requiredRules) {
        const targetAttr = attrsByKey.get(rule.field)
        if (!targetAttr) {
            return `Runtime required validation references missing field: ${rule.field}`
        }

        const conditionResult = matchesRuntimeFieldCondition(rule.when, attrsByKey, row)
        if (typeof conditionResult === 'string') return conditionResult
        if (!conditionResult) continue

        const value = readRuntimeAttrValue(row, targetAttr)
        if (!runtimeValuePresent(value)) {
            const targetLabel = formatRuntimeFieldLabel(targetAttr.codename)
            const conditionLabel = formatRuntimeFieldLabel(rule.when.field)
            return rule.message ?? `Required field missing: ${targetLabel} is required when ${conditionLabel} matches`
        }
    }

    return null
}

const validateRuntimeDateOrderRules = ({
    config,
    attrs,
    row
}: {
    config: Record<string, unknown> | null | undefined
    attrs: RuntimeObjectCollectionAttr[]
    row: Record<string, unknown>
}): string | null => {
    const dateOrderRules = readRuntimeDateOrderRules(config)
    if (dateOrderRules.length === 0) return null

    const attrsByKey = buildRuntimeAttrLookup(attrs)
    for (const rule of dateOrderRules) {
        const startAttr = attrsByKey.get(rule.startField)
        const endAttr = attrsByKey.get(rule.endField)
        if (!startAttr || !endAttr) {
            return `Runtime date validation references missing field: ${!startAttr ? rule.startField : rule.endField}`
        }
        if (startAttr.data_type !== 'DATE' || endAttr.data_type !== 'DATE') {
            return `Runtime date validation fields must be DATE fields: ${rule.startField}, ${rule.endField}`
        }

        const startValue = parseRuntimeDateValue(readRuntimeAttrValue(row, startAttr))
        const endValue = parseRuntimeDateValue(readRuntimeAttrValue(row, endAttr))
        if (endValue === null) continue

        const startLabel = formatRuntimeFieldLabel(startAttr.codename)
        const endLabel = formatRuntimeFieldLabel(endAttr.codename)

        if (startValue === null) {
            return rule.message ?? `Invalid date order: ${endLabel} requires ${startLabel}`
        }
        if (Number.isNaN(startValue) || Number.isNaN(endValue)) {
            return rule.message ?? `Invalid date order: ${startLabel} and ${endLabel} must contain valid dates`
        }

        const violatesOrder = rule.allowEqual ? endValue < startValue : endValue <= startValue
        if (violatesOrder) {
            return rule.message ?? `Invalid date order: ${endLabel} must be ${rule.allowEqual ? 'on or after' : 'after'} ${startLabel}`
        }
    }

    return null
}

const readRuntimeCopyRelations = (config: Record<string, unknown> | null | undefined): RuntimeCopyRelationsConfig | null => {
    const runtimeCopy = isRecordValue(config?.runtimeCopy) ? config.runtimeCopy : null
    if (!runtimeCopy || !Object.prototype.hasOwnProperty.call(runtimeCopy, 'relations')) return null

    const parsed = z.array(runtimeCopyRelationSchema).max(16).safeParse(runtimeCopy.relations)
    if (!parsed.success) return { invalid: true }
    if (parsed.data.length === 0) return null

    return { relations: parsed.data, invalid: false }
}

const readRuntimeLibraryConfig = (config: Record<string, unknown> | null | undefined): RuntimeLibraryConfig | null => {
    const parsed = runtimeLibraryConfigSchema.safeParse(config?.runtimeLibrary)
    return parsed.success ? parsed.data : null
}

const readRuntimeRecordAccessConfig = (config: Record<string, unknown> | null | undefined): RuntimeRecordAccessConfig | null => {
    const parsed = runtimeRecordAccessConfigSchema.safeParse(config?.runtimeRecordAccess)
    return parsed.success ? parsed.data : null
}

const readRuntimeRecordParentAccessConfigs = (
    config: Record<string, unknown> | null | undefined
): RuntimeRecordParentAccessConfig[] | null => {
    const raw = config?.runtimeRecordParentAccess
    if (!raw) return []
    const parsed = Array.isArray(raw)
        ? z.array(runtimeRecordParentAccessConfigSchema).max(8).safeParse(raw)
        : runtimeRecordParentAccessConfigSchema.safeParse(raw)
    if (!parsed.success) return null
    return Array.isArray(parsed.data) ? parsed.data : [parsed.data]
}

const readRuntimeAccessEntryConfig = (config: Record<string, unknown> | null | undefined): RuntimeAccessEntryConfig | null => {
    const parsed = runtimeAccessEntryConfigSchema.safeParse(config?.runtimeAccessEntry)
    return parsed.success ? parsed.data : null
}

const findRuntimeAttrByFieldKey = (attrs: RuntimeObjectCollectionAttr[], fieldKey: string): RuntimeObjectCollectionAttr | undefined =>
    buildRuntimeAttrLookup(attrs).get(fieldKey.trim().toLowerCase())

const resolveRuntimeRecordOwnerColumnName = (
    attrs: RuntimeObjectCollectionAttr[],
    config: Record<string, unknown> | null | undefined
): string | null => {
    const accessConfig = readRuntimeRecordAccessConfig(config)
    if (!accessConfig) return null

    const ownerAttr = accessConfig.ownerFieldCodename ? findRuntimeAttrByFieldKey(attrs, accessConfig.ownerFieldCodename) : undefined
    const ownerColumnName = ownerAttr?.column_name ?? accessConfig.ownerColumnName

    return ownerColumnName && IDENTIFIER_REGEX.test(ownerColumnName) ? ownerColumnName : null
}

const resolveRuntimeObjectCollectionByCodename = async (
    manager: DbExecutor,
    schemaIdent: string,
    codename: string
): Promise<{
    id: string
    codename: string
    tableName: string
    config?: Record<string, unknown> | null
    attrs: RuntimeObjectCollectionAttr[]
} | null> => {
    const rows = (await manager.query(
        `
      SELECT id, codename, table_name, config
      FROM ${schemaIdent}._app_objects
      WHERE LOWER(${runtimeCodenameTextSql('codename')}) = LOWER($1)
        AND ${RUNTIME_OBJECT_FILTER_SQL}
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [codename]
    )) as Array<{ id: string; codename: unknown; table_name: string; config?: Record<string, unknown> | null }>

    const row = rows[0]
    if (!row || !IDENTIFIER_REGEX.test(row.table_name)) return null

    return {
        id: row.id,
        codename: resolveRuntimeCodenameText(row.codename),
        tableName: row.table_name,
        config: row.config,
        attrs: await loadRuntimeObjectAttrs(manager, schemaIdent, row.id)
    }
}

const resolveRuntimeRelationBinding = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    relation: RuntimeLibraryRelation
}): Promise<RuntimeRelationBinding | null> => {
    const relatedObject = await resolveRuntimeObjectCollectionByCodename(params.manager, params.schemaIdent, params.relation.objectCodename)
    if (!relatedObject) return null

    const targetObjectAttr = findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.targetObjectFieldCodename)
    const targetRecordAttr = findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.targetRecordFieldCodename)
    const actorAttr = params.relation.actorFieldCodename
        ? findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.actorFieldCodename)
        : undefined
    const timestampAttr = params.relation.timestampFieldCodename
        ? findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.timestampFieldCodename)
        : undefined
    const principalTypeAttr = params.relation.principalTypeFieldCodename
        ? findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.principalTypeFieldCodename)
        : undefined
    const principalIdAttr = params.relation.principalIdFieldCodename
        ? findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.principalIdFieldCodename)
        : undefined
    const accessLevelAttr = params.relation.accessLevelFieldCodename
        ? findRuntimeAttrByFieldKey(relatedObject.attrs, params.relation.accessLevelFieldCodename)
        : undefined

    const requiredAttrs = [targetObjectAttr, targetRecordAttr]
    if (requiredAttrs.some((attr) => !attr || !IDENTIFIER_REGEX.test(attr.column_name))) {
        return null
    }
    if (actorAttr && !IDENTIFIER_REGEX.test(actorAttr.column_name)) return null
    if (timestampAttr && !IDENTIFIER_REGEX.test(timestampAttr.column_name)) return null
    if (principalTypeAttr && !IDENTIFIER_REGEX.test(principalTypeAttr.column_name)) return null
    if (principalIdAttr && !IDENTIFIER_REGEX.test(principalIdAttr.column_name)) return null
    if (accessLevelAttr && !IDENTIFIER_REGEX.test(accessLevelAttr.column_name)) return null
    const lifecycleContract = resolveApplicationLifecycleContractFromConfig(relatedObject.config)

    return {
        tableIdent: `${params.schemaIdent}.${quoteIdentifier(relatedObject.tableName)}`,
        activeCondition: buildRuntimeActiveRowCondition(lifecycleContract, relatedObject.config, 'rel', params.currentWorkspaceId),
        targetObjectColumnName: targetObjectAttr!.column_name,
        targetRecordColumnName: targetRecordAttr!.column_name,
        ...(actorAttr ? { actorColumnName: actorAttr.column_name } : {}),
        ...(timestampAttr ? { timestampColumnName: timestampAttr.column_name } : {}),
        ...(principalTypeAttr ? { principalTypeColumnName: principalTypeAttr.column_name } : {}),
        ...(principalIdAttr ? { principalIdColumnName: principalIdAttr.column_name } : {}),
        ...(accessLevelAttr ? { accessLevelColumnName: accessLevelAttr.column_name } : {}),
        allowedPrincipalTypes: params.relation.allowedPrincipalTypes ?? ['workspaceMember', 'user'],
        isSoftDelete: isSoftDeleteLifecycle(lifecycleContract),
        lifecycleContract,
        config: relatedObject.config
    }
}

const buildRuntimeRelationExistsClause = (params: {
    binding: RuntimeRelationBinding
    currentObjectCodename: string
    currentUserId: string
    outerRowIdSql: string
    values: unknown[]
    kind: 'recent' | 'starred' | 'shared'
    minimumAccessLevel?: 'read' | 'edit'
}) => {
    params.values.push(params.currentObjectCodename)
    const objectPlaceholder = `$${params.values.length}`
    params.values.push(params.currentUserId)
    const userPlaceholder = `$${params.values.length}`

    const relationPredicates = [
        `rel.${quoteIdentifier(params.binding.targetObjectColumnName)}::text = ${objectPlaceholder}::text`,
        `rel.${quoteIdentifier(params.binding.targetRecordColumnName)}::text = ${params.outerRowIdSql}::text`,
        params.binding.activeCondition
    ]

    if (params.kind === 'shared') {
        if (!params.binding.principalTypeColumnName || !params.binding.principalIdColumnName) {
            return null
        }
        params.values.push(params.binding.allowedPrincipalTypes)
        const principalTypesPlaceholder = `$${params.values.length}`
        relationPredicates.push(
            `rel.${quoteIdentifier(params.binding.principalTypeColumnName)} = ANY(${principalTypesPlaceholder}::text[])`
        )
        relationPredicates.push(`rel.${quoteIdentifier(params.binding.principalIdColumnName)}::text = ${userPlaceholder}::text`)
        if (params.minimumAccessLevel === 'edit') {
            if (!params.binding.accessLevelColumnName) return null
            relationPredicates.push(`LOWER(rel.${quoteIdentifier(params.binding.accessLevelColumnName)}::text) = 'canedit'`)
        }
    } else {
        if (!params.binding.actorColumnName) {
            return null
        }
        relationPredicates.push(`rel.${quoteIdentifier(params.binding.actorColumnName)}::text = ${userPlaceholder}::text`)
    }

    return `EXISTS (
      SELECT 1
      FROM ${params.binding.tableIdent} rel
      WHERE ${relationPredicates.join(' AND ')}
    )`
}

const resolveRuntimeOuterRowSql = (outerRowIdSql: string): string | null => {
    const trimmed = outerRowIdSql.trim()
    return trimmed.endsWith('.id') ? trimmed.slice(0, -3) : null
}

const buildRuntimeParentRecordAccessClauses = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    currentUserId: string | null
    permissions: Record<RolePermission, boolean>
    attrs: RuntimeObjectCollectionAttr[]
    config: Record<string, unknown> | null | undefined
    outerRowIdSql: string
    values: unknown[]
    minimumAccessLevel?: 'read' | 'edit'
    accessDepth: number
}): Promise<string[]> => {
    const parentAccessConfigs = readRuntimeRecordParentAccessConfigs(params.config)
    if (!parentAccessConfigs) return ['FALSE']
    if (parentAccessConfigs.length === 0) return []
    if (params.accessDepth > 4) return ['FALSE']

    const outerRowSql = resolveRuntimeOuterRowSql(params.outerRowIdSql)
    if (!outerRowSql) return ['FALSE']

    const clauses: string[] = []
    for (let index = 0; index < parentAccessConfigs.length; index++) {
        const parentAccessConfig = parentAccessConfigs[index]
        const parentFieldAttr = findRuntimeAttrByFieldKey(params.attrs, parentAccessConfig.parentFieldCodename)
        if (!parentFieldAttr || parentFieldAttr.data_type !== 'REF' || !IDENTIFIER_REGEX.test(parentFieldAttr.column_name)) {
            clauses.push('FALSE')
            continue
        }

        const parentObject = await resolveRuntimeObjectCollectionByCodename(
            params.manager,
            params.schemaIdent,
            parentAccessConfig.parentObjectCodename
        )
        if (!parentObject || (parentFieldAttr.target_object_id && parentFieldAttr.target_object_id !== parentObject.id)) {
            clauses.push('FALSE')
            continue
        }

        const parentAlias = `parent_access_${index}`
        const parentTableIdent = `${params.schemaIdent}.${quoteIdentifier(parentObject.tableName)}`
        const parentLifecycleContract = resolveApplicationLifecycleContractFromConfig(parentObject.config)
        const parentActiveCondition = buildRuntimeActiveRowCondition(
            parentLifecycleContract,
            parentObject.config,
            parentAlias,
            params.currentWorkspaceId
        )
        const parentAccessClause = await buildRuntimeRecordAccessClause({
            manager: params.manager,
            schemaIdent: params.schemaIdent,
            currentWorkspaceId: params.currentWorkspaceId,
            currentUserId: params.currentUserId,
            permissions: params.permissions,
            objectCodename: parentObject.codename,
            attrs: parentObject.attrs,
            config: parentObject.config,
            outerRowIdSql: `${parentAlias}.id`,
            values: params.values,
            minimumAccessLevel: params.minimumAccessLevel,
            accessDepth: params.accessDepth + 1
        })
        const parentWhereSql = [
            `${parentAlias}.id::text = ${outerRowSql}.${quoteIdentifier(parentFieldAttr.column_name)}::text`,
            parentActiveCondition,
            parentAccessClause
        ]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .join(' AND ')

        clauses.push(`EXISTS (
      SELECT 1
      FROM ${parentTableIdent} ${parentAlias}
      WHERE ${parentWhereSql}
    )`)
    }

    return clauses
}

export const buildRuntimeRecordAccessClause = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    currentUserId: string | null
    permissions: Record<RolePermission, boolean>
    objectCodename: string
    attrs: RuntimeObjectCollectionAttr[]
    config: Record<string, unknown> | null | undefined
    outerRowIdSql: string
    values: unknown[]
    minimumAccessLevel?: 'read' | 'edit'
    accessDepth?: number
}): Promise<string | null> => {
    const parentAccessClauses = await buildRuntimeParentRecordAccessClauses({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        currentUserId: params.currentUserId,
        permissions: params.permissions,
        attrs: params.attrs,
        config: params.config,
        outerRowIdSql: params.outerRowIdSql,
        values: params.values,
        minimumAccessLevel: params.minimumAccessLevel,
        accessDepth: params.accessDepth ?? 0
    })

    const accessConfig = readRuntimeRecordAccessConfig(params.config)
    if (!accessConfig || params.permissions.manageApplication || !params.currentUserId) {
        return parentAccessClauses.length > 0 ? parentAccessClauses.join(' AND ') : null
    }

    const ownerColumnName = resolveRuntimeRecordOwnerColumnName(params.attrs, params.config)
    const libraryConfig = readRuntimeLibraryConfig(params.config)
    const sharedRelation = libraryConfig?.[accessConfig.sharedRelationKey]
    if (!ownerColumnName || !sharedRelation) {
        return parentAccessClauses.length > 0 ? [...parentAccessClauses, 'FALSE'].join(' AND ') : 'FALSE'
    }

    const relationBinding = await resolveRuntimeRelationBinding({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        relation: sharedRelation
    })
    if (!relationBinding) return 'FALSE'

    params.values.push(params.currentUserId)
    const ownerPlaceholder = `$${params.values.length}`
    const sharedClause = buildRuntimeRelationExistsClause({
        binding: relationBinding,
        currentObjectCodename: params.objectCodename,
        currentUserId: params.currentUserId,
        outerRowIdSql: params.outerRowIdSql,
        values: params.values,
        kind: 'shared',
        minimumAccessLevel: params.minimumAccessLevel ?? 'read'
    })
    if (!sharedClause) return `${quoteIdentifier(ownerColumnName)} = ${ownerPlaceholder}`

    const ownerOrSharedClause = `(${quoteIdentifier(ownerColumnName)} = ${ownerPlaceholder} OR ${sharedClause})`
    return parentAccessClauses.length > 0 ? [...parentAccessClauses, ownerOrSharedClause].join(' AND ') : ownerOrSharedClause
}

const loadRuntimeRowByIdWithRecordAccess = async (params: {
    manager: DbExecutor
    schemaIdent: string
    dataTableIdent: string
    currentWorkspaceId: string | null
    currentUserId: string | null
    permissions: Record<RolePermission, boolean>
    objectCodename: string
    attrs: RuntimeObjectCollectionAttr[]
    config: Record<string, unknown> | null | undefined
    rowId: string
    rowCondition: string
    minimumAccessLevel?: 'read' | 'edit'
}): Promise<Record<string, unknown> | null> => {
    const values: unknown[] = [params.rowId]
    const accessClause = await buildRuntimeRecordAccessClause({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        currentUserId: params.currentUserId,
        permissions: params.permissions,
        objectCodename: params.objectCodename,
        attrs: params.attrs,
        config: params.config,
        outerRowIdSql: `${params.dataTableIdent}.id`,
        values,
        minimumAccessLevel: params.minimumAccessLevel
    })
    const whereSql = ['id = $1', params.rowCondition, accessClause]
        .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
        .join(' AND ')
    const rows = (await params.manager.query(
        `
      SELECT *
      FROM ${params.dataTableIdent}
      WHERE ${whereSql}
      LIMIT 1
    `,
        values
    )) as Array<Record<string, unknown>>

    return rows[0] ?? null
}

const buildRuntimeLibraryViewClause = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    currentUserId: string | null
    objectCodename: string
    config: Record<string, unknown> | null | undefined
    libraryView: 'all' | 'recent' | 'starred' | 'shared'
    outerRowIdSql: string
    values: unknown[]
}): Promise<string | null> => {
    if (params.libraryView === 'all') return null
    if (!params.currentUserId) return 'FALSE'

    const libraryConfig = readRuntimeLibraryConfig(params.config)
    const relation = libraryConfig?.[params.libraryView]
    if (!relation) return 'FALSE'

    const binding = await resolveRuntimeRelationBinding({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        relation
    })
    if (!binding) return 'FALSE'

    return buildRuntimeRelationExistsClause({
        binding,
        currentObjectCodename: params.objectCodename,
        currentUserId: params.currentUserId,
        outerRowIdSql: params.outerRowIdSql,
        values: params.values,
        kind: params.libraryView
    })
}

const validateRuntimeAccessEntryMembership = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    currentUserId: string | null
    permissions: Record<RolePermission, boolean>
    objectConfig: Record<string, unknown> | null | undefined
    attrs: RuntimeObjectCollectionAttr[]
    row: Record<string, unknown>
}): Promise<string | null> => {
    const accessConfig = readRuntimeAccessEntryConfig(params.objectConfig)
    if (!accessConfig) return null
    if (!params.currentWorkspaceId) {
        return 'Access entries require an active workspace'
    }

    const principalTypeAttr = findRuntimeAttrByFieldKey(params.attrs, accessConfig.principalTypeFieldCodename)
    const principalIdAttr = findRuntimeAttrByFieldKey(params.attrs, accessConfig.principalIdFieldCodename)
    const principalType = readRuntimeAttrStringValue(params.row, principalTypeAttr)
    const principalId = readRuntimeAttrStringValue(params.row, principalIdAttr)
    if (!principalType || !principalId) {
        return 'Access entry principal fields are required'
    }
    if (!accessConfig.supportedPrincipalTypes.includes(principalType as 'workspaceMember' | 'user')) {
        return 'Unsupported access entry principal type'
    }
    if (!UUID_REGEX.test(principalId)) {
        return 'Access entry principal must be a UUID'
    }

    const membershipRows = (await params.manager.query(
        `
      SELECT 1
      FROM ${params.schemaIdent}._app_workspace_user_roles
      WHERE workspace_id = $1
        AND user_id = $2
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [params.currentWorkspaceId, principalId]
    )) as Array<{ '?column?'?: number }>

    if (membershipRows.length === 0) return 'Access entry principal is not a member of the current workspace'

    if (accessConfig.accessLevelFieldCodename) {
        const accessLevelAttr = findRuntimeAttrByFieldKey(params.attrs, accessConfig.accessLevelFieldCodename)
        const accessLevel = readRuntimeAttrStringValue(params.row, accessLevelAttr)
        if (accessLevel && !normalizeRuntimeAccessLevel(accessLevel)) {
            return 'Access entry access level is not supported'
        }
    }

    if (!accessConfig.targetObjectFieldCodename || !accessConfig.targetRecordFieldCodename) {
        return null
    }

    const targetObjectAttr = findRuntimeAttrByFieldKey(params.attrs, accessConfig.targetObjectFieldCodename)
    const targetRecordAttr = findRuntimeAttrByFieldKey(params.attrs, accessConfig.targetRecordFieldCodename)
    const targetObjectCodename = readRuntimeAttrStringValue(params.row, targetObjectAttr)
    const targetRecordId = readRuntimeAttrStringValue(params.row, targetRecordAttr)
    if (!targetObjectCodename || !targetRecordId) {
        return 'Access entry target fields are required'
    }
    if (!UUID_REGEX.test(targetRecordId)) {
        return 'Access entry target record must be a UUID'
    }

    const targetObject = await resolveRuntimeObjectCollectionByCodename(params.manager, params.schemaIdent, targetObjectCodename)
    if (!targetObject) {
        return 'Access entry target object was not found'
    }

    const targetTableIdent = `${params.schemaIdent}.${quoteIdentifier(targetObject.tableName)}`
    const targetLifecycleContract = resolveApplicationLifecycleContractFromConfig(targetObject.config)
    const targetActiveCondition = buildRuntimeActiveRowCondition(
        targetLifecycleContract,
        targetObject.config,
        undefined,
        params.currentWorkspaceId
    )
    const targetValues: unknown[] = [targetRecordId]
    const targetAccessClause = await buildRuntimeRecordAccessClause({
        manager: params.manager,
        schemaIdent: params.schemaIdent,
        currentWorkspaceId: params.currentWorkspaceId,
        currentUserId: params.currentUserId,
        permissions: params.permissions,
        objectCodename: targetObject.codename,
        attrs: targetObject.attrs,
        config: targetObject.config,
        outerRowIdSql: `${targetTableIdent}.id`,
        values: targetValues,
        minimumAccessLevel: 'edit'
    })
    const targetWhereSql = ['id = $1', targetActiveCondition, targetAccessClause]
        .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
        .join(' AND ')
    const targetRows = (await params.manager.query(
        `
      SELECT id
      FROM ${targetTableIdent}
      WHERE ${targetWhereSql}
      LIMIT 1
    `,
        targetValues
    )) as Array<{ id: string }>

    return targetRows[0]?.id ? null : 'Access entry target row is not editable by the current user'
}

const validateRuntimeSharedRelationPrincipal = async (params: {
    manager: DbExecutor
    applicationId: string
    schemaIdent: string
    currentWorkspaceId: string | null
    binding: RuntimeRelationBinding
    principalType: 'workspaceMember' | 'user'
    principalId: string
    explicitPrincipal: boolean
}): Promise<string | null> => {
    if (!params.binding.allowedPrincipalTypes.includes(params.principalType)) {
        return 'Unsupported runtime shared principal type'
    }

    if (!params.explicitPrincipal) return null

    if (params.principalType === 'user') {
        const membershipRows = (await params.manager.query(
            `
      SELECT 1
      FROM applications.rel_application_users
      WHERE application_id = $1
        AND user_id = $2
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
            [params.applicationId, params.principalId]
        )) as Array<{ '?column?'?: number }>

        return membershipRows.length > 0 ? null : 'Runtime shared principal is not a member of the application'
    }

    if (!params.currentWorkspaceId) {
        return 'Runtime shared workspace member requires an active workspace'
    }

    const membershipRows = (await params.manager.query(
        `
      SELECT 1
      FROM ${params.schemaIdent}._app_workspace_user_roles
      WHERE workspace_id = $1
        AND user_id = $2
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [params.currentWorkspaceId, params.principalId]
    )) as Array<{ '?column?'?: number }>

    return membershipRows.length > 0 ? null : 'Runtime shared principal is not a member of the current workspace'
}

export const loadRuntimeObjectAttrs = async (
    manager: DbExecutor,
    schemaIdent: string,
    objectId: string
): Promise<RuntimeObjectCollectionAttr[]> => {
    return (await manager.query(
        `
      SELECT id, codename, column_name, data_type, is_required, validation_rules,
             target_object_id, target_object_kind, ui_config
      FROM ${schemaIdent}._app_components
      WHERE object_id = $1
        AND parent_component_id IS NULL
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST
    `,
        [objectId]
    )) as RuntimeObjectCollectionAttr[]
}

/**
 * Resolve a runtime row section and load its components from a runtime schema.
 */
const resolveRuntimeObjectCollection = async (manager: DbExecutor, schemaIdent: string, requestedObjectCollectionId?: string) => {
    const objectCollections = (await manager.query(
        `
      SELECT id, kind, codename, table_name, config
      FROM ${schemaIdent}._app_objects
    WHERE ${RUNTIME_OBJECT_FILTER_SQL}
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
    `
    )) as Array<{
        id: string
        kind: string | null
        codename: unknown
        table_name: string
        config?: Record<string, unknown> | null
    }>

    if (objectCollections.length === 0) return { objectCollection: null, attrs: [], error: 'No record collections available' } as const

    const selectedObjectCollection =
        (requestedObjectCollectionId ? objectCollections.find((c) => c.id === requestedObjectCollectionId) : undefined) ??
        objectCollections[0]
    const objectCollection = selectedObjectCollection
        ? {
              ...selectedObjectCollection,
              lifecycleContract: resolveApplicationLifecycleContractFromConfig(selectedObjectCollection.config)
          }
        : null
    if (!objectCollection) return { objectCollection: null, attrs: [], error: 'Record collection not found' } as const
    if (!IDENTIFIER_REGEX.test(objectCollection.table_name))
        return { objectCollection: null, attrs: [], error: 'Invalid table name' } as const

    const attrs = await loadRuntimeObjectAttrs(manager, schemaIdent, objectCollection.id)

    return { objectCollection, attrs, error: null } as const
}

type RuntimeProgressStoreBinding = {
    tableIdent: string
    columns: {
        targetObjectCodename: string
        targetRecordId: string
        userId: string
        status: string
        progressPercent: string
        startedAt: string
        completedAt: string
        lastViewedAt: string
    }
}

type RuntimeProgressSequencePolicyConfig =
    | {
          sequencePolicy: SequencePolicy
          invalid: false
      }
    | {
          invalid: true
      }

const runtimeProgressAggregateParentSchema = z
    .object({
        parentObjectCodename: z.string().trim().min(1).max(128),
        parentIdFieldCodename: z.string().trim().min(1).max(128),
        itemWeightFieldCodename: z.string().trim().min(1).max(128).optional(),
        itemRequiredFieldCodename: z.string().trim().min(1).max(128).optional(),
        requiredOnly: z.boolean().default(false)
    })
    .strict()

type RuntimeProgressAggregateParent = z.infer<typeof runtimeProgressAggregateParentSchema>

type RuntimeProgressAggregateParentsConfig =
    | {
          aggregateParents: RuntimeProgressAggregateParent[]
          invalid: false
      }
    | {
          invalid: true
      }

const readRuntimeProgressSequencePolicy = (
    config: Record<string, unknown> | null | undefined
): RuntimeProgressSequencePolicyConfig | null => {
    const runtimeProgress = config?.runtimeProgress
    if (!runtimeProgress || typeof runtimeProgress !== 'object' || Array.isArray(runtimeProgress)) return null

    const runtimeProgressConfig = runtimeProgress as Record<string, unknown>
    if (!Object.prototype.hasOwnProperty.call(runtimeProgressConfig, 'sequencePolicy')) return null

    const sequencePolicy = runtimeProgressConfig.sequencePolicy
    const parsed = sequencePolicySchema.safeParse(sequencePolicy)
    if (!parsed.success) return { invalid: true }
    if (parsed.data.mode === 'free') return null

    return { sequencePolicy: parsed.data, invalid: false }
}

const readRuntimeProgressAggregateParents = (
    config: Record<string, unknown> | null | undefined
): RuntimeProgressAggregateParentsConfig | null => {
    const runtimeProgress = config?.runtimeProgress
    if (!runtimeProgress || typeof runtimeProgress !== 'object' || Array.isArray(runtimeProgress)) return null

    const runtimeProgressConfig = runtimeProgress as Record<string, unknown>
    if (!Object.prototype.hasOwnProperty.call(runtimeProgressConfig, 'aggregateParents')) return null

    const parsed = z.array(runtimeProgressAggregateParentSchema).max(8).safeParse(runtimeProgressConfig.aggregateParents)
    if (!parsed.success) return { invalid: true }
    if (parsed.data.length === 0) return null

    return { aggregateParents: parsed.data, invalid: false }
}

const readRuntimeProgressString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

const readRuntimeProgressNumber = (value: unknown): number | undefined => {
    const numberValue =
        typeof value === 'number' ? value : typeof value === 'string' && value.trim().length > 0 ? Number(value) : Number.NaN
    return Number.isFinite(numberValue) ? numberValue : undefined
}

const readRuntimeProgressPrerequisiteIds = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    if (typeof value !== 'string') return []
    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
}

const COMPLETION_STATUS_SET = new Set<string>(COMPLETION_ITEM_STATUSES)

const readRuntimeProgressStatus = (value: unknown): SequenceStep['status'] =>
    typeof value === 'string' && COMPLETION_STATUS_SET.has(value) ? (value as SequenceStep['status']) : 'notStarted'

const resolveRuntimeObjectByCodename = async (
    manager: DbExecutor,
    schemaIdent: string,
    objectCodename: string,
    options: { includePages?: boolean } = {}
) => {
    const objectFilterSql = options.includePages
        ? `(${RUNTIME_OBJECT_FILTER_SQL} OR ${runtimeStandardKindSql('kind')} = 'page')`
        : RUNTIME_OBJECT_FILTER_SQL
    const rows = (await manager.query(
        `
      SELECT id, kind, codename, table_name, config
      FROM ${schemaIdent}._app_objects
      WHERE ${runtimeCodenameTextSql('codename')} = $1
        AND ${objectFilterSql}
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [objectCodename]
    )) as Array<{ id: string; codename: unknown; kind?: string | null; table_name: string | null; config?: Record<string, unknown> | null }>

    const object = rows[0]
    if (!object) {
        return null
    }

    const objectKind = resolveRuntimeStandardKind(object.kind)
    if (objectKind !== 'page' && (!object.table_name || !IDENTIFIER_REGEX.test(object.table_name))) {
        return null
    }

    return {
        ...object,
        kind: objectKind ?? object.kind ?? null,
        lifecycleContract: resolveApplicationLifecycleContractFromConfig(object.config)
    }
}

const copyRuntimeConfiguredRelations = async ({
    manager,
    schemaIdent,
    currentWorkspaceId,
    workspacesEnabled,
    userId,
    sourceParentId,
    copiedParentId,
    relations
}: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    workspacesEnabled: boolean
    userId?: string | null
    sourceParentId: string
    copiedParentId: string
    relations: RuntimeCopyRelation[]
}): Promise<void> => {
    const copiedIdsByObjectCodename = new Map<string, Map<string, string>>()

    for (const relation of relations) {
        const relationObject = await resolveRuntimeObjectByCodename(manager, schemaIdent, relation.objectCodename)
        if (!relationObject?.table_name) {
            throw new UpdateFailure(409, {
                error: 'Runtime copy relation is not configured',
                code: 'RUNTIME_COPY_RELATION_INVALID'
            })
        }

        const attrs = await loadRuntimeObjectAttrs(manager, schemaIdent, relationObject.id)
        const attrsByKey = buildRuntimeAttrLookup(attrs)
        const parentAttr = attrsByKey.get(relation.parentFieldCodename)
        const orderAttr = relation.orderFieldCodename ? attrsByKey.get(relation.orderFieldCodename) : undefined
        const refRemapByColumn = new Map(
            relation.refRemaps.flatMap((remap) => {
                const attr = attrsByKey.get(remap.fieldCodename)
                return attr && IDENTIFIER_REGEX.test(attr.column_name) ? [[attr.column_name, remap.sourceObjectCodename] as const] : []
            })
        )

        if (
            !parentAttr ||
            !IDENTIFIER_REGEX.test(parentAttr.column_name) ||
            (relation.orderFieldCodename && (!orderAttr || !IDENTIFIER_REGEX.test(orderAttr.column_name))) ||
            refRemapByColumn.size !== relation.refRemaps.length
        ) {
            throw new UpdateFailure(409, {
                error: 'Runtime copy relation is not configured',
                code: 'RUNTIME_COPY_RELATION_INVALID'
            })
        }

        const writableAttrs = attrs.filter(
            (attr) => IDENTIFIER_REGEX.test(attr.column_name) && attr.data_type !== 'TABLE' && RUNTIME_WRITABLE_TYPES.has(attr.data_type)
        )
        const writableColumns = writableAttrs.map((attr) => attr.column_name)
        if (!writableColumns.includes(parentAttr.column_name)) {
            throw new UpdateFailure(409, {
                error: 'Runtime copy relation is not configured',
                code: 'RUNTIME_COPY_RELATION_INVALID'
            })
        }

        const relationTableIdent = `${schemaIdent}.${quoteIdentifier(relationObject.table_name)}`
        const relationActiveCondition = buildRuntimeActiveRowCondition(
            relationObject.lifecycleContract,
            relationObject.config,
            undefined,
            currentWorkspaceId
        )
        const orderSql = orderAttr
            ? `ORDER BY ${quoteIdentifier(orderAttr.column_name)} ASC NULLS LAST, _upl_created_at ASC NULLS LAST, id ASC`
            : `ORDER BY _upl_created_at ASC NULLS LAST, id ASC`
        const sourceRows = (await manager.query(
            `
      SELECT id, ${writableColumns.map((column) => quoteIdentifier(column)).join(', ')}
      FROM ${relationTableIdent}
      WHERE ${quoteIdentifier(parentAttr.column_name)} = $1
        AND ${relationActiveCondition}
      ${orderSql}
    `,
            [sourceParentId]
        )) as Array<Record<string, unknown> & { id: string }>

        const relationIdMap = new Map<string, string>()
        copiedIdsByObjectCodename.set(relation.objectCodename, relationIdMap)
        if (sourceRows.length === 0) continue

        const insertColumns = [
            ...writableColumns.map((column) => quoteIdentifier(column)),
            ...(workspacesEnabled && currentWorkspaceId ? [quoteIdentifier('workspace_id')] : []),
            ...(userId ? ['_upl_created_by'] : [])
        ]

        for (const sourceRow of sourceRows) {
            const insertValues: unknown[] = []
            const placeholders: string[] = []

            for (const column of writableColumns) {
                placeholders.push(`$${insertValues.length + 1}`)
                if (column === parentAttr.column_name) {
                    insertValues.push(copiedParentId)
                    continue
                }

                const remapObjectCodename = refRemapByColumn.get(column)
                if (remapObjectCodename) {
                    const sourceRefId = typeof sourceRow[column] === 'string' ? sourceRow[column] : null
                    if (!sourceRefId) {
                        insertValues.push(sourceRow[column] ?? null)
                        continue
                    }
                    const copiedRefId = copiedIdsByObjectCodename.get(remapObjectCodename)?.get(sourceRefId)
                    if (!copiedRefId) {
                        throw new UpdateFailure(409, {
                            error: 'Runtime copy relation reference could not be remapped',
                            code: 'RUNTIME_COPY_RELATION_INVALID'
                        })
                    }
                    insertValues.push(copiedRefId)
                    continue
                }

                insertValues.push(sourceRow[column] ?? null)
            }

            if (workspacesEnabled && currentWorkspaceId) {
                placeholders.push(`$${insertValues.length + 1}`)
                insertValues.push(currentWorkspaceId)
            }
            if (userId) {
                placeholders.push(`$${insertValues.length + 1}`)
                insertValues.push(userId)
            }

            const [inserted] = (await manager.query(
                `
        INSERT INTO ${relationTableIdent} (${insertColumns.join(', ')})
        VALUES (${placeholders.join(', ')})
        RETURNING id
      `,
                insertValues
            )) as Array<{ id: string }>

            if (inserted?.id && UUID_REGEX.test(sourceRow.id)) {
                relationIdMap.set(sourceRow.id, inserted.id)
            }
        }
    }
}

const validateRuntimeRecordPickerReferences = async ({
    manager,
    schemaIdent,
    currentWorkspaceId,
    currentUserId,
    permissions,
    attrs,
    row
}: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    currentUserId?: string | null
    permissions: Record<RolePermission, boolean>
    attrs: RuntimeObjectCollectionAttr[]
    row: Record<string, unknown>
}): Promise<string | null> => {
    const attrsByKey = buildRuntimeAttrLookup(attrs)

    for (const attr of attrs) {
        const pickerConfig = readRuntimeRecordPickerReferenceConfig(attr)
        if (!pickerConfig) continue

        const targetAttr = attrsByKey.get(pickerConfig.targetObjectCodenameField)
        const targetObjectCodename = readRuntimeAttrStringValue(row, targetAttr)
        const targetRecordId = readRuntimeAttrStringValue(row, attr)

        if (!targetObjectCodename && !targetRecordId) continue
        if (!targetObjectCodename || !targetRecordId) {
            return `Invalid runtime record picker reference for ${formatRuntimeFieldLabel(attr.codename)}`
        }

        if (pickerConfig.allowedObjectCodenames && !pickerConfig.allowedObjectCodenames.includes(targetObjectCodename)) {
            return `Unsupported target object for ${formatRuntimeFieldLabel(attr.codename)}`
        }

        if (!UUID_REGEX.test(targetRecordId)) {
            return `Invalid target record ID for ${formatRuntimeFieldLabel(attr.codename)}`
        }

        const targetObject = await resolveRuntimeObjectByCodename(manager, schemaIdent, targetObjectCodename, { includePages: true })
        if (!targetObject) {
            return `Target object not found for ${formatRuntimeFieldLabel(attr.codename)}`
        }

        if (targetObject.kind === 'page') {
            if (targetObject.id !== targetRecordId) {
                return `Target record not found for ${formatRuntimeFieldLabel(attr.codename)}`
            }
            continue
        }

        if (!targetObject.table_name) {
            return `Target object not found for ${formatRuntimeFieldLabel(attr.codename)}`
        }

        const targetAttrs = await loadRuntimeObjectAttrs(manager, schemaIdent, targetObject.id)
        const targetTableIdent = `${schemaIdent}.${quoteIdentifier(targetObject.table_name)}`
        const targetActiveCondition = buildRuntimeActiveRowCondition(
            targetObject.lifecycleContract,
            targetObject.config,
            undefined,
            currentWorkspaceId
        )
        const targetValues: unknown[] = [targetRecordId]
        const targetAccessClause = await buildRuntimeRecordAccessClause({
            manager,
            schemaIdent,
            currentWorkspaceId: currentWorkspaceId ?? null,
            currentUserId: currentUserId ?? null,
            permissions,
            objectCodename: resolveRuntimeCodenameText(targetObject.codename),
            attrs: targetAttrs,
            config: targetObject.config,
            outerRowIdSql: `${targetTableIdent}.id`,
            values: targetValues
        })
        const targetWhereSql = ['id = $1', targetActiveCondition, targetAccessClause]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .join(' AND ')
        const targetRows = (await manager.query(
            `
      SELECT id
      FROM ${targetTableIdent}
      WHERE ${targetWhereSql}
      LIMIT 1
    `,
            targetValues
        )) as Array<{ id: string }>

        if (!targetRows[0]?.id) {
            return `Target record not found for ${formatRuntimeFieldLabel(attr.codename)}`
        }
    }

    return null
}

const validateRuntimeParentRecordAccessReferences = async ({
    manager,
    schemaIdent,
    currentWorkspaceId,
    currentUserId,
    permissions,
    objectConfig,
    attrs,
    row,
    minimumAccessLevel = 'edit'
}: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    currentUserId?: string | null
    permissions: Record<RolePermission, boolean>
    objectConfig: Record<string, unknown> | null | undefined
    attrs: RuntimeObjectCollectionAttr[]
    row: Record<string, unknown>
    minimumAccessLevel?: 'read' | 'edit'
}): Promise<string | null> => {
    const parentAccessConfigs = readRuntimeRecordParentAccessConfigs(objectConfig)
    if (!parentAccessConfigs) return 'Parent record access metadata is invalid'
    if (parentAccessConfigs.length === 0) return null

    for (const parentAccessConfig of parentAccessConfigs) {
        const parentFieldAttr = findRuntimeAttrByFieldKey(attrs, parentAccessConfig.parentFieldCodename)
        const parentRecordId = readRuntimeAttrStringValue(row, parentFieldAttr)

        if (
            !parentFieldAttr ||
            parentFieldAttr.data_type !== 'REF' ||
            !IDENTIFIER_REGEX.test(parentFieldAttr.column_name) ||
            !parentRecordId ||
            !UUID_REGEX.test(parentRecordId)
        ) {
            return `Parent record is required for ${formatRuntimeFieldLabel(parentAccessConfig.parentFieldCodename)}`
        }

        const parentObject = await resolveRuntimeObjectCollectionByCodename(manager, schemaIdent, parentAccessConfig.parentObjectCodename)
        if (!parentObject || (parentFieldAttr.target_object_id && parentFieldAttr.target_object_id !== parentObject.id)) {
            return `Parent record target is invalid for ${formatRuntimeFieldLabel(parentAccessConfig.parentFieldCodename)}`
        }

        const parentTableIdent = `${schemaIdent}.${quoteIdentifier(parentObject.tableName)}`
        const parentLifecycleContract = resolveApplicationLifecycleContractFromConfig(parentObject.config)
        const parentActiveCondition = buildRuntimeActiveRowCondition(
            parentLifecycleContract,
            parentObject.config,
            undefined,
            currentWorkspaceId
        )
        const parentValues: unknown[] = [parentRecordId]
        const parentAccessClause = await buildRuntimeRecordAccessClause({
            manager,
            schemaIdent,
            currentWorkspaceId: currentWorkspaceId ?? null,
            currentUserId: currentUserId ?? null,
            permissions,
            objectCodename: parentObject.codename,
            attrs: parentObject.attrs,
            config: parentObject.config,
            outerRowIdSql: `${parentTableIdent}.id`,
            values: parentValues,
            minimumAccessLevel
        })
        const parentWhereSql = ['id = $1', parentActiveCondition, parentAccessClause]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .join(' AND ')
        const parentRows = (await manager.query(
            `
      SELECT id
      FROM ${parentTableIdent}
      WHERE ${parentWhereSql}
      LIMIT 1
    `,
            parentValues
        )) as Array<{ id: string }>

        if (!parentRows[0]?.id) {
            return `Parent record is not editable for ${formatRuntimeFieldLabel(parentAccessConfig.parentFieldCodename)}`
        }
    }

    return null
}

const resolveProgressStoreBinding = async (
    manager: DbExecutor,
    schemaIdent: string,
    settings: Record<string, unknown> | null | undefined
): Promise<RuntimeProgressStoreBinding | null> => {
    const learningContentSettings = sanitizeApplicationLearningContentSettings(
        settings?.learningContent as Parameters<typeof sanitizeApplicationLearningContentSettings>[0]
    )
    const progressStore = learningContentSettings.progressStore
    if (!progressStore.enabled) {
        return null
    }

    const object = await resolveRuntimeObjectByCodename(manager, schemaIdent, progressStore.objectCodename)
    if (!object?.table_name) {
        return null
    }

    const attrs = (await manager.query(
        `
      SELECT codename, column_name
      FROM ${schemaIdent}._app_components
      WHERE object_id = $1
        AND parent_component_id IS NULL
        AND _upl_deleted = false
        AND _app_deleted = false
    `,
        [object.id]
    )) as Array<{ codename: unknown; column_name: string }>

    const attrByCodename = new Map(attrs.map((attr) => [resolveRuntimeCodenameText(attr.codename), attr.column_name]))
    const readColumn = (fieldCodename: string): string | null => {
        const column = attrByCodename.get(fieldCodename)
        return column && IDENTIFIER_REGEX.test(column) ? column : null
    }

    const columns = {
        targetObjectCodename: readColumn(progressStore.targetObjectCodenameField),
        targetRecordId: readColumn(progressStore.targetRecordIdField),
        userId: readColumn(progressStore.userIdField),
        status: readColumn(progressStore.statusField),
        progressPercent: readColumn(progressStore.progressPercentField),
        startedAt: readColumn(progressStore.startedAtField),
        completedAt: readColumn(progressStore.completedAtField),
        lastViewedAt: readColumn(progressStore.lastViewedAtField)
    }

    if (Object.values(columns).some((column) => !column)) {
        return null
    }

    return {
        tableIdent: `${schemaIdent}.${quoteIdentifier(object.table_name)}`,
        columns: columns as RuntimeProgressStoreBinding['columns']
    }
}

const assertRuntimeProgressSequenceAvailable = async ({
    manager,
    schemaIdent,
    currentWorkspaceId,
    workspacesEnabled,
    userId,
    binding,
    targetObject,
    targetObjectCodename,
    targetRecordId
}: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    workspacesEnabled: boolean
    userId: string
    binding: RuntimeProgressStoreBinding
    targetObject: {
        id: string
        table_name: string | null
        config?: Record<string, unknown> | null
        lifecycleContract: ReturnType<typeof resolveApplicationLifecycleContractFromConfig>
    }
    targetObjectCodename: string
    targetRecordId: string
}): Promise<UpdateFailure | null> => {
    const policyConfig = readRuntimeProgressSequencePolicy(targetObject.config)
    if (!policyConfig) return null
    if (policyConfig.invalid) {
        return new UpdateFailure(409, {
            error: 'Progress sequence policy is not configured for this target',
            code: 'SEQUENCE_POLICY_INVALID'
        })
    }
    if (!targetObject.table_name || !IDENTIFIER_REGEX.test(targetObject.table_name)) return null

    const policy = policyConfig.sequencePolicy
    const requiredFieldCodenames = [
        policy.scopeFieldCodename,
        policy.orderFieldCodename,
        policy.availableFromFieldCodename,
        policy.availableToFieldCodename,
        policy.dueAtFieldCodename,
        policy.prerequisiteFieldCodename
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0)

    const attrs = (await manager.query(
        `
      SELECT codename, column_name
      FROM ${schemaIdent}._app_components
      WHERE object_id = $1
        AND parent_component_id IS NULL
        AND _upl_deleted = false
        AND _app_deleted = false
    `,
        [targetObject.id]
    )) as Array<{ codename: unknown; column_name: string }>

    const attrByCodename = new Map(
        attrs
            .map((attr) => [resolveRuntimeCodenameText(attr.codename), attr.column_name] as const)
            .filter(([, column]) => IDENTIFIER_REGEX.test(column))
    )
    const readColumn = (fieldCodename: string | undefined): string | null =>
        fieldCodename ? attrByCodename.get(fieldCodename) ?? null : null

    if (requiredFieldCodenames.some((fieldCodename) => !readColumn(fieldCodename))) {
        return new UpdateFailure(409, {
            error: 'Progress sequence policy is not configured for this target',
            code: 'SEQUENCE_POLICY_INVALID'
        })
    }

    const selectedFields = requiredFieldCodenames.map((fieldCodename, index) => ({
        codename: fieldCodename,
        column: readColumn(fieldCodename)!,
        alias: `field_${index}`
    }))
    const fieldAliasByCodename = new Map(selectedFields.map((field) => [field.codename, field.alias] as const))
    const readSelectedFieldValue = (row: Record<string, unknown>, fieldCodename: string | undefined): unknown => {
        if (!fieldCodename) return undefined
        const alias = fieldAliasByCodename.get(fieldCodename)
        return alias ? row[alias] : undefined
    }
    const selectColumns = selectedFields.map(({ column, alias }) => `${quoteIdentifier(column)} AS ${quoteIdentifier(alias)}`)
    const targetTableIdent = `${schemaIdent}.${quoteIdentifier(targetObject.table_name)}`
    const targetActiveCondition = buildRuntimeActiveRowCondition(
        targetObject.lifecycleContract,
        targetObject.config,
        undefined,
        currentWorkspaceId
    )
    const targetRows = (await manager.query(
        `
      SELECT id${selectColumns.length ? `, ${selectColumns.join(', ')}` : ''}
      FROM ${targetTableIdent}
      WHERE id = $1
        AND ${targetActiveCondition}
      LIMIT 1
    `,
        [targetRecordId]
    )) as Array<Record<string, unknown> & { id: string }>
    const targetRow = targetRows[0]
    if (!targetRow) return new UpdateFailure(404, { error: 'Progress target row not found' })

    const scopeColumn = readColumn(policy.scopeFieldCodename)
    const scopeValue = readSelectedFieldValue(targetRow, policy.scopeFieldCodename)
    const siblingParams: unknown[] = []
    let scopeFilter = ''
    if (scopeColumn && scopeValue !== undefined) {
        siblingParams.push(scopeValue)
        scopeFilter = `AND ${quoteIdentifier(scopeColumn)} IS NOT DISTINCT FROM $${siblingParams.length}`
    }
    const siblingRows = (await manager.query(
        `
      SELECT id${selectColumns.length ? `, ${selectColumns.join(', ')}` : ''}
      FROM ${targetTableIdent}
      WHERE ${targetActiveCondition}
        ${scopeFilter}
    `,
        siblingParams
    )) as Array<Record<string, unknown> & { id: string }>

    const siblingIds = siblingRows.map((row) => row.id).filter((id) => UUID_REGEX.test(id))
    if (siblingIds.length === 0) return new UpdateFailure(404, { error: 'Progress target row not found' })

    const q = {
        targetObjectCodename: quoteIdentifier(binding.columns.targetObjectCodename),
        targetRecordId: quoteIdentifier(binding.columns.targetRecordId),
        userId: quoteIdentifier(binding.columns.userId),
        status: quoteIdentifier(binding.columns.status),
        progressPercent: quoteIdentifier(binding.columns.progressPercent)
    }
    const progressParams: unknown[] = [targetObjectCodename, userId, siblingIds]
    const progressWorkspaceClause =
        workspacesEnabled && currentWorkspaceId ? `AND workspace_id = $${progressParams.push(currentWorkspaceId)}` : ''
    const progressRows = (await manager.query(
        `
      SELECT ${q.targetRecordId} AS target_record_id,
             ${q.status} AS status,
             ${q.progressPercent} AS progress_percent
      FROM ${binding.tableIdent}
      WHERE ${q.targetObjectCodename} = $1
        AND ${q.userId} = $2
        AND ${q.targetRecordId} = ANY($3::text[])
        ${progressWorkspaceClause}
        AND _upl_deleted = false
        AND _app_deleted = false
    `,
        progressParams
    )) as Array<{ target_record_id: string; status?: unknown; progress_percent?: unknown }>
    const progressByTargetId = new Map(progressRows.map((row) => [row.target_record_id, row]))

    const steps: SequenceStep[] = siblingRows.map((row) => {
        const progress = progressByTargetId.get(row.id)
        return {
            id: row.id,
            order: readRuntimeProgressNumber(readSelectedFieldValue(row, policy.orderFieldCodename)),
            availableFrom: readRuntimeProgressString(readSelectedFieldValue(row, policy.availableFromFieldCodename)),
            availableTo: readRuntimeProgressString(readSelectedFieldValue(row, policy.availableToFieldCodename)),
            prerequisiteStepIds: readRuntimeProgressPrerequisiteIds(readSelectedFieldValue(row, policy.prerequisiteFieldCodename)),
            status: readRuntimeProgressStatus(progress?.status),
            progressPercent: readRuntimeProgressNumber(progress?.progress_percent)
        }
    })

    const availability = evaluateSequenceStepAvailability(policy, steps, targetRecordId)
    if (availability.available) return null

    return new UpdateFailure(423, {
        error: 'Progress target is locked by sequence policy',
        code: 'SEQUENCE_ITEM_LOCKED',
        reason: availability.reason,
        lockedByStepIds: availability.lockedByStepIds
    })
}

const statusFromAggregatedProgress = (progressPercent: number): CompletionItem['status'] => {
    if (progressPercent >= 100) return 'completed'
    if (progressPercent > 0) return 'inProgress'
    return 'notStarted'
}

const toPositiveRuntimeWeight = (value: unknown): number | undefined => {
    const numberValue = readRuntimeProgressNumber(value)
    return typeof numberValue === 'number' && numberValue > 0 ? numberValue : undefined
}

const toRuntimeBoolean = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        return normalized === 'true' || normalized === '1' || normalized === 'yes'
    }
    return false
}

const applyRuntimeProgressParentAggregations = async ({
    manager,
    schemaIdent,
    currentWorkspaceId,
    workspacesEnabled,
    userId,
    binding,
    targetObject,
    targetObjectCodename,
    targetRecordId,
    aggregateParents
}: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    workspacesEnabled: boolean
    userId: string
    binding: RuntimeProgressStoreBinding
    targetObject: {
        id: string
        table_name: string | null
        config?: Record<string, unknown> | null
        lifecycleContract: ReturnType<typeof resolveApplicationLifecycleContractFromConfig>
    }
    targetObjectCodename: string
    targetRecordId: string
    aggregateParents: RuntimeProgressAggregateParent[]
}): Promise<UpdateFailure | null> => {
    if (!targetObject.table_name || !IDENTIFIER_REGEX.test(targetObject.table_name)) return null

    const targetAttrs = (await manager.query(
        `
      SELECT codename, column_name
      FROM ${schemaIdent}._app_components
      WHERE object_id = $1
        AND parent_component_id IS NULL
        AND _upl_deleted = false
        AND _app_deleted = false
    `,
        [targetObject.id]
    )) as Array<{ codename: unknown; column_name: string }>

    const attrByCodename = new Map(
        targetAttrs
            .map((attr) => [resolveRuntimeCodenameText(attr.codename), attr.column_name] as const)
            .filter(([, column]) => IDENTIFIER_REGEX.test(column))
    )
    const readColumn = (fieldCodename: string | undefined): string | null =>
        fieldCodename ? attrByCodename.get(fieldCodename) ?? null : null

    const targetTableIdent = `${schemaIdent}.${quoteIdentifier(targetObject.table_name)}`
    const targetActiveCondition = buildRuntimeActiveRowCondition(
        targetObject.lifecycleContract,
        targetObject.config,
        undefined,
        currentWorkspaceId
    )
    const progressColumns = {
        targetObjectCodename: quoteIdentifier(binding.columns.targetObjectCodename),
        targetRecordId: quoteIdentifier(binding.columns.targetRecordId),
        userId: quoteIdentifier(binding.columns.userId),
        status: quoteIdentifier(binding.columns.status),
        progressPercent: quoteIdentifier(binding.columns.progressPercent),
        startedAt: quoteIdentifier(binding.columns.startedAt),
        completedAt: quoteIdentifier(binding.columns.completedAt),
        lastViewedAt: quoteIdentifier(binding.columns.lastViewedAt)
    }

    for (const aggregate of aggregateParents) {
        const parentIdColumn = readColumn(aggregate.parentIdFieldCodename)
        const weightColumn = readColumn(aggregate.itemWeightFieldCodename)
        const requiredColumn = readColumn(aggregate.itemRequiredFieldCodename)

        if (
            !parentIdColumn ||
            (aggregate.itemWeightFieldCodename && !weightColumn) ||
            (aggregate.itemRequiredFieldCodename && !requiredColumn)
        ) {
            return new UpdateFailure(409, {
                error: 'Progress aggregation is not configured for this target',
                code: 'PROGRESS_AGGREGATION_INVALID'
            })
        }

        const selectFields = [
            { alias: 'parent_id', column: parentIdColumn },
            ...(weightColumn ? [{ alias: 'item_weight', column: weightColumn }] : []),
            ...(requiredColumn ? [{ alias: 'item_required', column: requiredColumn }] : [])
        ]
        const selectSql = selectFields.map(({ alias, column }) => `${quoteIdentifier(column)} AS ${quoteIdentifier(alias)}`).join(', ')
        const targetRows = (await manager.query(
            `
      SELECT id, ${selectSql}
      FROM ${targetTableIdent}
      WHERE id = $1
        AND ${targetActiveCondition}
      LIMIT 1
    `,
            [targetRecordId]
        )) as Array<Record<string, unknown> & { id: string; parent_id?: unknown }>
        const targetRow = targetRows[0]
        const parentId = readRuntimeProgressString(targetRow?.parent_id)
        if (!parentId || !UUID_REGEX.test(parentId)) {
            return new UpdateFailure(409, {
                error: 'Progress aggregation is not configured for this target',
                code: 'PROGRESS_AGGREGATION_INVALID'
            })
        }

        const siblingRows = (await manager.query(
            `
      SELECT id, ${selectSql}
      FROM ${targetTableIdent}
      WHERE ${targetActiveCondition}
        AND ${quoteIdentifier(parentIdColumn)} IS NOT DISTINCT FROM $1
    `,
            [parentId]
        )) as Array<Record<string, unknown> & { id: string; item_weight?: unknown; item_required?: unknown }>
        const siblingIds = siblingRows.map((row) => row.id).filter((id) => UUID_REGEX.test(id))
        if (siblingIds.length === 0) continue

        const progressParams: unknown[] = [targetObjectCodename, userId, siblingIds]
        const progressWorkspaceClause =
            workspacesEnabled && currentWorkspaceId ? `AND workspace_id = $${progressParams.push(currentWorkspaceId)}` : ''
        const progressRows = (await manager.query(
            `
      SELECT ${progressColumns.targetRecordId} AS target_record_id,
             ${progressColumns.status} AS status,
             ${progressColumns.progressPercent} AS progress_percent
      FROM ${binding.tableIdent}
      WHERE ${progressColumns.targetObjectCodename} = $1
        AND ${progressColumns.userId} = $2
        AND ${progressColumns.targetRecordId} = ANY($3::text[])
        ${progressWorkspaceClause}
        AND _upl_deleted = false
        AND _app_deleted = false
    `,
            progressParams
        )) as Array<{ target_record_id: string; status?: unknown; progress_percent?: unknown }>
        const progressByTargetId = new Map(progressRows.map((row) => [row.target_record_id, row]))
        const completionItems: CompletionItem[] = siblingRows.flatMap((row) => {
            if (aggregate.requiredOnly && requiredColumn && !toRuntimeBoolean(row.item_required)) return []
            const progress = progressByTargetId.get(row.id)
            return [
                {
                    id: row.id,
                    status: readRuntimeProgressStatus(progress?.status),
                    progressPercent: readRuntimeProgressNumber(progress?.progress_percent),
                    weight: toPositiveRuntimeWeight(row.item_weight)
                }
            ]
        })
        const aggregateProgressPercent = calculateWeightedProgress(completionItems)
        const aggregateStatus = statusFromAggregatedProgress(aggregateProgressPercent)

        const parentObject = await resolveRuntimeObjectByCodename(manager, schemaIdent, aggregate.parentObjectCodename)
        if (!parentObject?.table_name) {
            return new UpdateFailure(409, {
                error: 'Progress aggregation parent is not configured',
                code: 'PROGRESS_AGGREGATION_INVALID'
            })
        }
        const parentActiveCondition = buildRuntimeActiveRowCondition(
            parentObject.lifecycleContract,
            parentObject.config,
            undefined,
            currentWorkspaceId
        )
        const parentRows = (await manager.query(
            `
      SELECT id
      FROM ${schemaIdent}.${quoteIdentifier(parentObject.table_name)}
      WHERE id = $1
        AND ${parentActiveCondition}
      LIMIT 1
    `,
            [parentId]
        )) as Array<{ id: string }>
        if (!parentRows[0]?.id) {
            return new UpdateFailure(404, { error: 'Progress aggregation parent row not found' })
        }

        const existingParams =
            workspacesEnabled && currentWorkspaceId
                ? [aggregate.parentObjectCodename, parentId, userId, currentWorkspaceId]
                : [aggregate.parentObjectCodename, parentId, userId]
        const existingWorkspaceClause = workspacesEnabled && currentWorkspaceId ? 'AND workspace_id = $4' : ''
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
            [
                schemaIdent,
                binding.tableIdent,
                aggregate.parentObjectCodename,
                parentId,
                userId,
                workspacesEnabled && currentWorkspaceId ? currentWorkspaceId : ''
            ].join(':')
        ])
        const existingRows = (await manager.query(
            `
      SELECT id
      FROM ${binding.tableIdent}
      WHERE ${progressColumns.targetObjectCodename} = $1
        AND ${progressColumns.targetRecordId} = $2
        AND ${progressColumns.userId} = $3
        ${existingWorkspaceClause}
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
            existingParams
        )) as Array<{ id: string }>

        if (existingRows[0]?.id) {
            const updatedRows = await manager.query<{ id: string }>(
                `
      UPDATE ${binding.tableIdent}
      SET ${progressColumns.status} = $2,
          ${progressColumns.progressPercent} = $3,
          ${progressColumns.lastViewedAt} = NOW(),
          ${progressColumns.startedAt} = COALESCE(${progressColumns.startedAt}, NOW()),
          ${progressColumns.completedAt} = CASE WHEN $3 >= 100 THEN COALESCE(${progressColumns.completedAt}, NOW()) ELSE NULL END,
          _upl_updated_at = NOW(),
          _upl_updated_by = $4,
          _upl_version = COALESCE(_upl_version, 1) + 1
      WHERE id = $1
      RETURNING id
    `,
                [existingRows[0].id, aggregateStatus, aggregateProgressPercent, userId]
            )
            if (!updatedRows[0]?.id) {
                return new UpdateFailure(409, {
                    error: 'Progress aggregation update did not affect a row',
                    code: 'PROGRESS_AGGREGATION_UPDATE_CONFLICT'
                })
            }
            continue
        }

        const [{ id }] = await manager.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
        const insertColumns = [
            'id',
            progressColumns.targetObjectCodename,
            progressColumns.targetRecordId,
            progressColumns.userId,
            progressColumns.status,
            progressColumns.progressPercent,
            progressColumns.startedAt,
            progressColumns.completedAt,
            progressColumns.lastViewedAt
        ]
        const insertValues: unknown[] = [id, aggregate.parentObjectCodename, parentId, userId, aggregateStatus, aggregateProgressPercent]
        const insertPlaceholders = ['$1', '$2', '$3', '$4', '$5', '$6', 'NOW()', 'CASE WHEN $6 >= 100 THEN NOW() ELSE NULL END', 'NOW()']

        if (workspacesEnabled && currentWorkspaceId) {
            insertColumns.push('workspace_id')
            insertPlaceholders.push(`$${insertValues.length + 1}`)
            insertValues.push(currentWorkspaceId)
        }

        insertColumns.push('_upl_created_by', '_upl_updated_by')
        insertPlaceholders.push(`$${insertValues.length + 1}`, `$${insertValues.length + 2}`)
        insertValues.push(userId, userId)

        const insertedRows = await manager.query<{ id: string }>(
            `
      INSERT INTO ${binding.tableIdent} (${insertColumns.join(', ')})
      VALUES (${insertPlaceholders.join(', ')})
      RETURNING id
    `,
            insertValues
        )
        if (!insertedRows[0]?.id) {
            return new UpdateFailure(409, {
                error: 'Progress aggregation insert did not create a row',
                code: 'PROGRESS_AGGREGATION_INSERT_CONFLICT'
            })
        }
    }

    return null
}

const readConfiguredWorkflowActions = (config: Record<string, unknown> | null | undefined): WorkflowAction[] => {
    const rawActions = Array.isArray(config?.workflowActions) ? config.workflowActions : []
    return rawActions.flatMap((rawAction) => {
        const parsed = workflowActionSchema.safeParse(rawAction)
        return parsed.success ? [parsed.data] : []
    })
}

const resolveWorkflowStatusColumnName = (
    action: WorkflowAction,
    attrs: Array<{ codename: unknown; column_name: string }>
): string | null => {
    if (action.statusColumnName) return action.statusColumnName
    if (!action.statusFieldCodename) return '_app_record_state'

    const target = action.statusFieldCodename.trim()
    const attr = attrs.find((candidate) => candidate.column_name === target || resolveRuntimeCodenameText(candidate.codename) === target)
    return attr?.column_name ?? null
}

const normalizeWorkflowStatusKey = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '')

const buildWorkflowEnumStatusValueMap = async (
    manager: DbExecutor,
    schemaIdent: string,
    statusAttr:
        | {
              data_type: string
              target_object_id?: string | null
              target_object_kind?: string | null
          }
        | undefined
): Promise<WorkflowStatusValueMap | null> => {
    if (
        !statusAttr ||
        statusAttr.data_type !== 'REF' ||
        !isRuntimeEnumerationKind(statusAttr.target_object_kind) ||
        typeof statusAttr.target_object_id !== 'string'
    ) {
        return null
    }

    const rows = (await manager.query(
        `
      SELECT id, codename
      FROM ${schemaIdent}._app_values
      WHERE object_id = $1
        AND _upl_deleted = false
        AND _app_deleted = false
    `,
        [statusAttr.target_object_id]
    )) as Array<{ id: string; codename: string }>

    const statusByStoredValue: Record<string, string> = {}
    const storedValueByStatus: Record<string, string> = {}

    for (const row of rows) {
        const storedKey = normalizeWorkflowStatusKey(row.id)
        const statusKey = normalizeWorkflowStatusKey(row.codename)
        if (!storedKey || !statusKey) continue
        statusByStoredValue[storedKey] = row.codename
        storedValueByStatus[statusKey] = row.id
    }

    return { statusByStoredValue, storedValueByStatus }
}

const ensureWorkflowEnumStatusesConfigured = (action: WorkflowAction, statusValueMap: WorkflowStatusValueMap | null): void => {
    if (!statusValueMap) return

    const missingStatuses = [...action.from, action.to].filter(
        (status) => !statusValueMap.storedValueByStatus[normalizeWorkflowStatusKey(status)]
    )
    if (missingStatuses.length === 0) return

    throw new UpdateFailure(400, {
        error: 'Workflow action references status values that are not configured for the target enumeration',
        code: 'WORKFLOW_STATUS_VALUE_NOT_CONFIGURED',
        missingStatuses
    })
}

const resolveRuntimeReorderField = (
    attrs: Array<{ codename: unknown; column_name: string; data_type: string }>,
    reorderPersistenceField: string | null
) => {
    if (!reorderPersistenceField) return null

    const target = reorderPersistenceField.trim().toLowerCase()
    if (!target) return null

    return (
        attrs.find(
            (cmp) =>
                cmp.data_type === 'NUMBER' &&
                IDENTIFIER_REGEX.test(cmp.column_name) &&
                (cmp.column_name.toLowerCase() === target || resolveRuntimeCodenameText(cmp.codename).trim().toLowerCase() === target)
        ) ?? null
    )
}

const buildRuntimeRowsOrderBy = (reorderColumnName: string | null) => {
    if (!reorderColumnName || !IDENTIFIER_REGEX.test(reorderColumnName)) {
        return '_upl_created_at ASC NULLS LAST, id ASC'
    }

    return `${quoteIdentifier(reorderColumnName)} ASC NULLS LAST, _upl_created_at ASC NULLS LAST, id ASC`
}

const normalizeRuntimeListFieldKey = (value: unknown) =>
    (typeof value === 'string' ? value : resolveRuntimeCodenameText(value)).trim().toLowerCase()

type RuntimeListComponent = {
    codename: unknown
    column_name: string
    data_type: RuntimeDataType
    validation_rules?: Record<string, unknown>
}

const isLocalizedRuntimeListString = (cmp: RuntimeListComponent): boolean =>
    cmp.data_type === 'STRING' && Boolean(cmp.validation_rules?.versioned || cmp.validation_rules?.localized)

const resolveRuntimeListColumnSql = (cmp: RuntimeListComponent): string => {
    const columnSql = quoteIdentifier(cmp.column_name)
    return isLocalizedRuntimeListString(cmp) ? runtimeCodenameTextSql(columnSql) : columnSql
}

const findRuntimeListComponent = (attrs: RuntimeListComponent[], field: string) => {
    const target = normalizeRuntimeListFieldKey(field)
    if (!target) return null

    return attrs.find((cmp) => cmp.column_name.toLowerCase() === target || normalizeRuntimeListFieldKey(cmp.codename) === target) ?? null
}

const buildRuntimeListSearchClause = (attrs: RuntimeListComponent[], search: string | undefined, values: unknown[]) => {
    const query = search?.trim()
    if (!query) return null

    const searchableAttrs = attrs.filter((cmp) => cmp.data_type !== 'TABLE' && cmp.data_type !== 'JSON')
    if (searchableAttrs.length === 0) return null

    values.push(`%${escapeLikeWildcards(query)}%`)
    const placeholder = `$${values.length}`
    return `(${searchableAttrs.map((cmp) => `${resolveRuntimeListColumnSql(cmp)}::text ILIKE ${placeholder} ESCAPE '\\'`).join(' OR ')})`
}

const normalizeRuntimeFilterValue = (cmp: { data_type: RuntimeDataType }, rawValue: unknown): unknown => {
    if (rawValue === null || rawValue === undefined) return rawValue

    if (cmp.data_type === 'NUMBER') {
        const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue)
        return Number.isFinite(numeric) ? numeric : undefined
    }

    if (cmp.data_type === 'BOOLEAN') {
        if (typeof rawValue === 'boolean') return rawValue
        if (typeof rawValue === 'string') {
            const normalized = rawValue.trim().toLowerCase()
            if (normalized === 'true') return true
            if (normalized === 'false') return false
        }
        return undefined
    }

    return rawValue
}

const RUNTIME_CURRENT_USER_ID_TOKEN = '{{runtime.currentUserId}}'

const resolveRuntimeFilterValue = (rawValue: unknown, context: { currentUserId?: string | null }): unknown => {
    if (typeof rawValue === 'string' && rawValue.trim() === RUNTIME_CURRENT_USER_ID_TOKEN) {
        return context.currentUserId ?? null
    }

    if (isRecordValue(rawValue) && rawValue.runtime === 'currentUserId') {
        return context.currentUserId ?? null
    }

    return rawValue
}

const buildRuntimeListFilterClause = (
    cmp: RuntimeListComponent,
    filter: RuntimeDatasourceFilter,
    values: unknown[],
    context: { currentUserId?: string | null }
) => {
    const columnSql = resolveRuntimeListColumnSql(cmp)

    if (filter.operator === 'isEmpty') {
        return `(${columnSql} IS NULL OR ${columnSql}::text = '')`
    }
    if (filter.operator === 'isNotEmpty') {
        return `(${columnSql} IS NOT NULL AND ${columnSql}::text <> '')`
    }

    const normalizedValue = normalizeRuntimeFilterValue(cmp, resolveRuntimeFilterValue(filter.value, context))
    if (normalizedValue === undefined || normalizedValue === null || normalizedValue === '') {
        return null
    }

    const addValue = (value: unknown) => {
        values.push(value)
        return `$${values.length}`
    }

    if (filter.operator === 'contains') {
        return `${columnSql}::text ILIKE ${addValue(`%${escapeLikeWildcards(String(normalizedValue))}%`)} ESCAPE '\\'`
    }
    if (filter.operator === 'startsWith') {
        return `${columnSql}::text ILIKE ${addValue(`${escapeLikeWildcards(String(normalizedValue))}%`)} ESCAPE '\\'`
    }
    if (filter.operator === 'endsWith') {
        return `${columnSql}::text ILIKE ${addValue(`%${escapeLikeWildcards(String(normalizedValue))}`)} ESCAPE '\\'`
    }

    const comparableOperators: Record<RuntimeDatasourceFilter['operator'], string | undefined> = {
        contains: undefined,
        equals: '=',
        startsWith: undefined,
        endsWith: undefined,
        isEmpty: undefined,
        isNotEmpty: undefined,
        greaterThan: '>',
        greaterThanOrEqual: '>=',
        lessThan: '<',
        lessThanOrEqual: '<='
    }

    const sqlOperator = comparableOperators[filter.operator]
    if (!sqlOperator) return null

    return `${columnSql} ${sqlOperator} ${addValue(normalizedValue)}`
}

const buildRuntimeListClauses = (params: {
    activeCondition: string
    attrs: RuntimeListComponent[]
    search?: string
    sort?: RuntimeDatasourceSort[]
    filters?: RuntimeDatasourceFilter[]
    fallbackOrderBy: string
    currentUserId?: string | null
}) => {
    const values: unknown[] = []
    const whereClauses = [params.activeCondition]
    const searchClause = buildRuntimeListSearchClause(params.attrs, params.search, values)
    if (searchClause) {
        whereClauses.push(searchClause)
    }

    for (const filter of params.filters ?? []) {
        const cmp = findRuntimeListComponent(params.attrs, filter.field)
        if (!cmp || cmp.data_type === 'TABLE' || cmp.data_type === 'JSON') {
            continue
        }
        const filterClause = buildRuntimeListFilterClause(cmp, filter, values, { currentUserId: params.currentUserId })
        if (filterClause) {
            whereClauses.push(filterClause)
        }
    }

    const orderClauses: string[] = []
    for (const sort of params.sort ?? []) {
        const cmp = findRuntimeListComponent(params.attrs, sort.field)
        if (!cmp || cmp.data_type === 'TABLE' || cmp.data_type === 'JSON') {
            continue
        }
        orderClauses.push(`${resolveRuntimeListColumnSql(cmp)} ${sort.direction.toUpperCase()} NULLS LAST`)
    }
    orderClauses.push(params.fallbackOrderBy)

    return {
        whereSql: whereClauses.join(' AND '),
        orderBySql: orderClauses.join(', '),
        values
    }
}

const findUnsupportedRuntimeListFields = (
    attrs: RuntimeListComponent[],
    sort?: RuntimeDatasourceSort[],
    filters?: RuntimeDatasourceFilter[]
) => {
    const unsupported = new Set<string>()
    const isSupported = (field: string) => {
        const cmp = findRuntimeListComponent(attrs, field)
        return Boolean(cmp && cmp.data_type !== 'TABLE' && cmp.data_type !== 'JSON')
    }

    for (const sortItem of sort ?? []) {
        if (!isSupported(sortItem.field)) {
            unsupported.add(sortItem.field)
        }
    }
    for (const filterItem of filters ?? []) {
        if (!isSupported(filterItem.field)) {
            unsupported.add(filterItem.field)
        }
    }

    return Array.from(unsupported)
}

const runtimeSystemTableExists = async (manager: DbExecutor, schemaName: string, tableName: string) => {
    const [row] = (await manager.query(
        `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2
      ) AS exists
    `,
        [schemaName, tableName]
    )) as Array<{ exists: boolean }>

    return row?.exists === true
}

const loadRuntimeSelectedLayout = async (params: {
    manager: DbExecutor
    schemaName: string
    schemaIdent: string
    scopeEntityId: string
}) => {
    const { manager, schemaName, schemaIdent, scopeEntityId } = params
    const layoutsExist = await runtimeSystemTableExists(manager, schemaName, '_app_layouts')
    if (!layoutsExist) {
        return { layoutId: null, layoutConfig: {} as Record<string, unknown> }
    }

    const rows = (await manager.query(
        `
      SELECT id, config
      FROM ${schemaIdent}._app_layouts
      WHERE (scope_entity_id = $1 OR scope_entity_id IS NULL)
        AND is_active = true
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY CASE WHEN scope_entity_id = $1 THEN 0 ELSE 1 END,
               is_default DESC,
               is_active DESC,
               sort_order ASC,
               _upl_created_at ASC
      LIMIT 1
    `,
        [scopeEntityId]
    )) as Array<{ id: string; config: Record<string, unknown> | null }>

    return {
        layoutId: rows[0]?.id ?? null,
        layoutConfig: rows[0]?.config ?? {}
    }
}

export const resolvePreferredScopeEntityIdFromGlobalMenu = async (params: {
    manager: DbExecutor
    schemaName: string
    schemaIdent: string
}) => {
    const { manager, schemaName, schemaIdent } = params

    const resolveScopeEntityByToken = async (token: string): Promise<string | null> => {
        const normalized = token.trim()
        if (!normalized) return null

        const rows = (await manager.query(
            `
        SELECT id
        FROM ${schemaIdent}._app_objects
        WHERE _upl_deleted = false
          AND _app_deleted = false
          AND ${RUNTIME_LAYOUT_CAPABLE_FILTER_SQL}
          AND (id::text = $1 OR ${runtimeCodenameTextSql('codename')} = $1)
        ORDER BY CASE
                   WHEN id::text = $1 THEN 0
                   WHEN ${runtimeCodenameTextSql('codename')} = $1 THEN 1
                   ELSE 2
                 END,
                 ${runtimeCodenameTextSql('codename')} ASC,
                 id ASC
        LIMIT 1
      `,
            [normalized]
        )) as Array<{ id: string }>

        return rows[0]?.id ?? null
    }

    const resolveStartPageTokenFromMenuConfig = (config: Record<string, unknown>): string | null => {
        const startPage = typeof config.startPage === 'string' ? config.startPage.trim() : ''
        if (!startPage) return null

        const items = Array.isArray(config.items) ? config.items : []
        const matchedItem = items
            .map((item) => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
            .find((item) => item?.id === startPage)

        if (matchedItem) {
            for (const key of ['sectionId', 'objectCollectionId']) {
                const value = matchedItem[key]
                if (typeof value === 'string' && value.trim()) {
                    return value.trim()
                }
            }
        }

        return startPage
    }

    try {
        const [{ layoutsExists, widgetsExists }] = (await manager.query(
            `
        SELECT
          EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = '_app_layouts'
          ) AS "layoutsExists",
          EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = '_app_widgets'
          ) AS "widgetsExists"
      `,
            [schemaName]
        )) as Array<{ layoutsExists: boolean; widgetsExists: boolean }>

        if (!layoutsExists || !widgetsExists) {
            return null
        }

        const defaultLayoutRows = (await manager.query(
            `
        SELECT id
        FROM ${schemaIdent}._app_layouts
        WHERE scope_entity_id IS NULL
          AND is_active = true
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY is_default DESC,
                 is_active DESC,
                 sort_order ASC,
                 _upl_created_at ASC
        LIMIT 1
      `
        )) as Array<{ id: string }>
        const activeLayoutId = defaultLayoutRows[0]?.id

        if (!activeLayoutId) {
            return null
        }

        const menuWidgets = (await manager.query(
            `
        SELECT config
        FROM ${schemaIdent}._app_widgets
        WHERE layout_id = $1
          AND zone = 'left'
          AND widget_key = 'menuWidget'
          AND is_active = true
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY sort_order ASC, _upl_created_at ASC
      `,
            [activeLayoutId]
        )) as Array<{ config?: unknown }>

        const menuConfigs = menuWidgets
            .map((row) => (row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : null))
            .filter((cfg): cfg is Record<string, unknown> => Boolean(cfg))

        for (const cfg of menuConfigs) {
            const startPageToken = resolveStartPageTokenFromMenuConfig(cfg)
            if (!startPageToken) continue

            const scopeEntityId = await resolveScopeEntityByToken(startPageToken)
            if (scopeEntityId) {
                return scopeEntityId
            }
        }

        const boundMenuConfig = menuConfigs.find((cfg) => Boolean(cfg.bindToHub) && typeof cfg.boundHubId === 'string')

        const boundTreeEntityId = typeof boundMenuConfig?.boundHubId === 'string' ? boundMenuConfig.boundHubId : null
        if (!boundTreeEntityId) {
            return null
        }

        const preferredObjectCollectionRows = (await manager.query(
            `
        SELECT id
        FROM ${schemaIdent}._app_objects
        WHERE ${RUNTIME_OBJECT_FILTER_SQL}
          AND _upl_deleted = false
          AND _app_deleted = false
          AND config->'hubs' @> $1::jsonb
        ORDER BY COALESCE((config->>'sortOrder')::int, 0) ASC, codename ASC
        LIMIT 1
      `,
            [JSON.stringify([boundTreeEntityId])]
        )) as Array<{ id: string }>

        return preferredObjectCollectionRows[0]?.id ?? null
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[ApplicationsRuntime] Failed to resolve preferred startup section from menu binding (ignored)', e)
        return null
    }
}

const resolveEffectiveObjectCollectionRuntimeConfig = async (params: {
    manager: DbExecutor
    schemaName: string
    schemaIdent: string
    objectCollectionId: string
}) => {
    const selectedLayout = await loadRuntimeSelectedLayout({
        manager: params.manager,
        schemaName: params.schemaName,
        schemaIdent: params.schemaIdent,
        scopeEntityId: params.objectCollectionId
    })

    return {
        selectedLayout,
        runtimeConfig: resolveObjectCollectionLayoutBehaviorConfig({
            layoutConfig: selectedLayout.layoutConfig
        })
    }
}

const getNextRuntimeSortValue = async (params: {
    manager: DbExecutor
    dataTableIdent: string
    runtimeRowCondition: string
    reorderColumnName: string
}) => {
    const { manager, dataTableIdent, runtimeRowCondition, reorderColumnName } = params
    const [row] = (await manager.query(
        `
      SELECT COALESCE(MAX(${quoteIdentifier(reorderColumnName)}), -1) AS value
      FROM ${dataTableIdent}
      WHERE ${runtimeRowCondition}
    `
    )) as Array<{ value: unknown }>

    const maxValue = pgNumericToNumber(row?.value)
    return typeof maxValue === 'number' && Number.isFinite(maxValue) ? maxValue + 1 : 0
}

const loadRuntimeObjectCollections = async (manager: DbExecutor, schemaIdent: string): Promise<RuntimeObjectCollectionRow[]> => {
    const rows = (await manager.query(
        `
      SELECT id, kind, codename, table_name, presentation, config
      FROM ${schemaIdent}._app_objects
      WHERE ${RUNTIME_OBJECT_FILTER_SQL}
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
    `
    )) as Array<{
        id: string
        kind: string | null
        codename: unknown
        table_name: string
        presentation?: unknown
        config?: Record<string, unknown> | null
    }>

    return rows.map((row) => ({
        ...row,
        lifecycleContract: resolveApplicationLifecycleContractFromConfig(row.config)
    }))
}

const loadRuntimeReadableComponents = async (
    manager: DbExecutor,
    schemaIdent: string,
    objectCollectionId: string
): Promise<RuntimeReadableComponent[]> => {
    return (await manager.query(
        `
      SELECT id, codename, column_name, data_type, is_required, is_display_component,
             presentation, validation_rules, sort_order, ui_config,
             target_object_id, target_object_kind
      FROM ${schemaIdent}._app_components
      WHERE object_id = $1
        AND data_type IN ('BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE')
        AND parent_component_id IS NULL
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
    `,
        [objectCollectionId]
    )) as RuntimeReadableComponent[]
}

const loadRuntimeEnumOptionsMap = async (params: {
    manager: DbExecutor
    schemaIdent: string
    components: RuntimeReadableComponent[]
    locale: string
}): Promise<Map<string, RuntimeRefOption[]>> => {
    const enumTargetObjectIds = Array.from(
        new Set(
            params.components
                .filter((cmp) => cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind) && cmp.target_object_id)
                .map((cmp) => String(cmp.target_object_id))
        )
    )
    const enumOptionsMap = new Map<string, RuntimeRefOption[]>()
    if (enumTargetObjectIds.length === 0) return enumOptionsMap

    const enumRows = (await params.manager.query(
        `
      SELECT id, object_id, codename, presentation, sort_order, is_default
      FROM ${params.schemaIdent}._app_values
      WHERE object_id = ANY($1::uuid[])
        AND _upl_deleted = false
        AND _app_deleted = false
      ORDER BY object_id ASC, sort_order ASC, codename ASC
    `,
        [enumTargetObjectIds]
    )) as Array<{
        id: string
        object_id: string
        codename: unknown
        presentation?: unknown
        sort_order?: number
        is_default?: boolean
    }>

    for (const row of enumRows) {
        const options = enumOptionsMap.get(row.object_id) ?? []
        options.push({
            id: row.id,
            codename: resolveRuntimeCodenameText(row.codename),
            label: resolvePresentationName(row.presentation, params.locale, resolveRuntimeCodenameText(row.codename)),
            isDefault: row.is_default === true,
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
        })
        enumOptionsMap.set(row.object_id, options)
    }

    return enumOptionsMap
}

const buildRuntimeSetConstantOption = (
    valueGroupFixedValueConfig: SetConstantUiConfig | null,
    locale: string
): RuntimeRefOption[] | undefined => {
    if (!valueGroupFixedValueConfig) return undefined
    return [
        {
            id: valueGroupFixedValueConfig.id,
            label: resolveSetConstantLabel(valueGroupFixedValueConfig, locale),
            codename: valueGroupFixedValueConfig.codename ?? 'valueGroupFixedValue',
            isDefault: true,
            sortOrder: 0
        }
    ]
}

const mapRuntimeComponentToColumnDefinition = (params: {
    component: RuntimeReadableComponent
    enumOptionsMap: Map<string, RuntimeRefOption[]>
    locale: string
}): RuntimeColumnDefinition => {
    const { component, enumOptionsMap, locale } = params
    const valueGroupFixedValueConfig =
        component.data_type === 'REF' && isRuntimeSetKind(component.target_object_kind) ? getSetConstantConfig(component.ui_config) : null
    const setConstantOption = buildRuntimeSetConstantOption(valueGroupFixedValueConfig, locale)
    const enumOptions =
        component.data_type === 'REF' &&
        isRuntimeEnumerationKind(component.target_object_kind) &&
        component.target_object_id &&
        enumOptionsMap.has(component.target_object_id)
            ? enumOptionsMap.get(component.target_object_id)
            : undefined

    return {
        id: component.id,
        codename: resolveRuntimeCodenameText(component.codename),
        field: component.column_name,
        dataType: component.data_type,
        isRequired: component.is_required ?? false,
        isDisplayComponent: component.is_display_component === true,
        headerName: resolvePresentationName(component.presentation, locale, resolveRuntimeCodenameText(component.codename)),
        validationRules: component.validation_rules ?? {},
        uiConfig: {
            ...(component.ui_config ?? {}),
            ...(valueGroupFixedValueConfig?.dataType ? { setConstantDataType: valueGroupFixedValueConfig.dataType } : {})
        },
        refTargetEntityId: component.target_object_id ?? null,
        refTargetEntityKind: component.target_object_kind ?? null,
        refTargetConstantId: valueGroupFixedValueConfig?.id ?? null,
        refOptions: enumOptions ?? setConstantOption,
        enumOptions
    }
}

type RuntimeUnionSystemProjectionField = 'type' | 'title' | 'status' | 'project' | 'updatedAt' | 'recentAt' | 'sharedAt'

type RuntimeUnionProjectionSpec = {
    field: string
    sourceColumnName: string | null
    column: RuntimeColumnDefinition
    valueSql: string
}

const RUNTIME_UNION_PROJECTION_LABELS: Record<RuntimeUnionSystemProjectionField, { en: string; ru: string }> = {
    type: { en: 'Type', ru: 'Тип' },
    title: { en: 'Title', ru: 'Заголовок' },
    status: { en: 'Status', ru: 'Статус' },
    project: { en: 'Project', ru: 'Проект' },
    updatedAt: { en: 'Updated', ru: 'Обновлено' },
    recentAt: { en: 'Viewed', ru: 'Просмотрено' },
    sharedAt: { en: 'Shared', ru: 'Доступ открыт' }
}

const resolveRuntimeUnionProjectionLabel = (field: RuntimeUnionSystemProjectionField, locale: string): string =>
    locale.toLowerCase().startsWith('ru') ? RUNTIME_UNION_PROJECTION_LABELS[field].ru : RUNTIME_UNION_PROJECTION_LABELS[field].en

const quoteSqlLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`

const runtimeLocalizedTextSql = (columnRef: string, locale: string): string => {
    const localeKey = normalizeLocale(locale) || 'en'
    return `COALESCE(${columnRef}->'locales'->${quoteSqlLiteral(localeKey)}->>'content', ${runtimeCodenameTextSql(columnRef)})`
}

const buildRuntimeComponentJsonValueSql = (component: RuntimeListComponent, locale = 'en'): string =>
    component.data_type === 'STRING'
        ? isLocalizedRuntimeListString(component)
            ? runtimeLocalizedTextSql(quoteIdentifier(component.column_name), locale)
            : quoteIdentifier(component.column_name)
        : component.data_type === 'NUMBER'
        ? `to_jsonb(${quoteIdentifier(component.column_name)})`
        : quoteIdentifier(component.column_name)

const buildRuntimeUnionEnumRefLabelSql = (
    component: RuntimeReadableComponent,
    enumOptionsMap: Map<string, RuntimeRefOption[]>
): string | null => {
    if (
        component.data_type !== 'REF' ||
        !isRuntimeEnumerationKind(component.target_object_kind) ||
        !component.target_object_id ||
        !IDENTIFIER_REGEX.test(component.column_name)
    ) {
        return null
    }

    const options = enumOptionsMap.get(component.target_object_id)
    if (!options || options.length === 0) {
        return null
    }

    const optionRowsSql = options.map((option) => `(${quoteSqlLiteral(option.id)}, ${quoteSqlLiteral(option.label)})`).join(', ')

    return `
        COALESCE(
          (
            SELECT runtime_enum_option.label
            FROM (VALUES ${optionRowsSql}) AS runtime_enum_option(id, label)
            WHERE runtime_enum_option.id = ${quoteIdentifier(component.column_name)}::text
            LIMIT 1
          ),
          ${quoteIdentifier(component.column_name)}::text
        )
    `
}

const buildRuntimeUnionComponentProjectionSql = (
    component: RuntimeReadableComponent,
    enumOptionsMap: Map<string, RuntimeRefOption[]>,
    locale: string
): string => buildRuntimeUnionEnumRefLabelSql(component, enumOptionsMap) ?? buildRuntimeComponentJsonValueSql(component, locale)

const findRuntimeComponentByFieldKey = (components: RuntimeListComponent[], fieldKey: string | null | undefined) => {
    const normalizedFieldKey = typeof fieldKey === 'string' ? fieldKey.trim() : ''
    if (!normalizedFieldKey) return null
    return findRuntimeListComponent(components, normalizedFieldKey) as RuntimeReadableComponent | null
}

const buildRuntimeObjectRefLabelProjectionSql = async (params: {
    manager: DbExecutor
    schemaIdent: string
    sourceTableIdent: string
    currentWorkspaceId: string | null
    component: RuntimeReadableComponent
    locale: string
}): Promise<string | null> => {
    const targetObjectId = params.component.target_object_id
    if (
        params.component.data_type !== 'REF' ||
        !targetObjectId ||
        !isRuntimeObjectTargetKind(params.component.target_object_kind) ||
        !IDENTIFIER_REGEX.test(params.component.column_name)
    ) {
        return null
    }

    const targetObjectRows = (await params.manager.query(
        `
      SELECT id, table_name, config
      FROM ${params.schemaIdent}._app_objects
      WHERE id = $1
        AND ${RUNTIME_OBJECT_FILTER_SQL}
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        [targetObjectId]
    )) as Array<{ id: string; table_name: string; config?: Record<string, unknown> | null }>
    const targetObject = targetObjectRows[0]
    if (!targetObject || !IDENTIFIER_REGEX.test(targetObject.table_name)) return null

    const targetComponents = await loadRuntimeReadableComponents(params.manager, params.schemaIdent, targetObject.id)
    const labelComponent =
        targetComponents.find((component) => component.is_display_component && IDENTIFIER_REGEX.test(component.column_name)) ??
        targetComponents.find((component) => component.data_type === 'STRING' && IDENTIFIER_REGEX.test(component.column_name)) ??
        targetComponents.find((component) => IDENTIFIER_REGEX.test(component.column_name))
    if (!labelComponent) return null

    const targetLifecycleContract = resolveApplicationLifecycleContractFromConfig(targetObject.config)
    const targetActiveCondition = buildRuntimeActiveRowCondition(
        targetLifecycleContract,
        targetObject.config,
        'ref',
        params.currentWorkspaceId
    )
    const sourceColumnSql = `${params.sourceTableIdent}.${quoteIdentifier(params.component.column_name)}`
    const labelColumnSql = `ref.${quoteIdentifier(labelComponent.column_name)}`
    const labelSql =
        labelComponent.data_type === 'STRING'
            ? isLocalizedRuntimeListString(labelComponent)
                ? runtimeLocalizedTextSql(labelColumnSql, params.locale)
                : labelColumnSql
            : `to_jsonb(${labelColumnSql})`

    return `
        CASE
          WHEN ${sourceColumnSql} IS NULL THEN NULL
          ELSE (
            SELECT jsonb_build_object('id', ref.id::text, 'label', ${labelSql})
            FROM ${params.schemaIdent}.${quoteIdentifier(targetObject.table_name)} ref
            WHERE ref.id::text = ${sourceColumnSql}::text
              AND ${targetActiveCondition}
            LIMIT 1
          )
        END
    `
}

const buildRuntimeUnionProjectionSpecs = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId: string | null
    target: RecordsUnionDatasource['targets'][number]
    projectedFields?: string[]
    objectCollection: RuntimeObjectCollectionRow
    physicalComponents: RuntimeReadableComponent[]
    enumOptionsMap: Map<string, RuntimeRefOption[]>
    locale: string
}): Promise<RuntimeUnionProjectionSpec[]> => {
    const { target, objectCollection, physicalComponents, enumOptionsMap, locale } = params
    const specs: RuntimeUnionProjectionSpec[] = [
        {
            field: 'type',
            sourceColumnName: null,
            valueSql: quoteSqlLiteral(
                resolvePresentationName(objectCollection.presentation, locale, resolveRuntimeCodenameText(objectCollection.codename))
            ),
            column: {
                id: `${objectCollection.id}:__runtimeUnionType`,
                codename: 'Type',
                field: 'type',
                dataType: 'STRING',
                headerName: resolveRuntimeUnionProjectionLabel('type', locale),
                isDisplayComponent: false,
                isRequired: false,
                validationRules: {},
                uiConfig: {
                    gridSortable: false,
                    gridFilterable: false
                },
                refTargetEntityId: null,
                refTargetEntityKind: null,
                refTargetConstantId: null
            }
        }
    ]

    const addComponentProjection = (field: RuntimeUnionSystemProjectionField, sourceField: string | undefined) => {
        const component = findRuntimeComponentByFieldKey(physicalComponents, sourceField)
        if (!component || component.data_type === 'JSON' || component.data_type === 'TABLE') return

        const sourceColumn = mapRuntimeComponentToColumnDefinition({ component, enumOptionsMap, locale })
        specs.push({
            field,
            sourceColumnName: component.column_name,
            valueSql: buildRuntimeUnionComponentProjectionSql(component, enumOptionsMap, locale),
            column: {
                ...sourceColumn,
                id: `${objectCollection.id}:__runtimeUnion${field[0].toUpperCase()}${field.slice(1)}`,
                codename: field === 'updatedAt' ? 'UpdatedAt' : field[0].toUpperCase() + field.slice(1),
                field,
                headerName: resolveRuntimeUnionProjectionLabel(field, locale),
                uiConfig: {
                    ...(sourceColumn.uiConfig ?? {}),
                    ...(field === 'updatedAt' ? { gridFilterable: false } : {})
                }
            }
        })
    }

    const addConfiguredProjection = (field: string) => {
        const normalizedField = field.trim()
        const component = findRuntimeComponentByFieldKey(physicalComponents, normalizedField)
        if (!normalizedField || !component || component.data_type === 'JSON' || component.data_type === 'TABLE') return

        const sourceColumn = mapRuntimeComponentToColumnDefinition({ component, enumOptionsMap, locale })
        specs.push({
            field: normalizedField,
            sourceColumnName: component.column_name,
            valueSql: buildRuntimeUnionComponentProjectionSql(component, enumOptionsMap, locale),
            column: {
                ...sourceColumn,
                id: `${objectCollection.id}:__runtimeUnion${normalizedField}`,
                field: normalizedField
            }
        })
    }

    addComponentProjection('title', target.titleField)
    addComponentProjection('status', target.statusField)
    const projectComponent = findRuntimeComponentByFieldKey(physicalComponents, target.projectField)
    if (projectComponent) {
        const projectLabelSql = await buildRuntimeObjectRefLabelProjectionSql({
            manager: params.manager,
            schemaIdent: params.schemaIdent,
            sourceTableIdent: `${params.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`,
            currentWorkspaceId: params.currentWorkspaceId,
            component: projectComponent,
            locale
        })
        if (projectLabelSql) {
            specs.push({
                field: 'project',
                sourceColumnName: projectComponent.column_name,
                valueSql: projectLabelSql,
                column: {
                    id: `${objectCollection.id}:__runtimeUnionProject`,
                    codename: 'Project',
                    field: 'project',
                    dataType: 'STRING',
                    headerName: resolveRuntimeUnionProjectionLabel('project', locale),
                    isDisplayComponent: false,
                    isRequired: false,
                    validationRules: {},
                    uiConfig: {
                        gridSortable: false,
                        gridFilterable: false
                    },
                    refTargetEntityId: null,
                    refTargetEntityKind: null,
                    refTargetConstantId: null
                }
            })
        }
    }
    addComponentProjection('updatedAt', target.updatedAtField)
    for (const projectedField of params.projectedFields ?? []) {
        addConfiguredProjection(projectedField)
    }

    return specs
}

const buildRuntimeUnionRecentAtProjectionSpec = (
    objectCollectionId: string,
    locale: string,
    valueSql: string
): RuntimeUnionProjectionSpec => ({
    field: 'recentAt',
    sourceColumnName: null,
    valueSql,
    column: {
        id: `${objectCollectionId}:__runtimeUnionRecentAt`,
        codename: 'RecentAt',
        field: 'recentAt',
        dataType: 'DATE',
        headerName: resolveRuntimeUnionProjectionLabel('recentAt', locale),
        isDisplayComponent: false,
        isRequired: false,
        validationRules: {},
        uiConfig: {
            gridFilterable: false
        },
        refTargetEntityId: null,
        refTargetEntityKind: null,
        refTargetConstantId: null
    }
})

const buildRuntimeUnionSharedAtProjectionSpec = (
    objectCollectionId: string,
    locale: string,
    valueSql: string
): RuntimeUnionProjectionSpec => ({
    field: 'sharedAt',
    sourceColumnName: null,
    valueSql,
    column: {
        id: `${objectCollectionId}:__runtimeUnionSharedAt`,
        codename: 'SharedAt',
        field: 'sharedAt',
        dataType: 'DATE',
        headerName: resolveRuntimeUnionProjectionLabel('sharedAt', locale),
        isDisplayComponent: false,
        isRequired: false,
        validationRules: {},
        uiConfig: {
            gridFilterable: false
        },
        refTargetEntityId: null,
        refTargetEntityKind: null,
        refTargetConstantId: null
    }
})

const isRuntimeUnionProjectedSourceComponent = (
    component: RuntimeReadableComponent,
    projectionSpecs: RuntimeUnionProjectionSpec[]
): boolean => {
    const sourceKeys = new Set(
        projectionSpecs
            .map((spec) => spec.sourceColumnName)
            .filter((value): value is string => Boolean(value))
            .map((value) => normalizeRuntimeListFieldKey(value))
    )
    if (sourceKeys.size === 0) return false

    return (
        sourceKeys.has(normalizeRuntimeListFieldKey(component.column_name)) ||
        sourceKeys.has(normalizeRuntimeListFieldKey(resolveRuntimeCodenameText(component.codename)))
    )
}

const mergeRuntimeUnionColumns = (columnGroups: RuntimeColumnDefinition[][]): RuntimeColumnDefinition[] => {
    const columnsByField = new Map<string, RuntimeColumnDefinition>()

    const mergeOptions = (left: RuntimeRefOption[] | undefined, right: RuntimeRefOption[] | undefined): RuntimeRefOption[] | undefined => {
        const options = [...(left ?? []), ...(right ?? [])]
        if (options.length === 0) return undefined
        return Array.from(new Map(options.map((option) => [option.id, option])).values())
    }

    for (const columns of columnGroups) {
        for (const column of columns) {
            const existing = columnsByField.get(column.field)
            if (!existing) {
                columnsByField.set(column.field, column)
                continue
            }

            columnsByField.set(column.field, {
                ...existing,
                refOptions: mergeOptions(existing.refOptions, column.refOptions),
                enumOptions: mergeOptions(existing.enumOptions, column.enumOptions),
                childColumns: existing.childColumns ?? column.childColumns
            })
        }
    }

    return Array.from(columnsByField.values())
}

const resolveRecordsUnionTargetObject = (
    runtimeObjects: RuntimeObjectCollectionRow[],
    target: RecordsUnionDatasource['targets'][number]
): RuntimeObjectCollectionRow | null => {
    const targetId = target.sectionId ?? target.objectCollectionId ?? null
    if (targetId) {
        return runtimeObjects.find((objectRow) => objectRow.id === targetId) ?? null
    }

    const targetCodename = (target.sectionCodename ?? target.objectCollectionCodename ?? '').trim().toLowerCase()
    if (!targetCodename) return null
    return (
        runtimeObjects.find((objectRow) => resolveRuntimeCodenameText(objectRow.codename).trim().toLowerCase() === targetCodename) ?? null
    )
}

const remapRuntimeUnionSqlPlaceholders = (sql: string, offset: number): string =>
    sql.replace(/\$(\d+)/g, (_match, index: string) => `$${Number(index) + offset}`)

const normalizeRuntimeUnionProjectionField = (field: string): RuntimeUnionSystemProjectionField | null => {
    const normalized = normalizeRuntimeListFieldKey(field)
    if (normalized === 'type') return 'type'
    if (normalized === 'title') return 'title'
    if (normalized === 'status') return 'status'
    if (normalized === 'updatedat' || normalized === 'updated_at' || normalized === 'updated') return 'updatedAt'
    if (normalized === 'recentat' || normalized === 'recent_at' || normalized === 'viewed' || normalized === 'viewedat') return 'recentAt'
    if (normalized === 'sharedat' || normalized === 'shared_at' || normalized === 'shared') return 'sharedAt'
    return null
}

const resolveRuntimeUnionTargetQueryField = (target: RecordsUnionDatasource['targets'][number], field: string): string | null => {
    const projectionField = normalizeRuntimeUnionProjectionField(field)
    if (projectionField === 'title' && target.titleField) return target.titleField
    if (projectionField === 'status' && target.statusField) return target.statusField
    if (projectionField === 'updatedAt' && target.updatedAtField) return target.updatedAtField
    if (projectionField) return null
    return field
}

const translateRuntimeUnionTargetSort = (
    target: RecordsUnionDatasource['targets'][number],
    sort: RuntimeDatasourceSort[] | undefined
): RuntimeDatasourceSort[] | undefined =>
    sort?.flatMap((item) => {
        const field = resolveRuntimeUnionTargetQueryField(target, item.field)
        return field ? [{ ...item, field }] : []
    })

const translateRuntimeUnionTargetFilters = (
    target: RecordsUnionDatasource['targets'][number],
    filters: RuntimeDatasourceFilter[] | undefined
): RuntimeDatasourceFilter[] | undefined =>
    filters?.map((item) => ({
        ...item,
        field: resolveRuntimeUnionTargetQueryField(target, item.field) ?? item.field
    }))

const resolveRuntimeUnionOutputSortField = (sortField: string, targets: RecordsUnionDatasource['targets']): string => {
    const projectionField = normalizeRuntimeUnionProjectionField(sortField)
    if (projectionField) return projectionField

    const normalized = normalizeRuntimeListFieldKey(sortField)
    if (targets.some((target) => target.titleField && normalizeRuntimeListFieldKey(target.titleField) === normalized)) return 'title'
    if (targets.some((target) => target.statusField && normalizeRuntimeListFieldKey(target.statusField) === normalized)) return 'status'
    if (targets.some((target) => target.updatedAtField && normalizeRuntimeListFieldKey(target.updatedAtField) === normalized))
        return 'updatedAt'

    return sortField
}

const buildRuntimeUnionOrderBySql = (sort: RuntimeDatasourceSort[] | undefined, targets: RecordsUnionDatasource['targets']): string => {
    if (!sort?.length) return 'target_order ASC, row_order ASC'

    return [
        ...sort.map((sortItem) => {
            const direction = sortItem.direction === 'desc' ? 'DESC' : 'ASC'
            return `row_data ->> ${quoteSqlLiteral(resolveRuntimeUnionOutputSortField(sortItem.field, targets))} ${direction} NULLS LAST`
        }),
        `row_data ->> 'id' ASC`
    ].join(', ')
}

export const executeRuntimeRecordsUnionDatasource = async (params: {
    runtimeContext: Exclude<Awaited<ReturnType<typeof resolveRuntimeSchema>>, null>
    datasource: RecordsUnionDatasource
    limit: number
    offset: number
    locale: string
}) => {
    const { runtimeContext, datasource, limit, offset, locale } = params
    const { manager, schemaName, schemaIdent, currentWorkspaceId } = runtimeContext
    const runtimeObjects = await loadRuntimeObjectCollections(manager, schemaIdent)
    const queryConfig = datasource.query ?? {}
    const lifecycleState = queryConfig.lifecycleState ?? 'active'
    const libraryView = queryConfig.libraryView ?? 'all'
    const { search, sort, filters } = queryConfig
    const shouldProjectRecentAt =
        libraryView === 'recent' || Boolean(sort?.some((item) => normalizeRuntimeUnionProjectionField(item.field) === 'recentAt'))
    const shouldProjectSharedAt =
        libraryView === 'shared' || Boolean(sort?.some((item) => normalizeRuntimeUnionProjectionField(item.field) === 'sharedAt'))

    const targetPayloads: Array<{
        objectCollection: RuntimeObjectCollectionRow
        columns: RuntimeColumnDefinition[]
    }> = []
    const unionSelects: string[] = []
    const unionValues: unknown[] = []

    for (const [targetIndex, target] of datasource.targets.entries()) {
        const objectCollection = resolveRecordsUnionTargetObject(runtimeObjects, target)
        if (!objectCollection) {
            throw new UpdateFailure(404, {
                error: 'Records union datasource target was not found',
                target
            })
        }

        const objectKind = resolveRuntimeStandardKind(objectCollection.kind)
        if (objectKind === 'page' || !IDENTIFIER_REGEX.test(objectCollection.table_name ?? '')) {
            throw new UpdateFailure(400, {
                error: 'Records union datasource targets must be runtime object collections',
                target
            })
        }
        if (readRuntimeAccessEntryConfig(objectCollection.config)) {
            throw new UpdateFailure(403, {
                error: 'Records union datasource target is restricted',
                target: resolveRuntimeCodenameText(objectCollection.codename)
            })
        }

        const components = (await loadRuntimeReadableComponents(manager, schemaIdent, objectCollection.id)).filter((cmp) =>
            IDENTIFIER_REGEX.test(cmp.column_name)
        )
        const physicalComponents = components.filter((cmp) => cmp.data_type !== 'TABLE')
        const targetSort = translateRuntimeUnionTargetSort(target, sort)
        const targetFilters = translateRuntimeUnionTargetFilters(target, filters)
        const unsupportedListFields = findUnsupportedRuntimeListFields(physicalComponents, targetSort, targetFilters)
        if (unsupportedListFields.length > 0) {
            throw new UpdateFailure(400, {
                error: 'Runtime list query references unknown or unsupported fields',
                fields: unsupportedListFields,
                target: resolveRuntimeCodenameText(objectCollection.codename)
            })
        }
        const enumOptionsMap = await loadRuntimeEnumOptionsMap({ manager, schemaIdent, components, locale })
        const projectionSpecs = await buildRuntimeUnionProjectionSpecs({
            manager,
            schemaIdent,
            currentWorkspaceId,
            target,
            projectedFields: datasource.projectedFields,
            objectCollection,
            physicalComponents,
            enumOptionsMap,
            locale
        })

        const { runtimeConfig } = await resolveEffectiveObjectCollectionRuntimeConfig({
            manager,
            schemaName,
            schemaIdent,
            objectCollectionId: objectCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(
            components,
            runtimeConfig.enableRowReordering ? runtimeConfig.reorderPersistenceField : null
        )
        const dataTableIdent = `${schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const activeObjectRowCondition =
            lifecycleState === 'deleted'
                ? buildRuntimeDeletedRowCondition(
                      objectCollection.lifecycleContract,
                      objectCollection.config,
                      undefined,
                      currentWorkspaceId
                  )
                : buildRuntimeActiveRowCondition(objectCollection.lifecycleContract, objectCollection.config, undefined, currentWorkspaceId)
        const runtimeListClauses = buildRuntimeListClauses({
            activeCondition: activeObjectRowCondition,
            attrs: physicalComponents,
            search,
            sort: targetSort,
            filters: targetFilters,
            fallbackOrderBy: buildRuntimeRowsOrderBy(reorderFieldAttr?.column_name ?? null),
            currentUserId: runtimeContext.userId
        })
        const objectCodename = resolveRuntimeCodenameText(objectCollection.codename)
        const recordAccessClause = await buildRuntimeRecordAccessClause({
            manager,
            schemaIdent,
            currentWorkspaceId,
            currentUserId: runtimeContext.userId,
            permissions: runtimeContext.permissions,
            objectCodename,
            attrs: components,
            config: objectCollection.config,
            outerRowIdSql: `${dataTableIdent}.id`,
            values: runtimeListClauses.values
        })
        const libraryViewClause = await buildRuntimeLibraryViewClause({
            manager,
            schemaIdent,
            currentWorkspaceId,
            currentUserId: runtimeContext.userId,
            objectCodename,
            config: objectCollection.config,
            libraryView,
            outerRowIdSql: `${dataTableIdent}.id`,
            values: runtimeListClauses.values
        })
        let runtimeStarredExistsClause: string | null = null
        let runtimeSharedExistsClause: string | null = null
        let runtimeRecentAtValueSql: string | null = null
        let runtimeSharedAtValueSql: string | null = null
        const runtimeLibraryConfig = readRuntimeLibraryConfig(objectCollection.config)
        const starredRelation = runtimeLibraryConfig?.starred
        if (starredRelation && runtimeContext.userId) {
            const starredBinding = await resolveRuntimeRelationBinding({
                manager,
                schemaIdent,
                currentWorkspaceId,
                relation: starredRelation
            })
            if (starredBinding?.actorColumnName) {
                runtimeStarredExistsClause = buildRuntimeRelationExistsClause({
                    binding: starredBinding,
                    currentObjectCodename: objectCodename,
                    currentUserId: runtimeContext.userId,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: runtimeListClauses.values,
                    kind: 'starred'
                })
            }
        }
        const sharedRelation = runtimeLibraryConfig?.shared
        let sharedBinding: RuntimeRelationBinding | null = null
        if (sharedRelation && runtimeContext.userId) {
            sharedBinding = await resolveRuntimeRelationBinding({
                manager,
                schemaIdent,
                currentWorkspaceId,
                relation: sharedRelation
            })
            if (sharedBinding?.principalTypeColumnName && sharedBinding.principalIdColumnName) {
                runtimeSharedExistsClause = buildRuntimeRelationExistsClause({
                    binding: sharedBinding,
                    currentObjectCodename: objectCodename,
                    currentUserId: runtimeContext.userId,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: runtimeListClauses.values,
                    kind: 'shared'
                })
            }
            if (shouldProjectSharedAt && sharedBinding?.timestampColumnName) {
                runtimeSharedAtValueSql = buildRuntimeSharedRelationTimestampValueSql({
                    binding: sharedBinding,
                    currentObjectCodename: objectCodename,
                    currentUserId: runtimeContext.userId,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: runtimeListClauses.values
                })
            }
        }
        const recentRelation = runtimeLibraryConfig?.recent
        if (shouldProjectRecentAt && recentRelation && runtimeContext.userId) {
            const recentBinding = await resolveRuntimeRelationBinding({
                manager,
                schemaIdent,
                currentWorkspaceId,
                relation: recentRelation
            })
            if (recentBinding?.actorColumnName && recentBinding.timestampColumnName) {
                runtimeRecentAtValueSql = buildRuntimeRelationTimestampValueSql({
                    binding: recentBinding,
                    currentObjectCodename: objectCodename,
                    currentUserId: runtimeContext.userId,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: runtimeListClauses.values
                })
            }
        }
        const effectiveProjectionSpecs = [
            ...projectionSpecs,
            ...(runtimeRecentAtValueSql
                ? [buildRuntimeUnionRecentAtProjectionSpec(objectCollection.id, locale, runtimeRecentAtValueSql)]
                : []),
            ...(runtimeSharedAtValueSql
                ? [buildRuntimeUnionSharedAtProjectionSpec(objectCollection.id, locale, runtimeSharedAtValueSql)]
                : [])
        ]
        const valueOffset = unionValues.length
        unionValues.push(...runtimeListClauses.values)
        const runtimeListWhereSql = [runtimeListClauses.whereSql, recordAccessClause, libraryViewClause]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .map((clause) => remapRuntimeUnionSqlPlaceholders(clause, valueOffset))
            .join(' AND ')
        const recordBehavior = normalizeRuntimeRecordBehavior(objectCollection.config)
        const recordBehaviorEnabled = isRuntimeRecordBehaviorEnabled(recordBehavior)
        const includeRuntimeRowVersion = true
        const jsonPairs = [
            `${quoteSqlLiteral('id')}, ${quoteSqlLiteral(`${objectCollection.id}:`)} || id::text`,
            `${quoteSqlLiteral('__runtimeObjectCollectionId')}, ${quoteSqlLiteral(objectCollection.id)}`,
            `${quoteSqlLiteral('__runtimeObjectCollectionCodename')}, ${quoteSqlLiteral(objectCodename)}`,
            `${quoteSqlLiteral('__runtimeSourceRowId')}, id::text`,
            `${quoteSqlLiteral('__runtimeStarred')}, ${
                runtimeStarredExistsClause
                    ? `to_jsonb(${remapRuntimeUnionSqlPlaceholders(runtimeStarredExistsClause, valueOffset)})`
                    : 'to_jsonb(false)'
            }`,
            `${quoteSqlLiteral('__runtimeShared')}, ${
                runtimeSharedExistsClause
                    ? `to_jsonb(${remapRuntimeUnionSqlPlaceholders(runtimeSharedExistsClause, valueOffset)})`
                    : 'to_jsonb(false)'
            }`,
            `${quoteSqlLiteral('__runtimeDisplayType')}, ${quoteSqlLiteral(
                target.displayType ?? resolvePresentationName(objectCollection.presentation, locale, objectCodename)
            )}`
        ]
        for (const spec of effectiveProjectionSpecs) {
            jsonPairs.push(
                `${quoteSqlLiteral(spec.field)}, ${
                    spec.valueSql.includes('$') ? remapRuntimeUnionSqlPlaceholders(spec.valueSql, valueOffset) : spec.valueSql
                }`
            )
        }

        if (recordBehaviorEnabled) {
            for (const field of RUNTIME_RECORD_SYSTEM_FIELDS) {
                jsonPairs.push(`${quoteSqlLiteral(field)}, ${quoteIdentifier(field)}`)
            }
        }
        if (includeRuntimeRowVersion) {
            jsonPairs.push(`${quoteSqlLiteral('_upl_version')}, ${quoteIdentifier('_upl_version')}`)
        }

        for (const component of physicalComponents) {
            jsonPairs.push(`${quoteSqlLiteral(component.column_name)}, ${buildRuntimeComponentJsonValueSql(component, locale)}`)
        }

        for (const tableComponent of components.filter((cmp) => cmp.data_type === 'TABLE')) {
            const fallbackTabTableName = generateChildTableName(tableComponent.id)
            const tabTableName =
                typeof tableComponent.column_name === 'string' && IDENTIFIER_REGEX.test(tableComponent.column_name)
                    ? tableComponent.column_name
                    : fallbackTabTableName
            if (!IDENTIFIER_REGEX.test(tabTableName)) continue
            const tabTableIdent = `${schemaIdent}.${quoteIdentifier(tabTableName)}`
            jsonPairs.push(
                `${quoteSqlLiteral(
                    tableComponent.column_name
                )}, (SELECT COUNT(*)::int FROM ${tabTableIdent} WHERE _tp_parent_id = ${dataTableIdent}.id AND ${activeObjectRowCondition})`
            )
        }

        unionSelects.push(`
      SELECT
        jsonb_build_object(${jsonPairs.join(', ')}) AS row_data,
        ${targetIndex} AS target_order,
        row_number() OVER (ORDER BY ${runtimeListClauses.orderBySql}) AS row_order
      FROM ${dataTableIdent}
      WHERE ${runtimeListWhereSql}
    `)

        const columns = [
            ...effectiveProjectionSpecs.map((spec) => spec.column),
            ...components
                .filter((component) => !isRuntimeUnionProjectedSourceComponent(component, effectiveProjectionSpecs))
                .map((component) => mapRuntimeComponentToColumnDefinition({ component, enumOptionsMap, locale }))
        ]

        targetPayloads.push({
            objectCollection,
            columns
        })
    }

    const firstTarget = targetPayloads[0]
    if (!firstTarget || unionSelects.length === 0) {
        throw new UpdateFailure(400, { error: 'Records union datasource requires at least one target' })
    }

    const unionSql = unionSelects.join('\nUNION ALL\n')
    const totalRows = (await manager.query(
        `
      SELECT COUNT(*)::int AS total
      FROM (${unionSql}) union_rows
    `,
        unionValues
    )) as Array<{ total: number }>
    const total = typeof totalRows[0]?.total === 'number' ? totalRows[0].total : Number(totalRows[0]?.total) || 0
    const pageRows = (await manager.query(
        `
      SELECT row_data AS row
      FROM (${unionSql}) union_rows
      ORDER BY ${buildRuntimeUnionOrderBySql(sort, datasource.targets)}
      LIMIT $${unionValues.length + 1} OFFSET $${unionValues.length + 2}
    `,
        [...unionValues, limit, offset]
    )) as Array<{ row: Record<string, unknown> | string }>
    const rows = pageRows.map((item) => {
        if (typeof item.row === 'string') {
            return JSON.parse(item.row) as Record<string, unknown> & { id: string }
        }
        return item.row as Record<string, unknown> & { id: string }
    })
    const objectCollections = targetPayloads.map(({ objectCollection }) => ({
        id: objectCollection.id,
        kind: resolveRuntimeStandardKind(objectCollection.kind) ?? 'object',
        codename: resolveRuntimeCodenameText(objectCollection.codename),
        tableName: objectCollection.table_name,
        runtimeConfig: normalizeObjectCollectionRuntimeViewConfig(undefined),
        recordBehavior: normalizeRuntimeRecordBehavior(objectCollection.config),
        workflowActions: readConfiguredWorkflowActions(objectCollection.config),
        name: resolvePresentationName(objectCollection.presentation, locale, resolveRuntimeCodenameText(objectCollection.codename))
    }))
    const activeObjectCollection = objectCollections[0]

    return {
        section: activeObjectCollection,
        sections: objectCollections,
        activeSectionId: activeObjectCollection.id,
        objectCollection: activeObjectCollection,
        objectCollections,
        activeObjectCollectionId: activeObjectCollection.id,
        columns: mergeRuntimeUnionColumns(targetPayloads.map((payload) => payload.columns)),
        rows,
        pagination: {
            total,
            limit,
            offset
        },
        settings: runtimeContext.applicationSettings,
        workspacesEnabled: runtimeContext.workspacesEnabled,
        currentWorkspaceId: runtimeContext.currentWorkspaceId,
        permissions: runtimeContext.permissions,
        workflowCapabilities: runtimeContext.workflowCapabilities,
        layoutConfig: {},
        zoneWidgets: {
            left: [],
            right: [],
            center: []
        },
        menus: [],
        activeMenuId: null
    }
}

const loadRuntimeRowById = async (manager: DbExecutor, dataTableIdent: string, rowId: string, runtimeRowCondition = 'TRUE') => {
    const rows = (await manager.query(
        `
      SELECT *
      FROM ${dataTableIdent}
      WHERE id = $1
        AND ${runtimeRowCondition}
      LIMIT 1
    `,
        [rowId]
    )) as Array<Record<string, unknown>>

    return rows[0] ?? null
}

const collectTouchedComponentIds = (
    attrs: Array<{ id: string; codename: unknown; column_name: string }>,
    payload: Record<string, unknown>
) => {
    const touched = new Set<string>()

    for (const cmp of attrs) {
        const { hasUserValue } = getRuntimeInputValue(payload, cmp.column_name, cmp.codename)
        if (hasUserValue) {
            touched.add(cmp.id)
        }
    }

    return [...touched]
}

const dispatchRuntimeLifecycle = async (params: {
    manager: DbExecutor
    applicationId: string
    schemaName: string
    objectCollection: { id: string; codename: unknown }
    currentWorkspaceId?: string | null
    currentUserId?: string | null
    permissions?: Record<RolePermission, boolean>
    componentIds?: string[]
    payload: {
        eventName:
            | 'beforeCreate'
            | 'afterCreate'
            | 'beforeUpdate'
            | 'afterUpdate'
            | 'beforeDelete'
            | 'afterDelete'
            | 'beforeCopy'
            | 'afterCopy'
            | 'beforePost'
            | 'afterPost'
            | 'beforeUnpost'
            | 'afterUnpost'
            | 'beforeVoid'
            | 'afterVoid'
        row?: Record<string, unknown> | null
        previousRow?: Record<string, unknown> | null
        patch?: Record<string, unknown> | null
        metadata?: Record<string, unknown>
    }
}): Promise<unknown[]> => {
    const modulesService = new RuntimeModulesService()

    return modulesService.dispatchLifecycleEvent({
        executor: params.manager,
        applicationId: params.applicationId,
        schemaName: params.schemaName,
        attachmentKind: 'object',
        attachmentId: params.objectCollection.id,
        entityCodename: resolveRuntimeCodenameText(params.objectCollection.codename),
        currentWorkspaceId: params.currentWorkspaceId ?? null,
        currentUserId: params.currentUserId ?? null,
        permissions: params.permissions ?? null,
        componentIds: params.componentIds,
        payload: params.payload
    })
}

type RuntimeLifecycleDispatchRequest = Omit<Parameters<typeof dispatchRuntimeLifecycle>[0], 'manager'>
type RuntimePostingMovementWriteResult = {
    postingMovements: Array<{ ledgerCodename: string; facts: Array<{ id: string; idempotent?: boolean }> }>
    postingReversals: Array<{ ledgerCodename: string; facts: Array<{ id: string }> }>
}

const dispatchRuntimeLifecycleAfterCommit = (manager: DbExecutor, request: RuntimeLifecycleDispatchRequest | null) => {
    if (!request) return

    void dispatchRuntimeLifecycle({
        manager,
        ...request
    }).catch((error) => {
        console.error(`[runtimeRowsController] ${request.payload.eventName} lifecycle hook failed`, error)
    })
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------

export function createRuntimeRowsController(getDbExecutor: () => DbExecutor) {
    const query = createQueryHelper(getDbExecutor)
    const recordCommandService = new RuntimeRecordCommandService()
    const postingMovementService = new RuntimePostingMovementService()

    const resolveRecordCommandEventPrefix = (command: 'post' | 'unpost' | 'void'): 'Post' | 'Unpost' | 'Void' => {
        if (command === 'post') return 'Post'
        if (command === 'unpost') return 'Unpost'
        return 'Void'
    }

    const runPostingMovementWrites = async (params: {
        command: 'post' | 'unpost' | 'void'
        executor: DbExecutor
        schemaName: string
        registrarKind: string
        behavior: ReturnType<typeof normalizeRuntimeRecordBehavior>
        currentWorkspaceId: string | null
        currentUserId: string
        beforeLifecycleResults: unknown[]
        storedMovements: unknown
    }): Promise<RuntimePostingMovementWriteResult> => {
        if (params.command === 'post') {
            return {
                postingMovements: await postingMovementService.appendMovements({
                    executor: params.executor,
                    schemaName: params.schemaName,
                    registrarKind: params.registrarKind,
                    behavior: params.behavior,
                    currentWorkspaceId: params.currentWorkspaceId,
                    currentUserId: params.currentUserId,
                    results: params.beforeLifecycleResults
                }),
                postingReversals: []
            }
        }

        return {
            postingMovements: [],
            postingReversals: await postingMovementService.reversePostedMovements({
                executor: params.executor,
                schemaName: params.schemaName,
                registrarKind: params.registrarKind,
                currentWorkspaceId: params.currentWorkspaceId,
                currentUserId: params.currentUserId,
                storedMovements: params.storedMovements
            })
        }
    }

    const buildRecordCommandResponse = (
        command: 'post' | 'unpost' | 'void',
        row: Record<string, unknown>,
        movementResult: RuntimePostingMovementWriteResult
    ): Record<string, unknown> => ({
        id: String(row.id),
        status: command === 'post' ? 'posted' : command === 'unpost' ? 'unposted' : 'voided',
        recordState: row._app_record_state ?? null,
        recordNumber: row._app_record_number ?? null,
        postedAt: row._app_posted_at ?? null,
        postingBatchId: row._app_posting_batch_id ?? null,
        postingMovements: movementResult.postingMovements,
        postingReversals: movementResult.postingReversals
    })

    const listRecordsUnionDatasource = async (req: Request, res: Response) => {
        const { applicationId } = req.params
        const parsedBody = runtimeRecordsUnionBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { datasource, limit, offset, locale } = parsedBody.data
        const requestedLocale = normalizeLocale(locale)
        const runtimeContext = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!runtimeContext) return

        try {
            const payload = await executeRuntimeRecordsUnionDatasource({
                runtimeContext,
                datasource,
                limit,
                offset,
                locale: requestedLocale
            })
            return res.json(payload)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }
    }

    // ============ GET RUNTIME TABLE ============
    const getRuntime = async (req: Request, res: Response) => {
        const { applicationId } = req.params

        const parsedQuery = runtimeQuerySchema.safeParse(req.query)
        if (!parsedQuery.success) {
            return res.status(400).json({ error: 'Invalid query', details: parsedQuery.error.flatten() })
        }

        const { limit, offset, locale, lifecycleState, libraryView, search, sort, filters } = parsedQuery.data
        const requestedLocale = normalizeLocale(locale)
        const requestedObjectCollectionId = parsedQuery.data.objectCollectionId ?? null
        const requestedObjectCollectionCodename = parsedQuery.data.objectCollectionCodename?.trim() || null
        const runtimeContext = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!runtimeContext) return

        const { schemaName, schemaIdent } = runtimeContext
        const manager = runtimeContext.manager
        const currentWorkspaceId = runtimeContext.currentWorkspaceId

        const objectCollections = await manager.query(
            `
        SELECT id, kind, codename, table_name, presentation, config
        FROM ${schemaIdent}._app_objects
        WHERE (${RUNTIME_OBJECT_FILTER_SQL} OR ${runtimeStandardKindSql('kind')} = 'page')
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY ${runtimeCodenameTextSql('codename')} ASC, id ASC
      `
        )

        if (objectCollections.length === 0) {
            return res.status(404).json({ error: 'No objectCollections available in application runtime schema' })
        }

        const typedObjects = objectCollections as Array<{
            id: string
            kind: string
            codename: unknown
            table_name: string | null
            presentation?: unknown
            config?: Record<string, unknown> | null
        }>

        const runtimeObjects = typedObjects.map((objectRow) => ({
            ...objectRow,
            lifecycleContract: resolveApplicationLifecycleContractFromConfig(objectRow.config)
        }))

        const preferredObjectCollectionIdFromMenu =
            requestedObjectCollectionId || requestedObjectCollectionCodename
                ? null
                : await resolvePreferredScopeEntityIdFromGlobalMenu({
                      manager,
                      schemaName,
                      schemaIdent
                  })

        const activeObjectCollection =
            (requestedObjectCollectionId ? runtimeObjects.find((objectRow) => objectRow.id === requestedObjectCollectionId) : undefined) ??
            (requestedObjectCollectionCodename
                ? runtimeObjects.find(
                      (objectRow) =>
                          resolveRuntimeCodenameText(objectRow.codename).trim().toLowerCase() ===
                          requestedObjectCollectionCodename.toLowerCase()
                  )
                : undefined) ??
            (preferredObjectCollectionIdFromMenu
                ? runtimeObjects.find((objectRow) => objectRow.id === preferredObjectCollectionIdFromMenu)
                : undefined) ??
            runtimeObjects[0]
        if (!activeObjectCollection) {
            return res.status(404).json({
                error: 'Requested object not found in runtime schema',
                details: { objectCollectionId: requestedObjectCollectionId, objectCollectionCodename: requestedObjectCollectionCodename }
            })
        }

        const activeObjectCollectionKind = resolveRuntimeStandardKind(activeObjectCollection.kind)
        const isActivePage = activeObjectCollectionKind === 'page'
        if (!isActivePage && !IDENTIFIER_REGEX.test(activeObjectCollection.table_name ?? '')) {
            return res.status(400).json({ error: 'Invalid runtime table name' })
        }
        const activeRecordBehavior = normalizeRuntimeRecordBehavior(activeObjectCollection.config)
        const activeRecordBehaviorEnabled = !isActivePage && isRuntimeRecordBehaviorEnabled(activeRecordBehavior)
        const activeWorkflowActions = isActivePage ? [] : readConfiguredWorkflowActions(activeObjectCollection.config)
        const includeRuntimeRowVersion = activeWorkflowActions.length > 0

        const components = isActivePage
            ? []
            : ((await manager.query(
                  `
        SELECT id, codename, column_name, data_type, is_required, is_display_component,
               presentation, validation_rules, sort_order, ui_config,
               target_object_id, target_object_kind
        FROM ${schemaIdent}._app_components
        WHERE object_id = $1
          AND data_type IN ('BOOLEAN', 'STRING', 'NUMBER', 'DATE', 'REF', 'JSON', 'TABLE')
          AND parent_component_id IS NULL
          AND _upl_deleted = false
          AND _app_deleted = false
        ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
      `,
                  [activeObjectCollection.id]
              )) as Array<{
                  id: string
                  codename: string
                  column_name: string
                  data_type: RuntimeDataType
                  is_required: boolean
                  is_display_component?: boolean
                  presentation?: unknown
                  validation_rules?: Record<string, unknown>
                  sort_order?: number
                  ui_config?: Record<string, unknown>
                  target_object_id?: string | null
                  target_object_kind?: string | null
              }>)

        const safeComponents = components.filter((cmp) => IDENTIFIER_REGEX.test(cmp.column_name))

        // Separate physical (non-TABLE) components from virtual TABLE components
        const physicalComponents = safeComponents.filter((a) => a.data_type !== 'TABLE')

        // Fetch child components for TABLE-type components
        const tableAttrs = safeComponents.filter((a) => a.data_type === 'TABLE')
        const childAttrsByTableId = new Map<string, typeof components>()
        if (tableAttrs.length > 0) {
            const tableAttrIds = tableAttrs.map((a) => a.id)
            const childAttrs = (await manager.query(
                `
          SELECT id, codename, column_name, data_type, is_required, is_display_component,
                 presentation, validation_rules, sort_order, ui_config,
                 target_object_id, target_object_kind, parent_component_id
          FROM ${schemaIdent}._app_components
          WHERE parent_component_id = ANY($1::uuid[])
            AND _upl_deleted = false
            AND _app_deleted = false
          ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST, codename ASC
        `,
                [tableAttrIds]
            )) as Array<(typeof components)[number] & { parent_component_id: string }>

            for (const child of childAttrs) {
                const list = childAttrsByTableId.get(child.parent_component_id) ?? []
                list.push(child)
                childAttrsByTableId.set(child.parent_component_id, list)
            }
        }

        // Collect all child components (across all TABLE components) for REF target resolution
        const allChildComponents = Array.from(childAttrsByTableId.values()).flat()

        const enumTargetObjectIds = Array.from(
            new Set([
                ...safeComponents
                    .filter((cmp) => cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind) && cmp.target_object_id)
                    .map((cmp) => String(cmp.target_object_id)),
                ...allChildComponents
                    .filter((cmp) => cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind) && cmp.target_object_id)
                    .map((cmp) => String(cmp.target_object_id))
            ])
        )

        const enumOptionsMap = new Map<
            string,
            Array<{
                id: string
                label: string
                codename: string
                isDefault: boolean
                sortOrder: number
            }>
        >()
        if (enumTargetObjectIds.length > 0) {
            const enumRows = (await manager.query(
                `
          SELECT id, object_id, codename, presentation, sort_order, is_default
          FROM ${schemaIdent}._app_values
          WHERE object_id = ANY($1::uuid[])
            AND _upl_deleted = false
            AND _app_deleted = false
          ORDER BY object_id ASC, sort_order ASC, codename ASC
        `,
                [enumTargetObjectIds]
            )) as Array<{
                id: string
                object_id: string
                codename: string
                presentation?: unknown
                sort_order?: number
                is_default?: boolean
            }>

            for (const row of enumRows) {
                const list = enumOptionsMap.get(row.object_id) ?? []
                list.push({
                    id: row.id,
                    codename: row.codename,
                    label: resolvePresentationName(row.presentation, requestedLocale, resolveRuntimeCodenameText(row.codename)),
                    isDefault: row.is_default === true,
                    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0
                })
                enumOptionsMap.set(row.object_id, list)
            }
        }

        const objectTargetObjectIds = Array.from(
            new Set([
                ...safeComponents
                    .filter((cmp) => cmp.data_type === 'REF' && isRuntimeObjectTargetKind(cmp.target_object_kind) && cmp.target_object_id)
                    .map((cmp) => String(cmp.target_object_id)),
                ...allChildComponents
                    .filter((cmp) => cmp.data_type === 'REF' && isRuntimeObjectTargetKind(cmp.target_object_kind) && cmp.target_object_id)
                    .map((cmp) => String(cmp.target_object_id))
            ])
        )

        const objectRefOptionsMap = new Map<string, RuntimeRefOption[]>()
        if (objectTargetObjectIds.length > 0) {
            const targetObjects = (await manager.query(
                `
          SELECT id, kind, codename, table_name, config
          FROM ${schemaIdent}._app_objects
          WHERE id = ANY($1::uuid[])
            AND ${RUNTIME_OBJECT_FILTER_SQL}
            AND _upl_deleted = false
            AND _app_deleted = false
        `,
                [objectTargetObjectIds]
            )) as Array<{
                id: string
                codename: unknown
                table_name: string
                config?: Record<string, unknown> | null
            }>

            const targetObjectAttrs = (await manager.query(
                `
          SELECT id, object_id, column_name, codename, data_type, is_required, validation_rules, target_object_id, target_object_kind, ui_config, is_display_component, sort_order
          FROM ${schemaIdent}._app_components
          WHERE object_id = ANY($1::uuid[])
            AND parent_component_id IS NULL
            AND _upl_deleted = false
            AND _app_deleted = false
          ORDER BY object_id ASC, is_display_component DESC, sort_order ASC, codename ASC
        `,
                [objectTargetObjectIds]
            )) as Array<{
                id: string
                object_id: string
                column_name: string
                codename: unknown
                data_type: RuntimeDataType
                is_required: boolean
                validation_rules?: Record<string, unknown>
                target_object_id?: string | null
                target_object_kind?: string | null
                ui_config?: Record<string, unknown>
                is_display_component: boolean
                sort_order?: number
            }>

            const attrsByObjectCollectionId = new Map<string, typeof targetObjectAttrs>()
            for (const row of targetObjectAttrs) {
                const list = attrsByObjectCollectionId.get(row.object_id) ?? []
                list.push(row)
                attrsByObjectCollectionId.set(row.object_id, list)
            }

            for (const targetObject of targetObjects) {
                if (!IDENTIFIER_REGEX.test(targetObject.table_name)) {
                    continue
                }

                const targetObjectActiveRowCondition = buildRuntimeActiveRowCondition(
                    resolveApplicationLifecycleContractFromConfig(targetObject.config),
                    targetObject.config,
                    undefined,
                    currentWorkspaceId
                )

                const targetAttrs = attrsByObjectCollectionId.get(targetObject.id) ?? []
                const preferredDisplayAttr =
                    targetAttrs.find((cmp) => cmp.is_display_component) ??
                    targetAttrs.find((cmp) => cmp.data_type === 'STRING') ??
                    targetAttrs[0]

                const selectLabelSql =
                    preferredDisplayAttr && IDENTIFIER_REGEX.test(preferredDisplayAttr.column_name)
                        ? `${quoteIdentifier(preferredDisplayAttr.column_name)} AS label_value`
                        : 'NULL AS label_value'

                const targetTableIdent = `${schemaIdent}.${quoteIdentifier(targetObject.table_name)}`
                const targetAccessValues: unknown[] = []
                const targetAccessClause = await buildRuntimeRecordAccessClause({
                    manager,
                    schemaIdent,
                    currentWorkspaceId,
                    currentUserId: runtimeContext.userId,
                    permissions: runtimeContext.permissions,
                    objectCodename: resolveRuntimeCodenameText(targetObject.codename),
                    attrs: targetAttrs,
                    config: targetObject.config,
                    outerRowIdSql: `${targetTableIdent}.id`,
                    values: targetAccessValues
                })
                const targetWhereSql = [targetObjectActiveRowCondition, targetAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')

                const targetRows = (await manager.query(
                    `
            SELECT id, ${selectLabelSql}
            FROM ${targetTableIdent}
            WHERE ${targetWhereSql}
            ORDER BY _upl_created_at ASC NULLS LAST, id ASC
            LIMIT 1000
          `,
                    targetAccessValues
                )) as Array<{
                    id: string
                    label_value?: unknown
                }>

                const options: RuntimeRefOption[] = targetRows.map((row, index) => {
                    const rawLabel = row.label_value
                    const localizedLabel =
                        preferredDisplayAttr?.data_type === 'STRING' ? resolveRuntimeValue(rawLabel, 'STRING', requestedLocale) : rawLabel
                    const label = typeof localizedLabel === 'string' && localizedLabel.trim().length > 0 ? localizedLabel : String(row.id)

                    return {
                        id: row.id,
                        label,
                        codename: resolveRuntimeCodenameText(targetObject.codename),
                        isDefault: false,
                        sortOrder: index
                    }
                })

                objectRefOptionsMap.set(targetObject.id, options)
            }
        }

        const { selectedLayout, runtimeConfig: activeObjectCollectionRuntimeConfig } = await resolveEffectiveObjectCollectionRuntimeConfig({
            manager,
            schemaName,
            schemaIdent,
            objectCollectionId: activeObjectCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(
            safeComponents,
            activeObjectCollectionRuntimeConfig.enableRowReordering ? activeObjectCollectionRuntimeConfig.reorderPersistenceField : null
        )

        let total = 0
        let rows: Array<Record<string, unknown> & { id: string }> = []
        let canPersistRowReordering = false

        if (!isActivePage) {
            const tableName = activeObjectCollection.table_name as string
            const dataTableIdent = `${schemaIdent}.${quoteIdentifier(tableName)}`
            const activeObjectRowCondition =
                lifecycleState === 'deleted'
                    ? buildRuntimeDeletedRowCondition(
                          activeObjectCollection.lifecycleContract,
                          activeObjectCollection.config,
                          undefined,
                          currentWorkspaceId
                      )
                    : buildRuntimeActiveRowCondition(
                          activeObjectCollection.lifecycleContract,
                          activeObjectCollection.config,
                          undefined,
                          currentWorkspaceId
                      )
            const unsupportedListFields = findUnsupportedRuntimeListFields(physicalComponents, sort, filters)
            if (unsupportedListFields.length > 0) {
                return res.status(400).json({
                    error: 'Runtime list query references unknown or unsupported fields',
                    fields: unsupportedListFields
                })
            }
            const runtimeListClauses = buildRuntimeListClauses({
                activeCondition: activeObjectRowCondition,
                attrs: physicalComponents,
                search,
                sort,
                filters,
                fallbackOrderBy: buildRuntimeRowsOrderBy(reorderFieldAttr?.column_name ?? null),
                currentUserId: runtimeContext.userId
            })
            const objectCodename = resolveRuntimeCodenameText(activeObjectCollection.codename)
            const recordAccessClause = await buildRuntimeRecordAccessClause({
                manager,
                schemaIdent,
                currentWorkspaceId,
                currentUserId: runtimeContext.userId,
                permissions: runtimeContext.permissions,
                objectCodename,
                attrs: safeComponents,
                config: activeObjectCollection.config,
                outerRowIdSql: `${dataTableIdent}.id`,
                values: runtimeListClauses.values
            })
            const libraryViewClause = await buildRuntimeLibraryViewClause({
                manager,
                schemaIdent,
                currentWorkspaceId,
                currentUserId: runtimeContext.userId,
                objectCodename,
                config: activeObjectCollection.config,
                libraryView,
                outerRowIdSql: `${dataTableIdent}.id`,
                values: runtimeListClauses.values
            })
            const runtimeListWhereSql = [runtimeListClauses.whereSql, recordAccessClause, libraryViewClause].filter(Boolean).join(' AND ')
            // Use physicalComponents for SQL because TABLE attrs have no physical column in the parent table.
            const selectColumns = [
                'id',
                ...(activeRecordBehaviorEnabled ? RUNTIME_RECORD_SYSTEM_FIELDS.map((field) => quoteIdentifier(field)) : []),
                ...(includeRuntimeRowVersion || lifecycleState === 'deleted' ? [quoteIdentifier('_upl_version')] : []),
                ...physicalComponents.map((cmp) => quoteIdentifier(cmp.column_name))
            ]

            for (const tAttr of tableAttrs) {
                const fallbackTabTableName = generateChildTableName(tAttr.id)
                const tabTableName =
                    typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                        ? tAttr.column_name
                        : fallbackTabTableName
                if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                const tabTableIdent = `${schemaIdent}.${quoteIdentifier(tabTableName)}`
                selectColumns.push(
                    `(SELECT COUNT(*)::int FROM ${tabTableIdent} WHERE _tp_parent_id = ${dataTableIdent}.id AND ${activeObjectRowCondition}) AS ${quoteIdentifier(
                        tAttr.column_name
                    )}`
                )
            }

            const totalRows = (await manager.query(
                `
        SELECT COUNT(*)::int AS total
        FROM ${dataTableIdent}
        WHERE ${runtimeListWhereSql}
      `,
                runtimeListClauses.values
            )) as Array<{ total: number }>
            total = typeof totalRows[0]?.total === 'number' ? totalRows[0].total : Number(totalRows[0]?.total) || 0

            const pageValues = [...runtimeListClauses.values, limit, offset]
            const rawRows = (await manager.query(
                `
        SELECT ${selectColumns.join(', ')}
        FROM ${dataTableIdent}
        WHERE ${runtimeListWhereSql}
        ORDER BY ${runtimeListClauses.orderBySql}
        LIMIT $${runtimeListClauses.values.length + 1} OFFSET $${runtimeListClauses.values.length + 2}
      `,
                pageValues
            )) as Array<Record<string, unknown>>

            const hasRuntimeListModifiers = Boolean(search?.trim() || sort?.length || filters?.length)
            canPersistRowReordering =
                activeObjectCollectionRuntimeConfig.enableRowReordering &&
                Boolean(reorderFieldAttr) &&
                offset === 0 &&
                total <= limit &&
                !hasRuntimeListModifiers

            rows = rawRows.map((row) => {
                const mappedRow: Record<string, unknown> & { id: string } = {
                    id: String(row.id)
                }

                if (activeRecordBehaviorEnabled) {
                    for (const field of RUNTIME_RECORD_SYSTEM_FIELDS) {
                        mappedRow[field] = row[field] ?? null
                    }
                }
                if (includeRuntimeRowVersion) {
                    mappedRow._upl_version = row._upl_version ?? null
                }
                if (lifecycleState === 'deleted') {
                    mappedRow._upl_version = row._upl_version ?? null
                }

                for (const component of safeComponents) {
                    if (component.data_type === 'TABLE') {
                        mappedRow[component.column_name] = typeof row[component.column_name] === 'number' ? row[component.column_name] : 0
                        continue
                    }
                    mappedRow[component.column_name] = resolveRuntimeValue(row[component.column_name], component.data_type, requestedLocale)
                }

                return mappedRow
            })
        }

        let workspaceLimit: { maxRows: number | null; currentRows: number; canCreate: boolean } | undefined
        if (!isActivePage && runtimeContext.workspacesEnabled && currentWorkspaceId) {
            const maxRows = await getObjectWorkspaceLimit(manager, {
                schemaName,
                objectId: activeObjectCollection.id
            })
            const currentRows = await getObjectWorkspaceUsage(manager, {
                schemaName,
                tableName: activeObjectCollection.table_name as string,
                workspaceId: currentWorkspaceId,
                runtimeRowCondition: buildRuntimeActiveRowCondition(
                    activeObjectCollection.lifecycleContract,
                    activeObjectCollection.config,
                    undefined,
                    currentWorkspaceId
                )
            })
            workspaceLimit = {
                maxRows,
                currentRows,
                canCreate: maxRows === null ? true : currentRows < maxRows
            }
        }

        // Optional layout config for runtime UI (Dashboard sections show/hide).
        let layoutConfig: Record<string, unknown> = {}
        try {
            const layoutsExists = await runtimeSystemTableExists(manager, schemaName, '_app_layouts')

            if (layoutsExists) {
                layoutConfig = selectedLayout.layoutConfig
            } else {
                // Backward compatibility for old schemas.
                const [{ settingsExists }] = (await manager.query(
                    `
            SELECT EXISTS (
              SELECT 1
              FROM information_schema.tables
              WHERE table_schema = $1 AND table_name = '_app_settings'
            ) AS "settingsExists"
          `,
                    [schemaName]
                )) as Array<{ settingsExists: boolean }>

                if (!settingsExists) {
                    layoutConfig = {}
                } else {
                    const uiRows = (await manager.query(
                        `
              SELECT value
              FROM ${schemaIdent}._app_settings
              WHERE key = 'layout'
                AND _upl_deleted = false
                AND _app_deleted = false
              LIMIT 1
            `
                    )) as Array<{ value: Record<string, unknown> | null }>
                    layoutConfig = uiRows?.[0]?.value ?? {}
                }
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[ApplicationsRuntime] Failed to load layout config (ignored)', e)
        }

        layoutConfig = resolveObjectCollectionRuntimeDashboardLayoutConfig({ layoutConfig })
        layoutConfig = {
            ...layoutConfig,
            enableRowReordering: canPersistRowReordering
        }

        const objectCollectionsForRuntime = runtimeObjects.map((objectRow) => ({
            id: objectRow.id,
            kind: resolveRuntimeStandardKind(objectRow.kind) ?? 'object',
            codename: resolveRuntimeCodenameText(objectRow.codename),
            tableName: objectRow.table_name,
            runtimeConfig:
                objectRow.id === activeObjectCollection.id
                    ? activeObjectCollectionRuntimeConfig
                    : normalizeObjectCollectionRuntimeViewConfig(undefined),
            recordBehavior:
                resolveRuntimeStandardKind(objectRow.kind) === 'page' ? undefined : normalizeRuntimeRecordBehavior(objectRow.config),
            workflowActions: resolveRuntimeStandardKind(objectRow.kind) === 'page' ? [] : readConfiguredWorkflowActions(objectRow.config),
            name: resolvePresentationName(objectRow.presentation, requestedLocale, resolveRuntimeCodenameText(objectRow.codename))
        }))

        // Zone widgets for runtime UI (sidebar + center composition).
        type ZoneWidgetItem = {
            id: string
            widgetKey: string
            sortOrder: number
            config: Record<string, unknown>
        }
        let zoneWidgets: {
            left: ZoneWidgetItem[]
            right: ZoneWidgetItem[]
            center: ZoneWidgetItem[]
        } = { left: [], right: [], center: [] }

        try {
            const [{ zoneWidgetsExists }] = (await manager.query(
                `
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = '_app_widgets'
          ) AS "zoneWidgetsExists"
        `,
                [schemaName]
            )) as Array<{ zoneWidgetsExists: boolean }>

            if (zoneWidgetsExists && selectedLayout.layoutId) {
                const widgetRows = (await manager.query(
                    `
              SELECT id, widget_key, sort_order, config, zone
              FROM ${schemaIdent}._app_widgets
              WHERE layout_id = $1
                AND zone IN ('left', 'right', 'center')
                AND is_active = true
                AND _upl_deleted = false
                AND _app_deleted = false
              ORDER BY sort_order ASC, _upl_created_at ASC
            `,
                    [selectedLayout.layoutId]
                )) as Array<{
                    id: string
                    widget_key: string
                    sort_order: number
                    config: Record<string, unknown> | null
                    zone: string
                }>

                for (const row of widgetRows) {
                    const mapped = {
                        id: row.id,
                        widgetKey: row.widget_key,
                        sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
                        config: row.config && typeof row.config === 'object' ? row.config : {}
                    }
                    if (row.zone === 'right') {
                        zoneWidgets.right.push(mapped)
                    } else if (row.zone === 'center') {
                        zoneWidgets.center.push(mapped)
                    } else {
                        zoneWidgets.left.push(mapped)
                    }
                }
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[ApplicationsRuntime] Failed to load zone widgets (ignored)', e)
        }

        // Build menus from menuWidget config stored in zone widgets.
        type RuntimeMenuItem = {
            id: string
            kind: string
            title: string
            icon: string | null
            href: string | null
            objectCollectionId: string | null
            sectionId: string | null
            treeEntityId: string | null
            sortOrder: number
            isActive: boolean
        }

        type RuntimeWorkspacePlacement = 'primary' | 'overflow' | 'hidden'

        type RuntimeMenuEntry = {
            id: string
            widgetId: string
            showTitle: boolean
            title: string
            autoShowAllSections: boolean
            startPage: string | null
            startSectionId: string | null
            maxPrimaryItems: number | null
            overflowLabelKey: string | null
            workspacePlacement: RuntimeWorkspacePlacement
            items: RuntimeMenuItem[]
            overflowItems: RuntimeMenuItem[]
        }

        type RuntimeTreeEntityMeta = {
            id: string
            codename: unknown
            title: string
            parentTreeEntityId: string | null
            sortOrder: number
        }

        type RuntimeObjectCollectionMeta = {
            id: string
            codename: unknown
            title: string
            sortOrder: number
            treeEntityIds: string[]
        }

        let treeEntityMetaById = new Map<string, RuntimeTreeEntityMeta>()
        let treeEntityMetaByCodename = new Map<string, RuntimeTreeEntityMeta>()
        let objectCollectionMetaByCodename = new Map<string, RuntimeObjectCollectionMeta>()
        let childTreeEntityIdsByParent = new Map<string, string[]>()
        let objectCollectionsByTreeEntity = new Map<string, RuntimeObjectCollectionMeta[]>()

        try {
            const objectRows = (await manager.query(
                `
          SELECT id, kind, codename, presentation, config
          FROM ${schemaIdent}._app_objects
                    WHERE (${runtimeStandardKindSql('kind')} = 'hub' OR ${RUNTIME_OBJECT_FILTER_SQL} OR ${runtimeStandardKindSql(
                    'kind'
                )} = 'page')
            AND _upl_deleted = false
            AND _app_deleted = false
        `
            )) as Array<{
                id: string
                kind: string
                codename: unknown
                presentation?: unknown
                config?: unknown
            }>

            for (const row of objectRows) {
                const config = row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : {}
                const rawSortOrder = config.sortOrder
                const sortOrder = typeof rawSortOrder === 'number' ? rawSortOrder : 0
                const title = resolvePresentationName(row.presentation, requestedLocale, resolveRuntimeCodenameText(row.codename))

                if (isRuntimeHubKind(row.kind)) {
                    const parentTreeEntityId = typeof config.parentHubId === 'string' ? config.parentHubId : null
                    const treeEntityMeta: RuntimeTreeEntityMeta = {
                        id: row.id,
                        codename: row.codename,
                        title,
                        parentTreeEntityId,
                        sortOrder
                    }
                    treeEntityMetaById.set(row.id, treeEntityMeta)
                    treeEntityMetaByCodename.set(resolveRuntimeCodenameText(row.codename), treeEntityMeta)
                    continue
                }

                const treeEntityIds = Array.isArray(config.hubs)
                    ? config.hubs.filter((value): value is string => typeof value === 'string')
                    : []
                const objectCollectionMeta: RuntimeObjectCollectionMeta = {
                    id: row.id,
                    codename: row.codename,
                    title,
                    sortOrder,
                    treeEntityIds
                }
                objectCollectionMetaByCodename.set(resolveRuntimeCodenameText(row.codename), objectCollectionMeta)
                for (const treeEntityId of treeEntityIds) {
                    const list = objectCollectionsByTreeEntity.get(treeEntityId) ?? []
                    list.push(objectCollectionMeta)
                    objectCollectionsByTreeEntity.set(treeEntityId, list)
                }
            }

            const treeEntitySortComparator = (a: RuntimeTreeEntityMeta, b: RuntimeTreeEntityMeta) => {
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                return resolveRuntimeCodenameText(a.codename).localeCompare(resolveRuntimeCodenameText(b.codename))
            }
            const objectCollectionSortComparator = (a: RuntimeObjectCollectionMeta, b: RuntimeObjectCollectionMeta) => {
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                return resolveRuntimeCodenameText(a.codename).localeCompare(resolveRuntimeCodenameText(b.codename))
            }

            const treeEntities = Array.from(treeEntityMetaById.values()).sort(treeEntitySortComparator)
            childTreeEntityIdsByParent = new Map<string, string[]>()
            for (const treeEntity of treeEntities) {
                if (!treeEntity.parentTreeEntityId) continue
                const childIds = childTreeEntityIdsByParent.get(treeEntity.parentTreeEntityId) ?? []
                childIds.push(treeEntity.id)
                childTreeEntityIdsByParent.set(treeEntity.parentTreeEntityId, childIds)
            }

            for (const [treeEntityId, treeEntityObjectCollections] of objectCollectionsByTreeEntity.entries()) {
                objectCollectionsByTreeEntity.set(treeEntityId, [...treeEntityObjectCollections].sort(objectCollectionSortComparator))
            }
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[ApplicationsRuntime] Failed to build hub/object runtime map for menuWidget (ignored)', e)
            treeEntityMetaById = new Map()
            treeEntityMetaByCodename = new Map()
            objectCollectionMetaByCodename = new Map()
            childTreeEntityIdsByParent = new Map()
            objectCollectionsByTreeEntity = new Map()
        }

        const resolveObjectCollectionId = (value: unknown): string | null => {
            if (typeof value !== 'string' || value.trim().length === 0) return null
            const normalized = value.trim()
            if (objectCollectionsForRuntime.some((section) => section.id === normalized)) return normalized
            return objectCollectionMetaByCodename.get(normalized)?.id ?? null
        }

        const resolveTreeEntityId = (value: unknown): string | null => {
            if (typeof value !== 'string' || value.trim().length === 0) return null
            const normalized = value.trim()
            if (treeEntityMetaById.has(normalized)) return normalized
            return treeEntityMetaByCodename.get(normalized)?.id ?? null
        }

        const resolveStartSectionId = (value: unknown, items: RuntimeMenuItem[]): string | null => {
            if (typeof value !== 'string' || value.trim().length === 0) return null
            const normalized = value.trim()
            const explicitItem = items.find((item) => item.id === normalized)
            if (explicitItem?.sectionId || explicitItem?.objectCollectionId) {
                return explicitItem.sectionId ?? explicitItem.objectCollectionId
            }
            const treeEntityId = resolveTreeEntityId(normalized)
            if (treeEntityId) {
                return (
                    items.find((item) => item.treeEntityId === treeEntityId && (item.sectionId || item.objectCollectionId))?.sectionId ??
                    null
                )
            }
            return resolveObjectCollectionId(normalized)
        }

        const normalizeMenuItem = (item: unknown): RuntimeMenuItem | null => {
            if (!item || typeof item !== 'object') return null
            const typed = item as Record<string, unknown>
            if (typed.isActive === false) return null

            const kind = typeof typed.kind === 'string' && typed.kind.trim().length > 0 ? typed.kind : 'link'
            const objectCollectionId = resolveObjectCollectionId(typed.sectionId ?? typed.objectCollectionId)
            const treeEntityId = resolveTreeEntityId(typed.hubId ?? typed.treeEntityId)
            return {
                id: String(typed.id ?? ''),
                kind,
                title: resolveLocalizedContent(typed.title, requestedLocale, kind),
                icon: typeof typed.icon === 'string' ? typed.icon : null,
                href: typeof typed.href === 'string' ? typed.href : null,
                objectCollectionId,
                sectionId: objectCollectionId,
                treeEntityId,
                sortOrder: typeof typed.sortOrder === 'number' ? typed.sortOrder : 0,
                isActive: true
            }
        }

        const buildTreeEntityMenuItems = (baseItem: RuntimeMenuItem): RuntimeMenuItem[] => {
            if (!baseItem.treeEntityId) return []
            if (!treeEntityMetaById.has(baseItem.treeEntityId)) return []

            const items: RuntimeMenuItem[] = []
            const visited = new Set<string>()
            const treeEntitySortComparator = (aId: string, bId: string) => {
                const a = treeEntityMetaById.get(aId)
                const b = treeEntityMetaById.get(bId)
                if (!a || !b) return aId.localeCompare(bId)
                if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
                return resolveRuntimeCodenameText(a.codename).localeCompare(resolveRuntimeCodenameText(b.codename))
            }

            const walkTreeEntity = (treeEntityId: string, depth: number) => {
                if (visited.has(treeEntityId)) return
                visited.add(treeEntityId)

                const treeEntityMeta = treeEntityMetaById.get(treeEntityId)
                if (!treeEntityMeta) return
                const indent = depth > 0 ? `${'\u00A0\u00A0'.repeat(depth)}• ` : ''

                items.push({
                    id: `${baseItem.id}:hub:${treeEntityMeta.id}`,
                    kind: 'hub',
                    title: `${indent}${treeEntityMeta.title}`,
                    icon: baseItem.icon,
                    href: null,
                    objectCollectionId: null,
                    sectionId: null,
                    treeEntityId: treeEntityMeta.id,
                    sortOrder: baseItem.sortOrder,
                    isActive: true
                })

                const treeEntityObjectCollections = objectCollectionsByTreeEntity.get(treeEntityMeta.id) ?? []
                for (const lc of treeEntityObjectCollections) {
                    items.push({
                        id: `${baseItem.id}:hub:${treeEntityMeta.id}:section:${lc.id}`,
                        kind: 'section',
                        title: `${'\u00A0\u00A0'.repeat(depth + 1)}${lc.title}`,
                        icon: baseItem.icon,
                        href: null,
                        objectCollectionId: lc.id,
                        sectionId: lc.id,
                        treeEntityId: treeEntityMeta.id,
                        sortOrder: baseItem.sortOrder,
                        isActive: true
                    })
                }

                const childIds = [...(childTreeEntityIdsByParent.get(treeEntityMeta.id) ?? [])].sort(treeEntitySortComparator)
                for (const childId of childIds) {
                    walkTreeEntity(childId, depth + 1)
                }
            }

            walkTreeEntity(baseItem.treeEntityId, 0)
            return items
        }

        const buildBoundTreeEntityObjectCollectionItems = (widgetId: string, boundTreeEntityId: string): RuntimeMenuItem[] => {
            if (!treeEntityMetaById.has(boundTreeEntityId)) return []
            const directObjectCollections = objectCollectionsByTreeEntity.get(boundTreeEntityId) ?? []
            return directObjectCollections.map((lc, index) => ({
                id: `${widgetId}:bound-hub:${boundTreeEntityId}:section:${lc.id}`,
                kind: 'section',
                title: lc.title,
                icon: 'database',
                href: null,
                objectCollectionId: lc.id,
                sectionId: lc.id,
                treeEntityId: boundTreeEntityId,
                sortOrder: index + 1,
                isActive: true
            }))
        }

        const buildAllObjectCollectionMenuItems = (widgetId: string): RuntimeMenuItem[] => {
            return objectCollectionsForRuntime.map((lc, index) => ({
                id: `${widgetId}:all-sections:${lc.id}`,
                kind: 'section',
                title: lc.name,
                icon: 'database',
                href: null,
                objectCollectionId: lc.id,
                sectionId: lc.id,
                treeEntityId: null,
                sortOrder: index + 1,
                isActive: true
            }))
        }

        const buildWorkspaceMenuItem = (widgetId: string, sortOrder: number): RuntimeMenuItem => ({
            id: 'runtime-workspaces',
            kind: 'link',
            title: requestedLocale === 'ru' ? 'Рабочие пространства' : 'Workspaces',
            icon: 'apps',
            href: `/a/${applicationId}/workspaces`,
            objectCollectionId: null,
            sectionId: null,
            treeEntityId: null,
            sortOrder,
            isActive: true
        })

        let menus: RuntimeMenuEntry[] = []
        let activeMenuId: string | null = null

        try {
            for (const widget of zoneWidgets.left) {
                if (widget.widgetKey !== 'menuWidget') continue
                const cfg = widget.config as Record<string, unknown>
                const bindToTreeEntity = Boolean(cfg.bindToHub)
                const boundTreeEntityId = resolveTreeEntityId(cfg.boundHubId ?? cfg.boundTreeEntityId)
                const autoShowAllSections = Boolean(cfg.autoShowAllSections) && !bindToTreeEntity

                let resolvedItems: RuntimeMenuItem[] = []
                if (bindToTreeEntity && boundTreeEntityId) {
                    resolvedItems = buildBoundTreeEntityObjectCollectionItems(widget.id, boundTreeEntityId)
                } else if (autoShowAllSections) {
                    resolvedItems = buildAllObjectCollectionMenuItems(widget.id)
                } else {
                    const rawItems = Array.isArray(cfg.items) ? cfg.items : []
                    const normalizedItems = rawItems
                        .map((item) => normalizeMenuItem(item))
                        .filter((item): item is RuntimeMenuItem => item !== null)
                        .sort((a, b) => a.sortOrder - b.sortOrder)

                    for (const item of normalizedItems) {
                        if (isRuntimeHubKind(item.kind)) {
                            const expanded = buildTreeEntityMenuItems(item)
                            if (expanded.length > 0) {
                                resolvedItems.push(...expanded)
                            }
                            continue
                        }
                        resolvedItems.push(item)
                    }
                }

                const rawMaxPrimaryItems = cfg.maxPrimaryItems
                const maxPrimaryItems =
                    typeof rawMaxPrimaryItems === 'number' && Number.isFinite(rawMaxPrimaryItems)
                        ? Math.max(1, Math.min(12, Math.trunc(rawMaxPrimaryItems)))
                        : null
                const rawWorkspacePlacement = cfg.workspacePlacement
                const workspacePlacement: RuntimeWorkspacePlacement =
                    rawWorkspacePlacement === 'overflow' || rawWorkspacePlacement === 'hidden' ? rawWorkspacePlacement : 'primary'
                let workspaceItem: RuntimeMenuItem | null = null
                if (runtimeContext.workspacesEnabled) {
                    workspaceItem = buildWorkspaceMenuItem(widget.id, resolvedItems.length + 1000)
                }
                const { primaryItems, overflowItems } = partitionRuntimeMenuItems(
                    resolvedItems,
                    maxPrimaryItems,
                    workspaceItem,
                    workspacePlacement
                )

                const menuEntry = {
                    id: widget.id,
                    widgetId: widget.id,
                    showTitle: Boolean(cfg.showTitle),
                    title: resolveLocalizedContent(cfg.title, requestedLocale, ''),
                    autoShowAllSections,
                    startPage: typeof cfg.startPage === 'string' ? cfg.startPage : null,
                    startSectionId: resolveStartSectionId(cfg.startPage, resolvedItems),
                    maxPrimaryItems,
                    overflowLabelKey: typeof cfg.overflowLabelKey === 'string' ? cfg.overflowLabelKey : null,
                    workspacePlacement,
                    items: primaryItems,
                    overflowItems
                } satisfies RuntimeMenuEntry
                menus.push(menuEntry)
            }
            activeMenuId = menus[0]?.id ?? null
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('[ApplicationsRuntime] Failed to build menus from widget config (ignored)', e)
        }

        type RuntimeColumnDefinition = {
            id: string
            codename: unknown
            field: string
            dataType: RuntimeDataType
            isRequired: boolean
            isDisplayComponent: boolean
            headerName: string
            validationRules: Record<string, unknown>
            uiConfig: Record<string, unknown>
            refTargetEntityId: string | null
            refTargetEntityKind: string | null
            refTargetConstantId: string | null
            refOptions?: RuntimeRefOption[]
            enumOptions?: RuntimeRefOption[]
            childColumns?: RuntimeColumnDefinition[]
        }

        const buildSetConstantOption = (valueGroupFixedValueConfig: SetConstantUiConfig | null): RuntimeRefOption[] | undefined => {
            if (!valueGroupFixedValueConfig) return undefined
            return [
                {
                    id: valueGroupFixedValueConfig.id,
                    label: resolveSetConstantLabel(valueGroupFixedValueConfig, requestedLocale),
                    codename: valueGroupFixedValueConfig.codename ?? 'valueGroupFixedValue',
                    isDefault: true,
                    sortOrder: 0
                }
            ]
        }

        const resolveRefOptions = (
            component: (typeof safeComponents)[number],
            setConstantOption: RuntimeRefOption[] | undefined
        ): RuntimeRefOption[] | undefined => {
            const targetObjectKind = component.target_object_kind ?? null

            if (
                component.data_type !== 'REF' ||
                typeof component.target_object_id !== 'string' ||
                (!isRuntimeEnumerationKind(targetObjectKind) &&
                    !isRuntimeSetKind(targetObjectKind) &&
                    !isRuntimeObjectTargetKind(targetObjectKind))
            ) {
                return undefined
            }

            if (isRuntimeEnumerationKind(targetObjectKind)) {
                return enumOptionsMap.get(component.target_object_id) ?? []
            }
            if (isRuntimeObjectTargetKind(targetObjectKind)) {
                return objectRefOptionsMap.get(component.target_object_id) ?? []
            }
            return setConstantOption ?? []
        }

        const mapComponentToColumnDefinition = (
            component: (typeof safeComponents)[number],
            includeChildColumns: boolean
        ): RuntimeColumnDefinition => {
            const valueGroupFixedValueConfig =
                component.data_type === 'REF' && isRuntimeSetKind(component.target_object_kind)
                    ? getSetConstantConfig(component.ui_config)
                    : null
            const setConstantOption = buildSetConstantOption(valueGroupFixedValueConfig)
            const refOptions = resolveRefOptions(component, setConstantOption)
            const enumOptions =
                component.data_type === 'REF' &&
                isRuntimeEnumerationKind(component.target_object_kind) &&
                component.target_object_id &&
                enumOptionsMap.has(component.target_object_id)
                    ? enumOptionsMap.get(component.target_object_id)
                    : undefined

            return {
                id: component.id,
                codename: resolveRuntimeCodenameText(component.codename),
                field: component.column_name,
                dataType: component.data_type,
                isRequired: component.is_required ?? false,
                isDisplayComponent: component.is_display_component === true,
                headerName: resolvePresentationName(
                    component.presentation,
                    requestedLocale,
                    resolveRuntimeCodenameText(component.codename)
                ),
                validationRules: component.validation_rules ?? {},
                uiConfig: {
                    ...(component.ui_config ?? {}),
                    ...(valueGroupFixedValueConfig?.dataType ? { setConstantDataType: valueGroupFixedValueConfig.dataType } : {})
                },
                refTargetEntityId: component.target_object_id ?? null,
                refTargetEntityKind: component.target_object_kind ?? null,
                refTargetConstantId: valueGroupFixedValueConfig?.id ?? null,
                refOptions,
                enumOptions,
                ...(includeChildColumns && component.data_type === 'TABLE'
                    ? {
                          childColumns: (childAttrsByTableId.get(component.id) ?? []).map((child) =>
                              mapComponentToColumnDefinition(child, false)
                          )
                      }
                    : {})
            }
        }

        const activeSectionPayload = {
            id: activeObjectCollection.id,
            kind: activeObjectCollectionKind ?? 'object',
            codename: resolveRuntimeCodenameText(activeObjectCollection.codename),
            tableName: activeObjectCollection.table_name,
            pageBlocks: isActivePage ? normalizeRuntimePageBlocks(activeObjectCollection.config?.blockContent) : undefined,
            runtimeConfig: {
                ...activeObjectCollectionRuntimeConfig,
                enableRowReordering: canPersistRowReordering
            },
            recordBehavior: isActivePage ? undefined : activeRecordBehavior,
            workflowActions: activeWorkflowActions,
            name: resolvePresentationName(
                activeObjectCollection.presentation,
                requestedLocale,
                resolveRuntimeCodenameText(activeObjectCollection.codename)
            )
        }

        return res.json({
            section: activeSectionPayload,
            sections: objectCollectionsForRuntime,
            activeSectionId: activeObjectCollection.id,
            objectCollection: {
                ...activeSectionPayload
            },
            objectCollections: objectCollectionsForRuntime,
            activeObjectCollectionId: activeObjectCollection.id,
            columns: safeComponents.map((component) => mapComponentToColumnDefinition(component, true)),
            rows,
            pagination: {
                total: typeof total === 'number' ? total : Number(total) || 0,
                limit,
                offset
            },
            ...(workspaceLimit ? { workspaceLimit } : {}),
            settings: runtimeContext.applicationSettings,
            workspacesEnabled: runtimeContext.workspacesEnabled,
            currentWorkspaceId: runtimeContext.currentWorkspaceId,
            permissions: runtimeContext.permissions,
            workflowCapabilities: runtimeContext.workflowCapabilities,
            layoutConfig,
            zoneWidgets,
            menus,
            activeMenuId
        })
    }

    // ============ UPDATE SINGLE CELL ============
    const updateCell = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const parsedBody = runtimeUpdateBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { field, value, objectCollectionId: requestedObjectCollectionId, expectedVersion } = parsedBody.data
        if (!IDENTIFIER_REGEX.test(field)) {
            return res.status(400).json({ error: 'Invalid field name' })
        }

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )

        const cmp = attrs.find((a) => a.column_name === field)
        if (!cmp) return res.status(404).json({ error: 'Component not found' })
        if (!RUNTIME_WRITABLE_TYPES.has(cmp.data_type)) {
            return res.status(400).json({
                error: `Field type ${cmp.data_type} is not editable`
            })
        }

        if (cmp.data_type === 'TABLE') {
            return res.status(400).json({
                error: `Field type ${cmp.data_type} must be edited via tabular endpoints`
            })
        }

        if (
            cmp.data_type === 'REF' &&
            isRuntimeEnumerationKind(cmp.target_object_kind) &&
            getEnumPresentationMode(cmp.ui_config) === 'label'
        ) {
            return res.status(400).json({
                error: `Field is read-only: ${cmp.codename}`
            })
        }

        const valueGroupFixedValueConfig =
            cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
        let rawValue = value
        if (valueGroupFixedValueConfig) {
            const providedRefId = resolveRefId(rawValue)
            if (!providedRefId) {
                rawValue = valueGroupFixedValueConfig.id
            } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                return res.status(400).json({
                    error: `Field is read-only: ${cmp.codename}`
                })
            } else {
                rawValue = valueGroupFixedValueConfig.id
            }
        }

        let coerced: unknown
        try {
            coerced = normalizeConfiguredRuntimeJsonValue(coerceRuntimeValue(rawValue, cmp.data_type, cmp.validation_rules), cmp)
        } catch (e) {
            return res.status(400).json({ error: (e as Error).message })
        }

        if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
            return res.status(400).json({
                error: `Required field cannot be set to null: ${cmp.codename}`
            })
        }

        if (
            cmp.data_type === 'REF' &&
            isRuntimeEnumerationKind(cmp.target_object_kind) &&
            typeof cmp.target_object_id === 'string' &&
            coerced
        ) {
            try {
                await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), cmp.target_object_id)
            } catch (error) {
                return res.status(400).json({ error: (error as Error).message })
            }
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`

        let afterUpdateLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        try {
            await ctx.manager.transaction(async (txManager) => {
                const objectCodename = resolveRuntimeCodenameText(objectCollection.codename)
                const previousRow = await loadRuntimeRowByIdWithRecordAccess({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    dataTableIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename,
                    attrs,
                    config: objectCollection.config,
                    rowId,
                    rowCondition: runtimeRowCondition,
                    minimumAccessLevel: 'edit'
                })
                if (!previousRow || !previousRow.id) {
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }
                if (previousRow._upl_locked) {
                    throw new UpdateFailure(423, { error: 'Record is locked' })
                }
                assertRuntimeRecordMutable(objectCollection.config, previousRow)

                const referenceValidationError = await validateRuntimeRecordPickerReferences({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    attrs,
                    row: { ...previousRow, [field]: coerced }
                })
                if (referenceValidationError) {
                    throw new UpdateFailure(400, { error: referenceValidationError })
                }
                const accessEntryValidationError = await validateRuntimeAccessEntryMembership({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectConfig: objectCollection.config,
                    attrs,
                    row: { ...previousRow, [field]: coerced }
                })
                if (accessEntryValidationError) {
                    throw new UpdateFailure(400, { error: accessEntryValidationError })
                }
                const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectConfig: objectCollection.config,
                    attrs,
                    row: { ...previousRow, [field]: coerced },
                    minimumAccessLevel: 'edit'
                })
                if (parentAccessValidationError) {
                    throw new UpdateFailure(400, { error: parentAccessValidationError })
                }
                const requiredWhenValidationError = validateRuntimeRequiredWhenRules({
                    config: objectCollection.config,
                    attrs,
                    row: { ...previousRow, [field]: coerced }
                })
                if (requiredWhenValidationError) {
                    throw new UpdateFailure(400, { error: requiredWhenValidationError })
                }
                const dateOrderValidationError = validateRuntimeDateOrderRules({
                    config: objectCollection.config,
                    attrs,
                    row: { ...previousRow, [field]: coerced }
                })
                if (dateOrderValidationError) {
                    throw new UpdateFailure(400, { error: dateOrderValidationError })
                }

                await dispatchRuntimeLifecycle({
                    manager: txManager,
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    componentIds: [cmp.id],
                    payload: {
                        eventName: 'beforeUpdate',
                        previousRow,
                        patch: { [field]: coerced }
                    }
                })

                const updateValues: unknown[] = [coerced, ctx.userId, rowId]
                if (expectedVersion !== undefined) updateValues.push(expectedVersion)
                const versionCheckClause = expectedVersion !== undefined ? `AND COALESCE(_upl_version, 1) = $${updateValues.length}` : ''
                const updateAccessClause = await buildRuntimeRecordAccessClause({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename,
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: updateValues,
                    minimumAccessLevel: 'edit'
                })
                const updateWhereSql = ['id = $3', runtimeRowCondition, 'COALESCE(_upl_locked, false) = false', updateAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')

                const updated = (await txManager.query(
                    `
            UPDATE ${dataTableIdent}
            SET ${quoteIdentifier(field)} = $1,
                _upl_updated_at = NOW(),
                _upl_updated_by = $2,
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE ${updateWhereSql}
              ${versionCheckClause}
            RETURNING id
          `,
                    updateValues
                )) as Array<{ id: string; status?: unknown; progress_percent?: unknown }>

                if (updated.length === 0) {
                    const exists = (await txManager.query(
                        `SELECT id, _upl_locked, _upl_version FROM ${dataTableIdent} WHERE id = $1 AND ${runtimeRowCondition}`,
                        [rowId]
                    )) as Array<{
                        id: string
                        _upl_locked?: boolean
                        _upl_version?: number
                    }>

                    if (exists.length > 0 && exists[0]._upl_locked) {
                        throw new UpdateFailure(423, { error: 'Record is locked' })
                    }

                    if (exists.length > 0 && expectedVersion !== undefined) {
                        const actualVersion = Number(exists[0]._upl_version ?? 1)
                        if (actualVersion !== expectedVersion) {
                            throw new UpdateFailure(409, {
                                error: 'Version mismatch',
                                expectedVersion,
                                actualVersion
                            })
                        }
                    }

                    throw new UpdateFailure(404, { error: 'Row not found' })
                }

                const nextRow = await loadRuntimeRowById(txManager, dataTableIdent, rowId, runtimeRowCondition)
                afterUpdateLifecycleRequest = {
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    componentIds: [cmp.id],
                    payload: {
                        eventName: 'afterUpdate',
                        row: nextRow,
                        previousRow,
                        patch: { [field]: coerced }
                    }
                }
            })

            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterUpdateLifecycleRequest)
            return res.json({ status: 'ok' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }

    // ============ BULK UPDATE ROW ============
    const bulkUpdateRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const parsedBody = runtimeBulkUpdateBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { objectCollectionId: requestedObjectCollectionId, data, expectedVersion } = parsedBody.data

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeDeleteSetClause = isSoftDeleteLifecycle(objectCollection.lifecycleContract)
            ? buildRuntimeSoftDeleteSetClause('$1', objectCollection.lifecycleContract, objectCollection.config)
            : null

        const setClauses: string[] = []
        const values: unknown[] = []
        const normalizedPatchByColumn: Record<string, unknown> = {}
        let paramIndex = 1
        const touchedComponentIds = collectTouchedComponentIds(attrs, data)

        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type))
        const nonTableAttrs = safeAttrs.filter((a) => a.data_type !== 'TABLE')
        const tableAttrsForUpdate = safeAttrs.filter((a) => a.data_type === 'TABLE')

        for (const cmp of nonTableAttrs) {
            const attrLabel = formatRuntimeFieldLabel(cmp.codename)
            const { value: raw } = getRuntimeInputValue(data, cmp.column_name, cmp.codename)
            if (raw === undefined) continue
            let normalizedRaw = raw

            if (
                cmp.data_type === 'REF' &&
                isRuntimeEnumerationKind(cmp.target_object_kind) &&
                getEnumPresentationMode(cmp.ui_config) === 'label'
            ) {
                return res.status(400).json({
                    error: `Field is read-only: ${attrLabel}`
                })
            }
            const valueGroupFixedValueConfig =
                cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
            if (valueGroupFixedValueConfig) {
                const providedRefId = resolveRefId(raw)
                if (!providedRefId) {
                    normalizedRaw = valueGroupFixedValueConfig.id
                } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                    return res.status(400).json({
                        error: `Field is read-only: ${attrLabel}`
                    })
                } else {
                    normalizedRaw = valueGroupFixedValueConfig.id
                }
            }

            try {
                const coerced = normalizeConfiguredRuntimeJsonValue(
                    coerceRuntimeValue(normalizedRaw, cmp.data_type, cmp.validation_rules),
                    cmp
                )
                if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
                    return res.status(400).json({
                        error: `Required field cannot be set to null: ${attrLabel}`
                    })
                }

                if (
                    cmp.data_type === 'REF' &&
                    isRuntimeEnumerationKind(cmp.target_object_kind) &&
                    typeof cmp.target_object_id === 'string' &&
                    coerced
                ) {
                    await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), cmp.target_object_id)
                }

                setClauses.push(`${quoteIdentifier(cmp.column_name)} = $${paramIndex}`)
                values.push(coerced)
                normalizedPatchByColumn[cmp.column_name] = coerced
                paramIndex++
            } catch (e) {
                return res.status(400).json({
                    error: `Invalid value for ${attrLabel}: ${(e as Error).message}`
                })
            }
        }

        const tableDataEntries: Array<{
            tabTableName: string
            rows: Array<Record<string, unknown>>
            childAttrsByColumn: Map<string, RuntimeTableChildComponentMeta>
        }> = []

        for (const tAttr of tableAttrsForUpdate) {
            const tableFieldPath = formatRuntimeFieldPath(tAttr.codename)
            const { hasUserValue, value: raw } = getRuntimeInputValue(data, tAttr.column_name, tAttr.codename)
            if (!hasUserValue) continue
            if (raw !== undefined && raw !== null && !Array.isArray(raw)) {
                return res.status(400).json({
                    error: `Invalid value for ${tableFieldPath}: TABLE value must be an array`
                })
            }

            const childRows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []
            const rowCountError = getTableRowCountError(childRows.length, tableFieldPath, getTableRowLimits(tAttr.validation_rules))
            if (rowCountError) {
                return res.status(400).json({ error: rowCountError })
            }

            const fallbackTabTableName = generateChildTableName(tAttr.id)
            const tabTableName =
                typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name) ? tAttr.column_name : fallbackTabTableName
            if (!IDENTIFIER_REGEX.test(tabTableName)) {
                return res.status(400).json({
                    error: `Invalid tabular table name for ${tableFieldPath}`
                })
            }

            const childAttrsResult = (await ctx.manager.query(
                `
          SELECT id, codename, column_name, data_type, is_required, validation_rules,
                 target_object_id, target_object_kind, ui_config
          FROM ${ctx.schemaIdent}._app_components
          WHERE parent_component_id = $1
            AND _upl_deleted = false
            AND _app_deleted = false
          ORDER BY sort_order ASC
        `,
                [tAttr.id]
            )) as Array<{
                id: string
                codename: unknown
                column_name: string
                data_type: string
                is_required: boolean
                validation_rules?: Record<string, unknown>
                target_object_id?: string | null
                target_object_kind?: string | null
                ui_config?: Record<string, unknown>
            }>

            const preparedRows: Array<Record<string, unknown>> = []

            for (let rowIdx = 0; rowIdx < childRows.length; rowIdx++) {
                const rowData = childRows[rowIdx]
                if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) {
                    return res.status(400).json({
                        error: `Invalid row ${rowIdx + 1} for ${tableFieldPath}: row must be an object`
                    })
                }

                const preparedRow: Record<string, unknown> = {}

                for (const cAttr of childAttrsResult) {
                    if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue

                    const childFieldPath = formatRuntimeFieldPath(tAttr.codename, cAttr.codename)
                    const isEnumRef = cAttr.data_type === 'REF' && isRuntimeEnumerationKind(cAttr.target_object_kind)
                    const { hasUserValue: hasChildUserValue, value: childInputValue } = getRuntimeInputValue(
                        rowData,
                        cAttr.column_name,
                        cAttr.codename
                    )
                    let cRaw = childInputValue

                    if (isEnumRef && getEnumPresentationMode(cAttr.ui_config) === 'label' && hasChildUserValue) {
                        return res.status(400).json({
                            error: `Field is read-only: ${childFieldPath}`
                        })
                    }

                    if (cRaw === undefined && isEnumRef && typeof cAttr.target_object_id === 'string') {
                        const defaultEnumValueId = getDefaultEnumValueId(cAttr.ui_config)
                        if (defaultEnumValueId) {
                            try {
                                await ensureEnumerationValueBelongsToTarget(
                                    ctx.manager,
                                    ctx.schemaIdent,
                                    defaultEnumValueId,
                                    cAttr.target_object_id
                                )
                                cRaw = defaultEnumValueId
                            } catch (error) {
                                if (error instanceof Error && error.message === 'Enumeration value does not belong to target enumeration') {
                                    cRaw = undefined
                                } else {
                                    throw error
                                }
                            }
                        }
                    }

                    const childSetConstantConfig =
                        cAttr.data_type === 'REF' && isRuntimeSetKind(cAttr.target_object_kind)
                            ? getSetConstantConfig(cAttr.ui_config)
                            : null
                    if (childSetConstantConfig) {
                        const providedRefId = resolveRefId(cRaw)
                        if (!providedRefId) {
                            cRaw = childSetConstantConfig.id
                        } else if (providedRefId !== childSetConstantConfig.id) {
                            return res.status(400).json({
                                error: `Field is read-only: ${childFieldPath}`
                            })
                        } else {
                            cRaw = childSetConstantConfig.id
                        }
                    }

                    if (cRaw === undefined || cRaw === null) {
                        if (cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
                            let defaultValue: unknown
                            switch (cAttr.data_type) {
                                case 'STRING':
                                    defaultValue = ''
                                    break
                                case 'NUMBER':
                                    defaultValue = 0
                                    break
                                default:
                                    defaultValue = ''
                            }
                            preparedRow[cAttr.column_name] = defaultValue
                        }
                        continue
                    }

                    try {
                        const cCoerced = normalizeConfiguredRuntimeJsonValue(
                            coerceRuntimeValue(cRaw, cAttr.data_type, cAttr.validation_rules),
                            cAttr
                        )

                        if (isEnumRef && typeof cAttr.target_object_id === 'string' && cCoerced) {
                            await ensureEnumerationValueBelongsToTarget(
                                ctx.manager,
                                ctx.schemaIdent,
                                String(cCoerced),
                                cAttr.target_object_id
                            )
                        }

                        preparedRow[cAttr.column_name] = normalizeRuntimeTableChildInsertValue(
                            cCoerced,
                            cAttr.data_type,
                            cAttr.validation_rules
                        )
                    } catch (err) {
                        return res.status(400).json({
                            error: `Invalid value for ${childFieldPath}: ${err instanceof Error ? err.message : String(err)}`
                        })
                    }
                }

                preparedRows.push(preparedRow)
            }

            tableDataEntries.push({
                tabTableName,
                rows: preparedRows,
                childAttrsByColumn: new Map(
                    childAttrsResult.map((childAttr) => [
                        childAttr.column_name,
                        {
                            column_name: childAttr.column_name,
                            data_type: childAttr.data_type,
                            validation_rules: childAttr.validation_rules
                        }
                    ])
                )
            })
        }

        if (setClauses.length === 0 && tableDataEntries.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' })
        }

        setClauses.push('_upl_updated_at = NOW()')
        setClauses.push(`_upl_updated_by = $${paramIndex}`)
        values.push(ctx.userId)
        paramIndex++
        setClauses.push(`_upl_version = COALESCE(_upl_version, 1) + 1`)

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        values.push(rowId)
        const rowIdParamIndex = paramIndex
        let versionCheckClause = ''

        if (expectedVersion !== undefined) {
            values.push(expectedVersion)
            versionCheckClause = `AND COALESCE(_upl_version, 1) = $${rowIdParamIndex + 1}`
        }

        let afterUpdateLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        const performBulkUpdate = async (mgr: DbExecutor) => {
            const objectCodename = resolveRuntimeCodenameText(objectCollection.codename)
            const updateAccessClause = await buildRuntimeRecordAccessClause({
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                objectCodename,
                attrs,
                config: objectCollection.config,
                outerRowIdSql: `${dataTableIdent}.id`,
                values,
                minimumAccessLevel: 'edit'
            })
            const updateWhereSql = [
                `id = $${rowIdParamIndex}`,
                runtimeRowCondition,
                'COALESCE(_upl_locked, false) = false',
                updateAccessClause
            ]
                .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                .join(' AND ')
            const updated = (await mgr.query(
                `
          UPDATE ${dataTableIdent}
          SET ${setClauses.join(', ')}
          WHERE ${updateWhereSql}
            ${versionCheckClause}
          RETURNING id
        `,
                values
            )) as Array<{ id: string }>

            if (updated.length === 0) {
                const exists = (await mgr.query(
                    `SELECT id, _upl_locked, _upl_version FROM ${dataTableIdent} WHERE id = $1 AND ${runtimeRowCondition}`,
                    [rowId]
                )) as Array<{
                    id: string
                    _upl_locked?: boolean
                    _upl_version?: number
                }>

                if (exists.length > 0 && exists[0]._upl_locked) {
                    throw new UpdateFailure(423, {
                        error: 'Record is locked'
                    })
                }
                if (exists.length > 0 && expectedVersion !== undefined) {
                    const actualVersion = Number(exists[0]._upl_version ?? 1)
                    if (actualVersion !== expectedVersion) {
                        throw new UpdateFailure(409, {
                            error: 'Version mismatch',
                            expectedVersion,
                            actualVersion
                        })
                    }
                }
                throw new UpdateFailure(404, {
                    error: 'Row not found'
                })
            }

            // Replace child rows for each TABLE component using batch INSERT
            for (const { tabTableName, rows: childRows, childAttrsByColumn } of tableDataEntries) {
                const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

                // Soft-delete existing child rows
                if (runtimeDeleteSetClause) {
                    await mgr.query(
                        `
              UPDATE ${tabTableIdent}
              SET ${runtimeDeleteSetClause},
                  _upl_version = COALESCE(_upl_version, 1) + 1
              WHERE _tp_parent_id = $2
                AND ${runtimeRowCondition}
            `,
                        [ctx.userId, rowId]
                    )
                } else {
                    await mgr.query(
                        `
              DELETE FROM ${tabTableIdent}
              WHERE _tp_parent_id = $1
                AND ${runtimeRowCondition}
            `,
                        [rowId]
                    )
                }

                // Batch insert new child rows
                if (childRows.length > 0) {
                    const dataColSet = new Set<string>()
                    for (const rd of childRows) {
                        for (const cn of Object.keys(rd)) {
                            if (IDENTIFIER_REGEX.test(cn)) dataColSet.add(cn)
                        }
                    }
                    const dataColumns = [...dataColSet]
                    const headerCols: string[] = ['_tp_parent_id', '_tp_sort_order']
                    if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                        headerCols.push(quoteIdentifier('workspace_id'))
                    }
                    if (ctx.userId) headerCols.push('_upl_created_by')
                    const allColumns = [...headerCols, ...dataColumns.map((c) => quoteIdentifier(c))]
                    const allValues: unknown[] = []
                    const valueTuples: string[] = []
                    let pIdx = 1

                    for (let rowIdx = 0; rowIdx < childRows.length; rowIdx++) {
                        const rowData = childRows[rowIdx]
                        const ph: string[] = []
                        ph.push(`$${pIdx++}`)
                        allValues.push(rowId)
                        ph.push(`$${pIdx++}`)
                        allValues.push(rowIdx)
                        if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                            ph.push(`$${pIdx++}`)
                            allValues.push(ctx.currentWorkspaceId)
                        }
                        if (ctx.userId) {
                            ph.push(`$${pIdx++}`)
                            allValues.push(ctx.userId)
                        }
                        for (const cn of dataColumns) {
                            ph.push(`$${pIdx++}`)
                            allValues.push(normalizeRuntimeTableChildInsertValueByMeta(rowData[cn] ?? null, childAttrsByColumn.get(cn)))
                        }
                        valueTuples.push(`(${ph.join(', ')})`)
                    }

                    await mgr.query(`INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`, allValues)
                }
            }
        }

        try {
            await ctx.manager.transaction(async (txManager) => {
                const previousRow = await loadRuntimeRowByIdWithRecordAccess({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    dataTableIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                    attrs,
                    config: objectCollection.config,
                    rowId,
                    rowCondition: runtimeRowCondition,
                    minimumAccessLevel: 'edit'
                })
                if (!previousRow || !previousRow.id) {
                    throw new UpdateFailure(404, {
                        error: 'Row not found'
                    })
                }
                if (previousRow._upl_locked) {
                    throw new UpdateFailure(423, {
                        error: 'Record is locked'
                    })
                }
                assertRuntimeRecordMutable(objectCollection.config, previousRow)

                const referenceValidationError = await validateRuntimeRecordPickerReferences({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    attrs,
                    row: { ...previousRow, ...normalizedPatchByColumn }
                })
                if (referenceValidationError) {
                    throw new UpdateFailure(400, { error: referenceValidationError })
                }
                const accessEntryValidationError = await validateRuntimeAccessEntryMembership({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectConfig: objectCollection.config,
                    attrs,
                    row: { ...previousRow, ...normalizedPatchByColumn }
                })
                if (accessEntryValidationError) {
                    throw new UpdateFailure(400, { error: accessEntryValidationError })
                }
                const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectConfig: objectCollection.config,
                    attrs,
                    row: { ...previousRow, ...normalizedPatchByColumn },
                    minimumAccessLevel: 'edit'
                })
                if (parentAccessValidationError) {
                    throw new UpdateFailure(400, { error: parentAccessValidationError })
                }
                const requiredWhenValidationError = validateRuntimeRequiredWhenRules({
                    config: objectCollection.config,
                    attrs,
                    row: { ...previousRow, ...normalizedPatchByColumn }
                })
                if (requiredWhenValidationError) {
                    throw new UpdateFailure(400, { error: requiredWhenValidationError })
                }
                const dateOrderValidationError = validateRuntimeDateOrderRules({
                    config: objectCollection.config,
                    attrs,
                    row: { ...previousRow, ...normalizedPatchByColumn }
                })
                if (dateOrderValidationError) {
                    throw new UpdateFailure(400, { error: dateOrderValidationError })
                }

                await dispatchRuntimeLifecycle({
                    manager: txManager,
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    componentIds: touchedComponentIds,
                    payload: {
                        eventName: 'beforeUpdate',
                        previousRow,
                        patch: data
                    }
                })

                await performBulkUpdate(txManager)

                const nextRow = await loadRuntimeRowById(txManager, dataTableIdent, rowId, runtimeRowCondition)
                afterUpdateLifecycleRequest = {
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    componentIds: touchedComponentIds,
                    payload: {
                        eventName: 'afterUpdate',
                        row: nextRow,
                        previousRow,
                        patch: data
                    }
                }
            })

            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterUpdateLifecycleRequest)
            return res.json({ status: 'ok' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }

    // ============ CREATE ROW ============
    const createRow = async (req: Request, res: Response) => {
        const { applicationId } = req.params

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'createContent')) return

        const parsedBody = runtimeCreateBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const { objectCollectionId: requestedObjectCollectionId, data } = parsedBody.data

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        // Build column→value pairs from input data
        const columnValues: Array<{ column: string; value: unknown }> = []
        const safeAttrs = attrs.filter(
            (a) => IDENTIFIER_REGEX.test(a.column_name) && RUNTIME_WRITABLE_TYPES.has(a.data_type) && a.data_type !== 'TABLE'
        )

        for (const cmp of safeAttrs) {
            const attrLabel = formatRuntimeFieldLabel(cmp.codename)
            const { hasUserValue, value: inputValue } = getRuntimeInputValue(data, cmp.column_name, cmp.codename)
            let raw = inputValue

            const isEnumRef = cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind)
            const enumMode = getEnumPresentationMode(cmp.ui_config)

            if (isEnumRef && enumMode === 'label' && hasUserValue) {
                return res.status(400).json({
                    error: `Field is read-only: ${attrLabel}`
                })
            }

            if (raw === undefined && isEnumRef && typeof cmp.target_object_id === 'string') {
                const defaultEnumValueId = getDefaultEnumValueId(cmp.ui_config)
                if (defaultEnumValueId) {
                    try {
                        await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, defaultEnumValueId, cmp.target_object_id)
                        raw = defaultEnumValueId
                    } catch (error) {
                        if (error instanceof Error && error.message === 'Enumeration value does not belong to target enumeration') {
                            raw = undefined
                        } else {
                            throw error
                        }
                    }
                }
            }

            const valueGroupFixedValueConfig =
                cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
            if (valueGroupFixedValueConfig) {
                const providedRefId = resolveRefId(raw)
                if (!providedRefId) {
                    raw = valueGroupFixedValueConfig.id
                } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                    return res.status(400).json({
                        error: `Field is read-only: ${attrLabel}`
                    })
                } else {
                    raw = valueGroupFixedValueConfig.id
                }
            }

            if (raw === undefined) {
                if (cmp.is_required && cmp.data_type !== 'BOOLEAN') {
                    return res.status(400).json({
                        error: `Required field missing: ${attrLabel}`
                    })
                }
                continue
            }
            try {
                const coerced = normalizeConfiguredRuntimeJsonValue(coerceRuntimeValue(raw, cmp.data_type, cmp.validation_rules), cmp)
                if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
                    return res.status(400).json({
                        error: `Required field cannot be set to null: ${attrLabel}`
                    })
                }

                if (isEnumRef && typeof cmp.target_object_id === 'string' && coerced) {
                    await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), cmp.target_object_id)
                }

                columnValues.push({
                    column: cmp.column_name,
                    value: coerced
                })
            } catch (e) {
                return res.status(400).json({
                    error: `Invalid value for ${attrLabel}: ${(e as Error).message}`
                })
            }
        }

        let pendingCreateRow = Object.fromEntries(columnValues.map(({ column, value }) => [column, value]))
        const accessEntryValidationError = await validateRuntimeAccessEntryMembership({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            currentWorkspaceId: ctx.currentWorkspaceId,
            currentUserId: ctx.userId,
            permissions: ctx.permissions,
            objectConfig: objectCollection.config,
            attrs,
            row: pendingCreateRow
        })
        if (accessEntryValidationError) {
            return res.status(400).json({ error: accessEntryValidationError })
        }
        const referenceValidationError = await validateRuntimeRecordPickerReferences({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            currentWorkspaceId: ctx.currentWorkspaceId,
            currentUserId: ctx.userId,
            permissions: ctx.permissions,
            attrs,
            row: pendingCreateRow
        })
        if (referenceValidationError) {
            return res.status(400).json({ error: referenceValidationError })
        }
        const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            currentWorkspaceId: ctx.currentWorkspaceId,
            currentUserId: ctx.userId,
            permissions: ctx.permissions,
            objectConfig: objectCollection.config,
            attrs,
            row: pendingCreateRow,
            minimumAccessLevel: 'edit'
        })
        if (parentAccessValidationError) {
            return res.status(400).json({ error: parentAccessValidationError })
        }
        const requiredWhenValidationError = validateRuntimeRequiredWhenRules({
            config: objectCollection.config,
            attrs,
            row: pendingCreateRow
        })
        if (requiredWhenValidationError) {
            return res.status(400).json({ error: requiredWhenValidationError })
        }
        const dateDerivationResult = applyRuntimeDateOffsetDerivations({
            config: objectCollection.config,
            attrs,
            row: pendingCreateRow
        })
        if (dateDerivationResult.error) {
            return res.status(400).json({ error: dateDerivationResult.error })
        }
        pendingCreateRow = dateDerivationResult.row
        const safeAttrColumnSet = new Set(safeAttrs.map((attr) => attr.column_name))
        for (const [column, value] of Object.entries(pendingCreateRow)) {
            if (!safeAttrColumnSet.has(column)) continue
            const existing = columnValues.find((item) => item.column === column)
            if (existing) {
                existing.value = value
            } else {
                columnValues.push({ column, value })
            }
        }
        const dateOrderValidationError = validateRuntimeDateOrderRules({
            config: objectCollection.config,
            attrs,
            row: pendingCreateRow
        })
        if (dateOrderValidationError) {
            return res.status(400).json({ error: dateOrderValidationError })
        }

        const { runtimeConfig } = await resolveEffectiveObjectCollectionRuntimeConfig({
            manager: ctx.manager,
            schemaName: ctx.schemaName,
            schemaIdent: ctx.schemaIdent,
            objectCollectionId: objectCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(
            safeAttrs,
            runtimeConfig.enableRowReordering ? runtimeConfig.reorderPersistenceField : null
        )
        if (reorderFieldAttr && !columnValues.some((item) => item.column === reorderFieldAttr.column_name)) {
            const nextSortValue = await getNextRuntimeSortValue({
                manager: ctx.manager,
                dataTableIdent,
                runtimeRowCondition,
                reorderColumnName: reorderFieldAttr.column_name
            })
            columnValues.push({
                column: reorderFieldAttr.column_name,
                value: nextSortValue
            })
        }

        const touchedComponentIds = collectTouchedComponentIds(attrs, data)
        const recordBehavior = normalizeRuntimeRecordBehavior(objectCollection.config)

        // Collect TABLE-type data from request body for child row insertion
        const tableAttrsForCreate = attrs.filter((a) => a.data_type === 'TABLE')
        const tableDataEntries: Array<{
            cmp: (typeof attrs)[number]
            rows: Array<Record<string, unknown>>
            tabTableName: string
            childAttrsByColumn: Map<string, RuntimeTableChildComponentMeta>
        }> = []
        for (const tAttr of tableAttrsForCreate) {
            const tableFieldPath = formatRuntimeFieldPath(tAttr.codename)
            const { value: raw } = getRuntimeInputValue(data, tAttr.column_name, tAttr.codename)
            if (raw !== undefined && raw !== null && !Array.isArray(raw)) {
                return res.status(400).json({
                    error: `Invalid value for ${tableFieldPath}: TABLE value must be an array`
                })
            }

            const childRows = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : []
            const rowCountError = getTableRowCountError(childRows.length, tableFieldPath, getTableRowLimits(tAttr.validation_rules))
            if (rowCountError) {
                return res.status(400).json({ error: rowCountError })
            }

            if (childRows.length > 0) {
                const fallbackTabTableName = generateChildTableName(tAttr.id)
                const tabTableName =
                    typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                        ? tAttr.column_name
                        : fallbackTabTableName
                if (!IDENTIFIER_REGEX.test(tabTableName)) {
                    return res.status(400).json({
                        error: `Invalid tabular table name for ${tableFieldPath}`
                    })
                }

                const childAttrsResult = (await ctx.manager.query(
                    `
            SELECT id, codename, column_name, data_type, is_required, validation_rules,
                   target_object_id, target_object_kind, ui_config
            FROM ${ctx.schemaIdent}._app_components
            WHERE parent_component_id = $1
              AND _upl_deleted = false
              AND _app_deleted = false
            ORDER BY sort_order ASC
          `,
                    [tAttr.id]
                )) as Array<{
                    id: string
                    codename: unknown
                    column_name: string
                    data_type: string
                    is_required: boolean
                    validation_rules?: Record<string, unknown>
                    target_object_id?: string | null
                    target_object_kind?: string | null
                    ui_config?: Record<string, unknown>
                }>

                const preparedRows: Array<Record<string, unknown>> = []

                for (let rowIdx = 0; rowIdx < childRows.length; rowIdx++) {
                    const rowData = childRows[rowIdx]
                    if (!rowData || typeof rowData !== 'object' || Array.isArray(rowData)) {
                        return res.status(400).json({
                            error: `Invalid row ${rowIdx + 1} for ${tableFieldPath}: row must be an object`
                        })
                    }

                    const preparedRow: Record<string, unknown> = {}
                    for (const cAttr of childAttrsResult) {
                        if (!IDENTIFIER_REGEX.test(cAttr.column_name)) continue
                        const childFieldPath = formatRuntimeFieldPath(tAttr.codename, cAttr.codename)
                        const isEnumRef = cAttr.data_type === 'REF' && isRuntimeEnumerationKind(cAttr.target_object_kind)
                        const { hasUserValue, value: childInputValue } = getRuntimeInputValue(rowData, cAttr.column_name, cAttr.codename)
                        let cRaw = childInputValue

                        if (isEnumRef && getEnumPresentationMode(cAttr.ui_config) === 'label' && hasUserValue) {
                            return res.status(400).json({
                                error: `Field is read-only: ${childFieldPath}`
                            })
                        }

                        if (cRaw === undefined && isEnumRef && typeof cAttr.target_object_id === 'string') {
                            const defaultEnumValueId = getDefaultEnumValueId(cAttr.ui_config)
                            if (defaultEnumValueId) {
                                try {
                                    await ensureEnumerationValueBelongsToTarget(
                                        ctx.manager,
                                        ctx.schemaIdent,
                                        defaultEnumValueId,
                                        cAttr.target_object_id
                                    )
                                    cRaw = defaultEnumValueId
                                } catch (error) {
                                    if (
                                        error instanceof Error &&
                                        error.message === 'Enumeration value does not belong to target enumeration'
                                    ) {
                                        cRaw = undefined
                                    } else {
                                        throw error
                                    }
                                }
                            }
                        }

                        const childSetConstantConfig =
                            cAttr.data_type === 'REF' && isRuntimeSetKind(cAttr.target_object_kind)
                                ? getSetConstantConfig(cAttr.ui_config)
                                : null
                        if (childSetConstantConfig) {
                            const providedRefId = resolveRefId(cRaw)
                            if (!providedRefId) {
                                cRaw = childSetConstantConfig.id
                            } else if (providedRefId !== childSetConstantConfig.id) {
                                return res.status(400).json({
                                    error: `Field is read-only: ${childFieldPath}`
                                })
                            } else {
                                cRaw = childSetConstantConfig.id
                            }
                        }

                        if (cRaw === undefined || cRaw === null) {
                            if (cAttr.is_required && cAttr.data_type !== 'BOOLEAN') {
                                return res.status(400).json({
                                    error: `Required field missing: ${childFieldPath}`
                                })
                            }
                            continue
                        }

                        try {
                            const cCoerced = normalizeConfiguredRuntimeJsonValue(
                                coerceRuntimeValue(cRaw, cAttr.data_type, cAttr.validation_rules),
                                cAttr
                            )
                            if (isEnumRef && typeof cAttr.target_object_id === 'string' && cCoerced) {
                                await ensureEnumerationValueBelongsToTarget(
                                    ctx.manager,
                                    ctx.schemaIdent,
                                    String(cCoerced),
                                    cAttr.target_object_id
                                )
                            }
                            preparedRow[cAttr.column_name] = normalizeRuntimeTableChildInsertValue(
                                cCoerced,
                                cAttr.data_type,
                                cAttr.validation_rules
                            )
                        } catch (err) {
                            return res.status(400).json({
                                error: `Invalid value for ${childFieldPath}: ${err instanceof Error ? err.message : String(err)}`
                            })
                        }
                    }

                    preparedRows.push(preparedRow)
                }

                tableDataEntries.push({
                    cmp: tAttr,
                    rows: preparedRows,
                    tabTableName,
                    childAttrsByColumn: new Map(
                        childAttrsResult.map((childAttr) => [
                            childAttr.column_name,
                            {
                                column_name: childAttr.column_name,
                                data_type: childAttr.data_type,
                                validation_rules: childAttr.validation_rules
                            }
                        ])
                    )
                })
            }
        }

        let afterCreateLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        const performCreate = async (mgr: DbExecutor): Promise<string> => {
            if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                const limitState = await enforceObjectWorkspaceLimit(mgr, {
                    schemaName: ctx.schemaName,
                    objectId: objectCollection.id,
                    tableName: objectCollection.table_name,
                    workspaceId: ctx.currentWorkspaceId,
                    runtimeRowCondition
                })

                if (!limitState.canCreate) {
                    throw new UpdateFailure(409, {
                        error: 'Workspace object row limit reached',
                        code: 'WORKSPACE_LIMIT_REACHED',
                        details: limitState
                    })
                }
            }

            await dispatchRuntimeLifecycle({
                manager: mgr,
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                componentIds: touchedComponentIds,
                payload: {
                    eventName: 'beforeCreate',
                    patch: data
                }
            })

            const createColumnValues = await recordCommandService.buildInitialCreateColumnValues({
                columnValues,
                behavior: recordBehavior,
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                objectId: objectCollection.id,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId
            })
            const transactionalCreateRow = Object.fromEntries(createColumnValues.map(({ column, value }) => [column, value]))
            const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                objectConfig: objectCollection.config,
                attrs,
                row: transactionalCreateRow,
                minimumAccessLevel: 'edit'
            })
            if (parentAccessValidationError) {
                throw new UpdateFailure(400, { error: parentAccessValidationError })
            }

            const colNames = createColumnValues.map((cv) => quoteIdentifier(cv.column))
            const placeholders = createColumnValues.map((_, i) => `$${i + 1}`)
            const insertValues = createColumnValues.map((cv) => cv.value)

            if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                colNames.push(quoteIdentifier('workspace_id'))
                placeholders.push(`$${insertValues.length + 1}`)
                insertValues.push(ctx.currentWorkspaceId)
            }

            if (ctx.userId) {
                colNames.push('_upl_created_by')
                placeholders.push(`$${insertValues.length + 1}`)
                insertValues.push(ctx.userId)
            }

            const insertSql =
                colNames.length > 0
                    ? `INSERT INTO ${dataTableIdent} (${colNames.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`
                    : `INSERT INTO ${dataTableIdent} DEFAULT VALUES RETURNING id`
            const [inserted] = (await mgr.query(insertSql, insertValues)) as Array<{ id: string }>
            const parentId = inserted.id

            for (const { rows: childRows, tabTableName, childAttrsByColumn } of tableDataEntries) {
                if (childRows.length === 0) continue
                const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

                const dataColSet = new Set<string>()
                for (const rd of childRows) {
                    for (const cn of Object.keys(rd)) {
                        if (IDENTIFIER_REGEX.test(cn)) dataColSet.add(cn)
                    }
                }
                const dataColumns = [...dataColSet]
                const headerCols: string[] = ['_tp_parent_id', '_tp_sort_order']
                if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                    headerCols.push(quoteIdentifier('workspace_id'))
                }
                if (ctx.userId) headerCols.push('_upl_created_by')
                const allColumns = [...headerCols, ...dataColumns.map((c) => quoteIdentifier(c))]
                const allValues: unknown[] = []
                const valueTuples: string[] = []
                let pIdx = 1

                for (let rowIdx = 0; rowIdx < childRows.length; rowIdx++) {
                    const rowData = childRows[rowIdx]
                    const ph: string[] = []
                    ph.push(`$${pIdx++}`)
                    allValues.push(parentId)
                    ph.push(`$${pIdx++}`)
                    allValues.push(rowIdx)
                    if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                        ph.push(`$${pIdx++}`)
                        allValues.push(ctx.currentWorkspaceId)
                    }
                    if (ctx.userId) {
                        ph.push(`$${pIdx++}`)
                        allValues.push(ctx.userId)
                    }
                    for (const cn of dataColumns) {
                        ph.push(`$${pIdx++}`)
                        allValues.push(normalizeRuntimeTableChildInsertValueByMeta(rowData[cn] ?? null, childAttrsByColumn.get(cn)))
                    }
                    valueTuples.push(`(${ph.join(', ')})`)
                }

                await mgr.query(`INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`, allValues)
            }

            const nextRow = await loadRuntimeRowById(mgr, dataTableIdent, parentId)
            afterCreateLifecycleRequest = {
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                componentIds: touchedComponentIds,
                payload: {
                    eventName: 'afterCreate',
                    row: nextRow,
                    patch: data
                }
            }

            return parentId
        }

        let parentId: string
        try {
            parentId = await ctx.manager.transaction(async (txManager) => {
                return performCreate(txManager)
            })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }
        dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterCreateLifecycleRequest)
        return res.status(201).json({ id: parentId, status: 'created' })
    }

    // ============ COPY ROW ============
    const copyRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const parsedBody = runtimeCopyBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'createContent')) return

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })

        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name))
        const nonTableAttrs = safeAttrs.filter((a) => a.data_type !== 'TABLE')
        const tableAttrsForCopy = safeAttrs.filter((a) => a.data_type === 'TABLE')

        const hasRequiredChildTables = tableAttrsForCopy.some((cmp) => {
            const { minRows } = getTableRowLimits(cmp.validation_rules)
            return Boolean(cmp.is_required) || (minRows !== null && minRows > 0)
        })
        const copyChildTables = hasRequiredChildTables ? true : parsedBody.data.copyChildTables !== false
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const { runtimeConfig } = await resolveEffectiveObjectCollectionRuntimeConfig({
            manager: ctx.manager,
            schemaName: ctx.schemaName,
            schemaIdent: ctx.schemaIdent,
            objectCollectionId: objectCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(
            nonTableAttrs,
            runtimeConfig.enableRowReordering ? runtimeConfig.reorderPersistenceField : null
        )
        const copyRelationsConfig = readRuntimeCopyRelations(objectCollection.config)
        if (copyRelationsConfig?.invalid) {
            return res.status(409).json({
                error: 'Runtime copy relations are not configured',
                code: 'RUNTIME_COPY_RELATION_INVALID'
            })
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const sourceReadValues: unknown[] = [rowId]
        const sourceReadAccessClause = await buildRuntimeRecordAccessClause({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            currentWorkspaceId: ctx.currentWorkspaceId,
            currentUserId: ctx.userId,
            permissions: ctx.permissions,
            objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
            attrs,
            config: objectCollection.config,
            outerRowIdSql: `${dataTableIdent}.id`,
            values: sourceReadValues,
            minimumAccessLevel: 'edit'
        })
        const sourceReadWhereSql = ['id = $1', runtimeRowCondition, sourceReadAccessClause]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .join(' AND ')
        const sourceRows = (await ctx.manager.query(
            `
        SELECT *
        FROM ${dataTableIdent}
        WHERE ${sourceReadWhereSql}
      `,
            sourceReadValues
        )) as Array<Record<string, unknown>>

        if (sourceRows.length === 0) return res.status(404).json({ error: 'Row not found' })
        if (sourceRows[0]._upl_locked) return res.status(423).json({ error: 'Record is locked' })
        const sourceRow = sourceRows[0]
        if (parsedBody.data.expectedVersion !== undefined) {
            const actualVersion = Number(sourceRow._upl_version ?? 1)
            if (actualVersion !== parsedBody.data.expectedVersion) {
                return res.status(409).json({
                    error: 'Version mismatch',
                    expectedVersion: parsedBody.data.expectedVersion,
                    actualVersion
                })
            }
        }
        try {
            assertRuntimeRecordMutable(objectCollection.config, sourceRow)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }

        const copyOverrideValues = new Map<string, unknown>()
        const copyOverrideData = parsedBody.data.data ?? {}
        for (const cmp of tableAttrsForCopy) {
            const { hasUserValue, value } = getRuntimeInputValue(copyOverrideData, cmp.column_name, cmp.codename)
            const isEmptyTableOverride = Array.isArray(value) && value.length === 0
            if (hasUserValue && !isEmptyTableOverride) {
                return res.status(400).json({
                    error: `TABLE overrides are not supported during copy: ${formatRuntimeFieldLabel(cmp.codename)}`
                })
            }
        }
        if (Object.keys(copyOverrideData).length > 0) {
            for (const cmp of nonTableAttrs) {
                const attrLabel = formatRuntimeFieldLabel(cmp.codename)
                const { hasUserValue, value: inputValue } = getRuntimeInputValue(copyOverrideData, cmp.column_name, cmp.codename)
                if (!hasUserValue) continue

                let raw = inputValue
                const isEnumRef = cmp.data_type === 'REF' && isRuntimeEnumerationKind(cmp.target_object_kind)

                if (isEnumRef && getEnumPresentationMode(cmp.ui_config) === 'label') {
                    return res.status(400).json({
                        error: `Field is read-only: ${attrLabel}`
                    })
                }

                const valueGroupFixedValueConfig =
                    cmp.data_type === 'REF' && isRuntimeSetKind(cmp.target_object_kind) ? getSetConstantConfig(cmp.ui_config) : null
                if (valueGroupFixedValueConfig) {
                    const providedRefId = resolveRefId(raw)
                    if (!providedRefId) {
                        raw = valueGroupFixedValueConfig.id
                    } else if (providedRefId !== valueGroupFixedValueConfig.id) {
                        return res.status(400).json({
                            error: `Field is read-only: ${attrLabel}`
                        })
                    } else {
                        raw = valueGroupFixedValueConfig.id
                    }
                }

                try {
                    const coerced = normalizeConfiguredRuntimeJsonValue(coerceRuntimeValue(raw, cmp.data_type, cmp.validation_rules), cmp)
                    if (cmp.is_required && cmp.data_type !== 'BOOLEAN' && coerced === null) {
                        return res.status(400).json({
                            error: `Required field cannot be set to null: ${attrLabel}`
                        })
                    }

                    if (isEnumRef && typeof cmp.target_object_id === 'string' && coerced) {
                        await ensureEnumerationValueBelongsToTarget(ctx.manager, ctx.schemaIdent, String(coerced), cmp.target_object_id)
                    }

                    copyOverrideValues.set(cmp.column_name, coerced)
                } catch (error) {
                    return res.status(400).json({
                        error: `Invalid value for ${attrLabel}: ${(error as Error).message}`
                    })
                }
            }
        }

        const insertColumns = nonTableAttrs.map((cmp) => quoteIdentifier(cmp.column_name))
        if (ctx.workspacesEnabled && ctx.currentWorkspaceId) insertColumns.push(quoteIdentifier('workspace_id'))
        if (ctx.userId) insertColumns.push('_upl_created_by')

        const buildPendingCopyState = async (mgr: DbExecutor, currentSourceRow: Record<string, unknown>) => {
            let pendingCopyRow: Record<string, unknown> = Object.fromEntries(
                nonTableAttrs.map((cmp) => [cmp.column_name, currentSourceRow[cmp.column_name] ?? null])
            )
            const effectiveCopyValues = new Map(copyOverrideValues)
            for (const [column, value] of effectiveCopyValues) {
                pendingCopyRow[column] = value
            }

            const dateDerivationResult = applyRuntimeDateOffsetDerivations({
                config: objectCollection.config,
                attrs,
                row: pendingCopyRow
            })
            if (dateDerivationResult.error) {
                throw new UpdateFailure(400, { error: dateDerivationResult.error })
            }
            pendingCopyRow = dateDerivationResult.row
            for (const [column, value] of Object.entries(pendingCopyRow)) {
                if (nonTableAttrs.some((cmp) => cmp.column_name === column)) {
                    effectiveCopyValues.set(column, value)
                }
            }

            const accessEntryValidationError = await validateRuntimeAccessEntryMembership({
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                objectConfig: objectCollection.config,
                attrs,
                row: pendingCopyRow
            })
            if (accessEntryValidationError) {
                throw new UpdateFailure(400, { error: accessEntryValidationError })
            }
            const referenceValidationError = await validateRuntimeRecordPickerReferences({
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                attrs,
                row: pendingCopyRow
            })
            if (referenceValidationError) {
                throw new UpdateFailure(400, { error: referenceValidationError })
            }
            const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                objectConfig: objectCollection.config,
                attrs,
                row: pendingCopyRow,
                minimumAccessLevel: 'edit'
            })
            if (parentAccessValidationError) {
                throw new UpdateFailure(400, { error: parentAccessValidationError })
            }
            const requiredWhenValidationError = validateRuntimeRequiredWhenRules({
                config: objectCollection.config,
                attrs,
                row: pendingCopyRow
            })
            if (requiredWhenValidationError) {
                throw new UpdateFailure(400, { error: requiredWhenValidationError })
            }
            const dateOrderValidationError = validateRuntimeDateOrderRules({
                config: objectCollection.config,
                attrs,
                row: pendingCopyRow
            })
            if (dateOrderValidationError) {
                throw new UpdateFailure(400, { error: dateOrderValidationError })
            }

            return effectiveCopyValues
        }

        try {
            await buildPendingCopyState(ctx.manager, sourceRow)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }

        let afterCopyLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        const performCopy = async (mgr: DbExecutor) => {
            const transactionalSourceValues: unknown[] = [rowId]
            const transactionalSourceAccessClause = await buildRuntimeRecordAccessClause({
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                attrs,
                config: objectCollection.config,
                outerRowIdSql: `${dataTableIdent}.id`,
                values: transactionalSourceValues,
                minimumAccessLevel: 'edit'
            })
            const transactionalSourceWhereSql = ['id = $1', runtimeRowCondition, transactionalSourceAccessClause]
                .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                .join(' AND ')
            const sourceRowsForCopy = (await mgr.query(
                `
          SELECT *
          FROM ${dataTableIdent}
          WHERE ${transactionalSourceWhereSql}
          FOR UPDATE
          LIMIT 1
        `,
                transactionalSourceValues
            )) as Array<Record<string, unknown>>
            const transactionalSourceRow = sourceRowsForCopy[0]
            if (!transactionalSourceRow?.id) {
                throw new UpdateFailure(404, { error: 'Row not found' })
            }
            if (transactionalSourceRow._upl_locked) {
                throw new UpdateFailure(423, { error: 'Record is locked' })
            }
            if (parsedBody.data.expectedVersion !== undefined) {
                const actualVersion = Number(transactionalSourceRow._upl_version ?? 1)
                if (actualVersion !== parsedBody.data.expectedVersion) {
                    throw new UpdateFailure(409, {
                        error: 'Version mismatch',
                        expectedVersion: parsedBody.data.expectedVersion,
                        actualVersion
                    })
                }
            }
            assertRuntimeRecordMutable(objectCollection.config, transactionalSourceRow)
            const effectiveCopyValues = await buildPendingCopyState(mgr, transactionalSourceRow)

            if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                const limitState = await enforceObjectWorkspaceLimit(mgr, {
                    schemaName: ctx.schemaName,
                    objectId: objectCollection.id,
                    tableName: objectCollection.table_name,
                    workspaceId: ctx.currentWorkspaceId,
                    runtimeRowCondition
                })

                if (!limitState.canCreate) {
                    throw new UpdateFailure(409, {
                        error: 'Workspace object row limit reached',
                        code: 'WORKSPACE_LIMIT_REACHED',
                        details: limitState
                    })
                }
            }

            await dispatchRuntimeLifecycle({
                manager: mgr,
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                payload: {
                    eventName: 'beforeCopy',
                    previousRow: transactionalSourceRow,
                    metadata: {
                        copyChildTables
                    }
                }
            })

            const insertValuesArr = nonTableAttrs.map((cmp) =>
                reorderFieldAttr?.column_name === cmp.column_name
                    ? null
                    : effectiveCopyValues.has(cmp.column_name)
                    ? effectiveCopyValues.get(cmp.column_name) ?? null
                    : transactionalSourceRow[cmp.column_name] ?? null
            )
            if (ctx.workspacesEnabled && ctx.currentWorkspaceId) insertValuesArr.push(ctx.currentWorkspaceId)
            if (ctx.userId) insertValuesArr.push(ctx.userId)
            const placeholders = insertValuesArr.map((_, index) => `$${index + 1}`)

            if (reorderFieldAttr) {
                const reorderFieldIndex = nonTableAttrs.findIndex((cmp) => cmp.column_name === reorderFieldAttr.column_name)
                if (reorderFieldIndex >= 0) {
                    insertValuesArr[reorderFieldIndex] = await getNextRuntimeSortValue({
                        manager: mgr,
                        dataTableIdent,
                        runtimeRowCondition,
                        reorderColumnName: reorderFieldAttr.column_name
                    })
                }
            }

            const [insertedParent] = (await mgr.query(
                `INSERT INTO ${dataTableIdent} (${insertColumns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
                insertValuesArr
            )) as Array<{ id: string }>

            if (copyChildTables) {
                for (const tableAttr of tableAttrsForCopy) {
                    const { minRows } = getTableRowLimits(tableAttr.validation_rules)
                    const fallbackTabTableName = generateChildTableName(tableAttr.id)
                    const tabTableName =
                        typeof tableAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tableAttr.column_name)
                            ? tableAttr.column_name
                            : fallbackTabTableName
                    if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                    const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`

                    const childAttrs = (await mgr.query(
                        `
              SELECT codename, column_name, data_type, validation_rules
              FROM ${ctx.schemaIdent}._app_components
              WHERE parent_component_id = $1
                AND _upl_deleted = false
                AND _app_deleted = false
              ORDER BY sort_order ASC, _upl_created_at ASC NULLS LAST
            `,
                        [tableAttr.id]
                    )) as Array<{
                        codename: string
                        column_name: string
                        data_type?: string | null
                        validation_rules?: Record<string, unknown>
                    }>

                    const validChildColumns = childAttrs.map((cmp) => cmp.column_name).filter((column) => IDENTIFIER_REGEX.test(column))
                    const childAttrsByColumn = new Map(childAttrs.map((cmp) => [cmp.column_name, cmp]))
                    const sourceChildRows = (await mgr.query(
                        `
              SELECT ${validChildColumns.length > 0 ? validChildColumns.map((column) => quoteIdentifier(column)).join(', ') + ',' : ''}
                     _tp_sort_order
              FROM ${tabTableIdent}
              WHERE _tp_parent_id = $1
                AND ${runtimeRowCondition}
              ORDER BY _tp_sort_order ASC, _upl_created_at ASC NULLS LAST
            `,
                        [rowId]
                    )) as Array<Record<string, unknown>>

                    if (minRows !== null && sourceChildRows.length < minRows) {
                        throw new UpdateFailure(400, {
                            error: `TABLE ${tableAttr.codename} requires at least ${minRows} row(s)`
                        })
                    }

                    if (sourceChildRows.length === 0) continue

                    const headerColumns = [
                        '_tp_parent_id',
                        '_tp_sort_order',
                        ...(ctx.workspacesEnabled && ctx.currentWorkspaceId ? [quoteIdentifier('workspace_id')] : []),
                        ...(ctx.userId ? ['_upl_created_by'] : [])
                    ]
                    const allColumns = [...headerColumns, ...validChildColumns.map((column) => quoteIdentifier(column))]
                    const copyValues: unknown[] = []
                    const valueTuples: string[] = []
                    let copyParamIndex = 1
                    for (let index = 0; index < sourceChildRows.length; index++) {
                        const sourceChild = sourceChildRows[index]
                        const tuple: string[] = []
                        tuple.push(`$${copyParamIndex++}`)
                        copyValues.push(insertedParent.id)
                        tuple.push(`$${copyParamIndex++}`)
                        copyValues.push(index)
                        if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                            tuple.push(`$${copyParamIndex++}`)
                            copyValues.push(ctx.currentWorkspaceId)
                        }
                        if (ctx.userId) {
                            tuple.push(`$${copyParamIndex++}`)
                            copyValues.push(ctx.userId)
                        }
                        for (const column of validChildColumns) {
                            tuple.push(`$${copyParamIndex++}`)
                            copyValues.push(
                                normalizeRuntimeTableChildInsertValueByMeta(sourceChild[column] ?? null, childAttrsByColumn.get(column))
                            )
                        }
                        valueTuples.push(`(${tuple.join(', ')})`)
                    }
                    await mgr.query(`INSERT INTO ${tabTableIdent} (${allColumns.join(', ')}) VALUES ${valueTuples.join(', ')}`, copyValues)
                }
            }

            if (copyRelationsConfig && copyRelationsConfig.relations.length > 0) {
                await copyRuntimeConfiguredRelations({
                    manager: mgr,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    workspacesEnabled: ctx.workspacesEnabled,
                    userId: ctx.userId,
                    sourceParentId: rowId,
                    copiedParentId: insertedParent.id,
                    relations: copyRelationsConfig.relations
                })
            }

            const nextRow = await loadRuntimeRowById(mgr, dataTableIdent, insertedParent.id)
            afterCopyLifecycleRequest = {
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                payload: {
                    eventName: 'afterCopy',
                    row: nextRow,
                    previousRow: transactionalSourceRow,
                    metadata: {
                        copyChildTables
                    }
                }
            }

            return insertedParent.id
        }

        try {
            const copiedId = await ctx.manager.transaction((tx) => performCopy(tx))
            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterCopyLifecycleRequest)
            return res.status(201).json({
                id: copiedId,
                status: 'created',
                copyOptions: { copyChildTables },
                hasRequiredChildTables
            })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }
    }

    const runRecordStateCommand = async (req: Request, res: Response, command: 'post' | 'unpost' | 'void') => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const parsedBody = runtimeRecordCommandBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ctx.userId) return res.status(401).json({ error: 'Current user is required' })
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })

        const behavior = normalizeRuntimeRecordBehavior(objectCollection.config)
        if (!isRuntimeRecordBehaviorEnabled(behavior) || behavior.posting.mode === 'disabled') {
            return res.status(409).json({ error: 'Record posting is disabled for this record collection', code: 'POSTING_DISABLED' })
        }

        const registrarKind = typeof objectCollection.kind === 'string' ? objectCollection.kind.trim() : ''
        if (!registrarKind) {
            return res.status(409).json({
                error: 'Record posting registrar kind is not available',
                code: 'POSTING_REGISTRAR_KIND_UNAVAILABLE'
            })
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )

        const eventPrefix = resolveRecordCommandEventPrefix(command)
        let afterLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null
        let responsePayload: Record<string, unknown> | null = null

        try {
            await ctx.manager.transaction(async (txManager) => {
                const commandAccessValues: unknown[] = [rowId]
                const commandAccessClause = await buildRuntimeRecordAccessClause({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: commandAccessValues,
                    minimumAccessLevel: 'edit'
                })
                const commandWhereSql = ['id = $1', runtimeRowCondition, commandAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const rows = (await txManager.query(
                    `
            SELECT *
            FROM ${dataTableIdent}
            WHERE ${commandWhereSql}
            FOR UPDATE
            LIMIT 1
          `,
                    commandAccessValues
                )) as Array<Record<string, unknown>>
                const previousRow = rows[0]
                if (!previousRow?.id) {
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }
                if (previousRow._upl_locked) {
                    throw new UpdateFailure(423, { error: 'Record is locked' })
                }
                if (
                    parsedBody.data.expectedVersion !== undefined &&
                    Number(previousRow._upl_version ?? 1) !== parsedBody.data.expectedVersion
                ) {
                    throw new UpdateFailure(409, {
                        error: 'Version mismatch',
                        expectedVersion: parsedBody.data.expectedVersion,
                        actualVersion: Number(previousRow._upl_version ?? 1)
                    })
                }

                recordCommandService.assertCommandAllowed(command, previousRow)

                const beforeLifecycleResults =
                    (await dispatchRuntimeLifecycle({
                        manager: txManager,
                        applicationId,
                        schemaName: ctx.schemaName,
                        objectCollection,
                        currentWorkspaceId: ctx.currentWorkspaceId,
                        currentUserId: ctx.userId,
                        permissions: ctx.permissions,
                        payload: {
                            eventName: `before${eventPrefix}` as 'beforePost' | 'beforeUnpost' | 'beforeVoid',
                            previousRow,
                            metadata: { command }
                        }
                    })) ?? []

                const movementResult = await runPostingMovementWrites({
                    command,
                    executor: txManager,
                    schemaName: ctx.schemaName,
                    registrarKind,
                    behavior,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    beforeLifecycleResults,
                    storedMovements: previousRow._app_posting_movements
                })

                const { setClauses, values } = await recordCommandService.buildUpdate({
                    command,
                    previousRow,
                    behavior,
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    objectId: objectCollection.id,
                    rowId,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId
                })

                if (command === 'post') {
                    values.push(JSON.stringify(movementResult.postingMovements))
                    setClauses.push(`_app_posting_movements = $${values.length}::jsonb`)
                } else {
                    setClauses.push('_app_posting_movements = NULL')
                }

                const updateAccessClause = await buildRuntimeRecordAccessClause({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values,
                    minimumAccessLevel: 'edit'
                })
                const updateWhereSql = ['id = $1', runtimeRowCondition, 'COALESCE(_upl_locked, false) = false', updateAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const updatedRows = (await txManager.query(
                    `
            UPDATE ${dataTableIdent}
            SET ${setClauses.join(', ')}
            WHERE ${updateWhereSql}
            RETURNING *
          `,
                    values
                )) as Array<Record<string, unknown>>

                const nextRow = updatedRows[0]
                if (!nextRow?.id) {
                    throw new UpdateFailure(404, { error: 'Row not found' })
                }

                nextRow._app_posting_movements = movementResult.postingMovements
                nextRow._app_posting_reversals = movementResult.postingReversals

                afterLifecycleRequest = {
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    payload: {
                        eventName: `after${eventPrefix}` as 'afterPost' | 'afterUnpost' | 'afterVoid',
                        row: nextRow,
                        previousRow,
                        metadata: { command }
                    }
                }
                responsePayload = buildRecordCommandResponse(command, nextRow, movementResult)
            })
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }

        dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterLifecycleRequest)
        return res.json(responsePayload ?? { id: rowId, status: command })
    }

    const postRow = async (req: Request, res: Response) => runRecordStateCommand(req, res, 'post')
    const unpostRow = async (req: Request, res: Response) => runRecordStateCommand(req, res, 'unpost')
    const voidRow = async (req: Request, res: Response) => runRecordStateCommand(req, res, 'void')

    const runWorkflowAction = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const parsedActionCodename = runtimeWorkflowActionParamSchema.safeParse(req.params.actionCodename)
        if (!parsedActionCodename.success) {
            return res.status(400).json({ error: 'Invalid workflow action codename' })
        }

        const parsedBody = runtimeWorkflowActionBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ctx.userId) return res.status(401).json({ error: 'Current user is required' })

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })

        const action = readConfiguredWorkflowActions(objectCollection.config).find(
            (candidate) => candidate.codename === parsedActionCodename.data
        )
        if (!action) {
            return res.status(404).json({
                error: 'Workflow action is not configured for this record collection',
                code: 'WORKFLOW_ACTION_NOT_CONFIGURED'
            })
        }
        const statusColumnName = resolveWorkflowStatusColumnName(action, attrs)
        if (!statusColumnName) {
            return res.status(400).json({
                error: 'Workflow action status field is not configured for this record collection',
                code: 'WORKFLOW_STATUS_FIELD_NOT_CONFIGURED'
            })
        }
        const statusAttr = attrs.find((attr) => attr.column_name === statusColumnName)

        try {
            const result = await ctx.manager.transaction(async (txManager) => {
                const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
                const runtimeRowCondition = buildRuntimeActiveRowCondition(
                    objectCollection.lifecycleContract,
                    objectCollection.config,
                    undefined,
                    ctx.currentWorkspaceId
                )
                const accessibleRow = await loadRuntimeRowByIdWithRecordAccess({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    dataTableIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                    attrs,
                    config: objectCollection.config,
                    rowId,
                    rowCondition: runtimeRowCondition,
                    minimumAccessLevel: 'edit'
                })
                if (!accessibleRow?.id) {
                    throw new UpdateFailure(404, { error: 'Workflow action row not found', code: 'WORKFLOW_ROW_NOT_FOUND' })
                }

                const statusValueMap = await buildWorkflowEnumStatusValueMap(txManager, ctx.schemaIdent, statusAttr)
                ensureWorkflowEnumStatusesConfigured(action, statusValueMap)

                return applyWorkflowAction({
                    executor: txManager,
                    schemaName: ctx.schemaName,
                    tableName: objectCollection.table_name,
                    objectId: objectCollection.id,
                    rowId,
                    action,
                    capabilities: ctx.workflowCapabilities,
                    userId: ctx.userId,
                    statusColumnName,
                    statusValueMap,
                    expectedVersion: parsedBody.data.expectedVersion,
                    workspaceId: ctx.currentWorkspaceId,
                    hasWorkspaceColumn: ctx.workspacesEnabled,
                    auditMetadata: {
                        source: 'runtime.rows.workflowAction',
                        applicationId
                    }
                })
            })

            return res.json(result)
        } catch (error) {
            if (error instanceof UpdateFailure) {
                return res.status(error.statusCode).json(error.body)
            }
            throw error
        }
    }

    // ============ GET SINGLE ROW (raw for edit) ============
    const getRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })
        const objectCollectionId = typeof req.query.objectCollectionId === 'string' ? req.query.objectCollectionId : undefined
        if (objectCollectionId && !UUID_REGEX.test(objectCollectionId)) return res.status(400).json({ error: 'Invalid object ID format' })
        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`

        const rowValues: unknown[] = [rowId]
        const recordAccessClause = await buildRuntimeRecordAccessClause({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            currentWorkspaceId: ctx.currentWorkspaceId,
            currentUserId: ctx.userId,
            permissions: ctx.permissions,
            objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
            attrs,
            config: objectCollection.config,
            outerRowIdSql: `${dataTableIdent}.id`,
            values: rowValues
        })
        const safeAttrs = attrs.filter((a) => IDENTIFIER_REGEX.test(a.column_name) && a.data_type !== 'TABLE')
        const selectColumns = ['id', ...safeAttrs.map((a) => quoteIdentifier(a.column_name)), quoteIdentifier('_upl_version')]
        const whereSql = ['id = $1', runtimeRowCondition, recordAccessClause]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .join(' AND ')

        const rows = (await ctx.manager.query(
            `
        SELECT ${selectColumns.join(', ')}
        FROM ${dataTableIdent}
        WHERE ${whereSql}
      `,
            rowValues
        )) as Array<Record<string, unknown>>

        if (rows.length === 0) return res.status(404).json({ error: 'Row not found' })

        const row = rows[0]
        const rawData: Record<string, unknown> = {}
        for (const cmp of safeAttrs) {
            const raw = row[cmp.column_name] ?? null
            rawData[cmp.column_name] = cmp.data_type === 'NUMBER' && raw !== null ? pgNumericToNumber(raw) : raw
        }

        return res.json({ id: String(row.id), version: Number(row._upl_version ?? 1), data: rawData })
    }

    // ============ DELETE ROW (soft) ============
    const deleteRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })
        const objectCollectionId = typeof req.query.objectCollectionId === 'string' ? req.query.objectCollectionId : undefined
        if (objectCollectionId && !UUID_REGEX.test(objectCollectionId)) return res.status(400).json({ error: 'Invalid object ID format' })
        const expectedVersion =
            typeof req.query.expectedVersion === 'string' && req.query.expectedVersion.trim().length > 0
                ? Number(req.query.expectedVersion)
                : undefined
        if (expectedVersion !== undefined && (!Number.isInteger(expectedVersion) || expectedVersion <= 0)) {
            return res.status(400).json({ error: 'Invalid expected version' })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'deleteContent')) return

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeDeleteSetClause = isSoftDeleteLifecycle(objectCollection.lifecycleContract)
            ? buildRuntimeSoftDeleteSetClause('$1', objectCollection.lifecycleContract, objectCollection.config)
            : null

        const tableAttrsForDelete = attrs.filter((a) => a.data_type === 'TABLE')

        let afterDeleteLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        const performDelete = async (mgr: DbExecutor) => {
            const sourceValues: unknown[] = [rowId]
            const sourceAccessClause = await buildRuntimeRecordAccessClause({
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                attrs,
                config: objectCollection.config,
                outerRowIdSql: `${dataTableIdent}.id`,
                values: sourceValues,
                minimumAccessLevel: 'edit'
            })
            const sourceWhereSql = ['id = $1', runtimeRowCondition, sourceAccessClause]
                .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                .join(' AND ')
            const sourceRows = (await mgr.query(
                `
              SELECT *
              FROM ${dataTableIdent}
              WHERE ${sourceWhereSql}
              LIMIT 1
            `,
                sourceValues
            )) as Array<Record<string, unknown>>
            const sourceRow = sourceRows[0]
            if (!sourceRow || !sourceRow.id) {
                throw new UpdateFailure(404, {
                    error: 'Row not found'
                })
            }
            if (sourceRow._upl_locked) {
                throw new UpdateFailure(423, {
                    error: 'Record is locked'
                })
            }
            if (expectedVersion !== undefined) {
                const actualVersion = Number(sourceRow._upl_version ?? 1)
                if (actualVersion !== expectedVersion) {
                    throw createRuntimeVersionConflictFailure(expectedVersion, actualVersion)
                }
            }
            assertRuntimeRecordMutable(objectCollection.config, sourceRow)

            await dispatchRuntimeLifecycle({
                manager: mgr,
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                payload: {
                    eventName: 'beforeDelete',
                    previousRow: sourceRow
                }
            })

            const deleteParams: unknown[] = runtimeDeleteSetClause ? [ctx.userId, rowId] : [rowId]
            const deleteRowIdPlaceholder = runtimeDeleteSetClause ? '$2' : '$1'
            const deleteAccessClause = await buildRuntimeRecordAccessClause({
                manager: mgr,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                attrs,
                config: objectCollection.config,
                outerRowIdSql: `${dataTableIdent}.id`,
                values: deleteParams,
                minimumAccessLevel: 'edit'
            })
            if (expectedVersion !== undefined) {
                deleteParams.push(expectedVersion)
            }
            const deleteExpectedVersionPredicate = buildRuntimeExpectedVersionPredicate(expectedVersion, deleteParams.length)
            const deleteWhereSql = [
                `id = ${deleteRowIdPlaceholder}`,
                runtimeRowCondition,
                'COALESCE(_upl_locked, false) = false',
                deleteAccessClause
            ]
                .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                .join(' AND ')
            const deleted = runtimeDeleteSetClause
                ? ((await mgr.query(
                      `
              UPDATE ${dataTableIdent}
              SET ${runtimeDeleteSetClause},
                  _upl_version = COALESCE(_upl_version, 1) + 1
              WHERE ${deleteWhereSql}
                ${deleteExpectedVersionPredicate}
              RETURNING id
            `,
                      deleteParams
                  )) as Array<{ id: string }>)
                : ((await mgr.query(
                      `
              DELETE FROM ${dataTableIdent}
              WHERE ${deleteWhereSql}
                ${deleteExpectedVersionPredicate}
              RETURNING id
            `,
                      deleteParams
                  )) as Array<{ id: string }>)

            if (deleted.length === 0) {
                if (expectedVersion !== undefined) {
                    throw createRuntimeVersionConflictFailure(expectedVersion)
                }
                throw new UpdateFailure(404, {
                    error: 'Row not found'
                })
            }

            if (runtimeDeleteSetClause) {
                // Soft-delete child rows in TABLE child tables
                for (const tAttr of tableAttrsForDelete) {
                    const fallbackTabTableName = generateChildTableName(tAttr.id)
                    const tabTableName =
                        typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                            ? tAttr.column_name
                            : fallbackTabTableName
                    if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                    const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`
                    await mgr.query(
                        `
              UPDATE ${tabTableIdent}
              SET ${runtimeDeleteSetClause},
                  _upl_version = COALESCE(_upl_version, 1) + 1
              WHERE _tp_parent_id = $2
                AND ${runtimeRowCondition}
            `,
                        [ctx.userId, rowId]
                    )
                }
            }

            const nextRow = runtimeDeleteSetClause ? await loadRuntimeRowById(mgr, dataTableIdent, rowId, runtimeRowCondition) : null
            afterDeleteLifecycleRequest = {
                applicationId,
                schemaName: ctx.schemaName,
                objectCollection,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                payload: {
                    eventName: 'afterDelete',
                    row: nextRow,
                    previousRow: sourceRow
                }
            }
        }

        try {
            await ctx.manager.transaction(async (txManager) => {
                await performDelete(txManager)
            })
            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterDeleteLifecycleRequest)
            return res.json({ status: 'deleted' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }

    // ============ RESTORE ROW (soft-delete reversal) ============
    const restoreRow = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        if (!UUID_REGEX.test(rowId)) return res.status(400).json({ error: 'Invalid row ID format' })

        const parsedBody = runtimeRestoreBodySchema.safeParse(req.body ?? {})
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.objectCollectionId)
        if (!objectCollection) return res.status(404).json({ error: objectCollectionError })
        if (!isSoftDeleteLifecycle(objectCollection.lifecycleContract)) {
            return res.status(409).json({
                error: 'Restore is not available for hard-delete runtime objects',
                code: 'RUNTIME_RECORD_RESTORE_UNSUPPORTED'
            })
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const deletedRowCondition = buildRuntimeDeletedRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const activeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )
        const runtimeRestoreSetClause = buildRuntimeRestoreSetClause('$1', objectCollection.lifecycleContract, objectCollection.config)
        const tableAttrsForRestore = attrs.filter((a) => a.data_type === 'TABLE')
        let afterRestoreLifecycleRequest: RuntimeLifecycleDispatchRequest | null = null

        try {
            await ctx.manager.transaction(async (txManager) => {
                const sourceValues: unknown[] = [rowId]
                const sourceAccessClause = await buildRuntimeRecordAccessClause({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: sourceValues,
                    minimumAccessLevel: 'edit'
                })
                const sourceWhereSql = ['id = $1', deletedRowCondition, sourceAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const sourceRows = (await txManager.query(
                    `
              SELECT *
              FROM ${dataTableIdent}
              WHERE ${sourceWhereSql}
              LIMIT 1
            `,
                    sourceValues
                )) as Array<Record<string, unknown>>
                const sourceRow = sourceRows[0]
                if (!sourceRow || !sourceRow.id) {
                    throw new UpdateFailure(404, {
                        error: 'Deleted row not found',
                        code: 'RUNTIME_RECORD_RESTORE_NOT_FOUND'
                    })
                }
                if (sourceRow._upl_locked) {
                    throw new UpdateFailure(423, {
                        error: 'Record is locked'
                    })
                }
                if (parsedBody.data.expectedVersion !== undefined) {
                    const actualVersion = Number(sourceRow._upl_version ?? 1)
                    if (actualVersion !== parsedBody.data.expectedVersion) {
                        throw createRuntimeVersionConflictFailure(parsedBody.data.expectedVersion, actualVersion)
                    }
                }
                assertRuntimeRecordMutable(objectCollection.config, sourceRow)

                const restoreTarget = parsedBody.data.restoreTarget
                let restoreTargetSetClause = ''
                const restoreParams: unknown[] = [ctx.userId, rowId]
                let expectedVersionParamIndex = 0
                if (parsedBody.data.expectedVersion !== undefined) {
                    restoreParams.push(parsedBody.data.expectedVersion)
                    expectedVersionParamIndex = restoreParams.length
                }

                if (restoreTarget?.mode === 'target') {
                    if (
                        ctx.currentWorkspaceId &&
                        restoreTarget.targetWorkspaceId &&
                        restoreTarget.targetWorkspaceId !== ctx.currentWorkspaceId
                    ) {
                        throw new UpdateFailure(403, {
                            error: 'Restore target belongs to a different workspace',
                            code: 'RUNTIME_RESTORE_TARGET_WORKSPACE_DENIED'
                        })
                    }

                    const targetCollectionResult = await resolveRuntimeObjectCollection(
                        txManager,
                        ctx.schemaIdent,
                        restoreTarget.targetObjectCollectionId
                    )
                    if (
                        !targetCollectionResult.objectCollection ||
                        targetCollectionResult.objectCollection.id !== restoreTarget.targetObjectCollectionId
                    ) {
                        throw new UpdateFailure(404, {
                            error: targetCollectionResult.error,
                            code: 'RUNTIME_RESTORE_TARGET_NOT_FOUND'
                        })
                    }

                    const targetTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(targetCollectionResult.objectCollection.table_name)}`
                    const targetActiveCondition = buildRuntimeActiveRowCondition(
                        targetCollectionResult.objectCollection.lifecycleContract,
                        targetCollectionResult.objectCollection.config,
                        undefined,
                        ctx.currentWorkspaceId
                    )
                    const targetValues: unknown[] = [restoreTarget.targetRecordId]
                    const targetAccessClause = await buildRuntimeRecordAccessClause({
                        manager: txManager,
                        schemaIdent: ctx.schemaIdent,
                        currentWorkspaceId: ctx.currentWorkspaceId,
                        currentUserId: ctx.userId,
                        permissions: ctx.permissions,
                        objectCodename: resolveRuntimeCodenameText(targetCollectionResult.objectCollection.codename),
                        attrs: targetCollectionResult.attrs,
                        config: targetCollectionResult.objectCollection.config,
                        outerRowIdSql: `${targetTableIdent}.id`,
                        values: targetValues,
                        minimumAccessLevel: 'edit'
                    })
                    const targetWhereSql = ['id = $1', targetActiveCondition, targetAccessClause]
                        .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                        .join(' AND ')
                    const targetRows = (await txManager.query(
                        `
              SELECT id
              FROM ${targetTableIdent}
              WHERE ${targetWhereSql}
              LIMIT 1
            `,
                        targetValues
                    )) as Array<{ id: string }>
                    if (!targetRows[0]?.id) {
                        throw new UpdateFailure(404, {
                            error: 'Restore target row not found',
                            code: 'RUNTIME_RESTORE_TARGET_ROW_NOT_FOUND'
                        })
                    }

                    if (restoreTarget.parentFieldCodename) {
                        const parentAttr = attrs.find(
                            (attr) =>
                                attr.column_name === restoreTarget.parentFieldCodename ||
                                resolveRuntimeCodenameText(attr.codename) === restoreTarget.parentFieldCodename
                        )
                        if (
                            !parentAttr ||
                            parentAttr.data_type !== 'REF' ||
                            parentAttr.target_object_id !== restoreTarget.targetObjectCollectionId
                        ) {
                            throw new UpdateFailure(400, {
                                error: 'Restore target parent field does not reference the target object',
                                code: 'RUNTIME_RESTORE_TARGET_FIELD_INVALID'
                            })
                        }
                        restoreParams.push(restoreTarget.targetRecordId)
                        restoreTargetSetClause = `,
                  ${quoteIdentifier(parentAttr.column_name)} = $${restoreParams.length}`
                    }
                }

                if (restoreTarget?.mode !== 'target' || !restoreTarget.parentFieldCodename) {
                    const parentAccessValidationError = await validateRuntimeParentRecordAccessReferences({
                        manager: txManager,
                        schemaIdent: ctx.schemaIdent,
                        currentWorkspaceId: ctx.currentWorkspaceId,
                        currentUserId: ctx.userId,
                        permissions: ctx.permissions,
                        objectConfig: objectCollection.config,
                        attrs,
                        row: sourceRow,
                        minimumAccessLevel: 'edit'
                    })
                    if (parentAccessValidationError) {
                        throw new UpdateFailure(404, {
                            error: parentAccessValidationError,
                            code: 'RUNTIME_RESTORE_ORIGINAL_PARENT_NOT_FOUND'
                        })
                    }
                }

                if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                    const limitState = await enforceObjectWorkspaceLimit(txManager, {
                        schemaName: ctx.schemaName,
                        objectId: objectCollection.id,
                        tableName: objectCollection.table_name,
                        workspaceId: ctx.currentWorkspaceId,
                        runtimeRowCondition: activeRowCondition
                    })

                    if (!limitState.canCreate) {
                        throw new UpdateFailure(409, {
                            error: 'Workspace object row limit reached',
                            code: 'WORKSPACE_LIMIT_REACHED',
                            details: limitState
                        })
                    }
                }

                const restoreAccessClause = await buildRuntimeRecordAccessClause({
                    manager: txManager,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename: resolveRuntimeCodenameText(objectCollection.codename),
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: restoreParams,
                    minimumAccessLevel: 'edit'
                })
                const restoreWhereSql = ['id = $2', deletedRowCondition, 'COALESCE(_upl_locked, false) = false', restoreAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')

                await dispatchRuntimeLifecycle({
                    manager: txManager,
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    payload: {
                        eventName: 'beforeUpdate',
                        previousRow: sourceRow,
                        metadata: { action: 'restore' }
                    }
                })

                const restored = (await txManager.query(
                    `
              UPDATE ${dataTableIdent}
              SET ${runtimeRestoreSetClause},
                  ${restoreTargetSetClause ? `${restoreTargetSetClause.trim().replace(/^,/, '')},` : ''}
                  _upl_version = COALESCE(_upl_version, 1) + 1
              WHERE ${restoreWhereSql}
                ${buildRuntimeExpectedVersionPredicate(parsedBody.data.expectedVersion, expectedVersionParamIndex)}
              RETURNING id
            `,
                    restoreParams
                )) as Array<{ id: string; status?: unknown; progress_percent?: unknown }>

                if (restored.length === 0) {
                    if (parsedBody.data.expectedVersion !== undefined) {
                        throw createRuntimeVersionConflictFailure(parsedBody.data.expectedVersion)
                    }
                    throw new UpdateFailure(404, {
                        error: 'Deleted row not found',
                        code: 'RUNTIME_RECORD_RESTORE_NOT_FOUND'
                    })
                }

                for (const tAttr of tableAttrsForRestore) {
                    const fallbackTabTableName = generateChildTableName(tAttr.id)
                    const tabTableName =
                        typeof tAttr.column_name === 'string' && IDENTIFIER_REGEX.test(tAttr.column_name)
                            ? tAttr.column_name
                            : fallbackTabTableName
                    if (!IDENTIFIER_REGEX.test(tabTableName)) continue
                    const tabTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(tabTableName)}`
                    await txManager.query(
                        `
              UPDATE ${tabTableIdent}
              SET ${runtimeRestoreSetClause},
                  _upl_version = COALESCE(_upl_version, 1) + 1
              WHERE _tp_parent_id = $2
                AND ${deletedRowCondition}
            `,
                        [ctx.userId, rowId]
                    )
                }

                const nextRow = await loadRuntimeRowById(txManager, dataTableIdent, rowId, activeRowCondition)
                afterRestoreLifecycleRequest = {
                    applicationId,
                    schemaName: ctx.schemaName,
                    objectCollection,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    payload: {
                        eventName: 'afterUpdate',
                        row: nextRow,
                        previousRow: sourceRow,
                        metadata: { action: 'restore' }
                    }
                }
            })

            dispatchRuntimeLifecycleAfterCommit(ctx.manager, afterRestoreLifecycleRequest)
            return res.json({ status: 'restored' })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }

    const persistRuntimeActorLibraryRelation = async (params: {
        manager: DbExecutor
        applicationId: string
        schemaIdent: string
        objectCollectionId: string
        objectCodename: string
        objectConfig: Record<string, unknown> | null | undefined
        relationKey: RuntimeLibraryRelationKey
        rowId: string
        userId: string
        currentWorkspaceId: string | null
        workspacesEnabled: boolean
        active: boolean
        refreshTimestampOnActive?: boolean
    }): Promise<{ active: boolean; changed: boolean } | null> => {
        const libraryConfig = readRuntimeLibraryConfig(params.objectConfig)
        const relation = libraryConfig?.[params.relationKey]
        if (!relation?.actorFieldCodename) return null

        const binding = await resolveRuntimeRelationBinding({
            manager: params.manager,
            schemaIdent: params.schemaIdent,
            currentWorkspaceId: params.currentWorkspaceId,
            relation
        })
        if (!binding?.actorColumnName) return null

        const targetObjectColumn = quoteIdentifier(binding.targetObjectColumnName)
        const targetRecordColumn = quoteIdentifier(binding.targetRecordColumnName)
        const actorColumn = quoteIdentifier(binding.actorColumnName)
        const timestampColumn = binding.timestampColumnName ? quoteIdentifier(binding.timestampColumnName) : null
        const relationWorkspaceClause = params.workspacesEnabled && params.currentWorkspaceId ? 'AND rel.workspace_id = $4' : ''
        const relationParams =
            params.workspacesEnabled && params.currentWorkspaceId
                ? [params.objectCodename, params.rowId, params.userId, params.currentWorkspaceId]
                : [params.objectCodename, params.rowId, params.userId]
        const relationWhereSql = `
            rel.${targetObjectColumn}::text = $1::text
            AND rel.${targetRecordColumn}::text = $2::text
            AND rel.${actorColumn}::text = $3::text
            ${relationWorkspaceClause}
        `
        const relationLockKey = `${params.applicationId}:${params.objectCollectionId}:${params.rowId}:${params.relationKey}:${
            params.userId
        }:${params.currentWorkspaceId ?? 'default'}`

        await params.manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [relationLockKey])
        const activeRows = (await params.manager.query(
            `
        SELECT rel.id
        FROM ${binding.tableIdent} rel
        WHERE ${relationWhereSql}
          AND ${binding.activeCondition}
        LIMIT 1
      `,
            relationParams
        )) as Array<{ id: string }>
        const activeRowId = activeRows[0]?.id
        const wasActive = Boolean(activeRowId)

        if (params.active) {
            if (wasActive) {
                if (params.refreshTimestampOnActive && timestampColumn) {
                    const updatedRows = (await params.manager.query(
                        `
        UPDATE ${binding.tableIdent} rel
        SET ${timestampColumn} = NOW(),
            _upl_updated_at = NOW(),
            _upl_updated_by = $2,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE rel.id = $1
          AND ${binding.activeCondition}
        RETURNING id
      `,
                        [activeRowId, params.userId]
                    )) as Array<{ id: string }>
                    if (updatedRows.length === 0) {
                        throw new UpdateFailure(409, { error: 'Runtime library relation could not be updated' })
                    }
                    return { active: true, changed: true }
                }
                return { active: true, changed: false }
            }

            const [{ id }] = await params.manager.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
            const insertColumns = ['id', targetObjectColumn, targetRecordColumn, actorColumn]
            const insertValues: unknown[] = [id, params.objectCodename, params.rowId, params.userId]
            const insertPlaceholders = ['$1', '$2', '$3', '$4']

            if (timestampColumn) {
                insertColumns.push(timestampColumn)
                insertPlaceholders.push('NOW()')
            }
            if (params.workspacesEnabled && params.currentWorkspaceId) {
                insertColumns.push('workspace_id')
                insertPlaceholders.push(`$${insertValues.length + 1}`)
                insertValues.push(params.currentWorkspaceId)
            }

            insertColumns.push('_upl_created_by', '_upl_updated_by')
            insertPlaceholders.push(`$${insertValues.length + 1}`, `$${insertValues.length + 2}`)
            insertValues.push(params.userId, params.userId)

            await params.manager.query(
                `
        INSERT INTO ${binding.tableIdent} (${insertColumns.join(', ')})
        VALUES (${insertPlaceholders.join(', ')})
      `,
                insertValues
            )
            return { active: true, changed: true }
        }

        if (!wasActive) {
            return { active: false, changed: false }
        }

        if (binding.isSoftDelete) {
            const deletedByParam = `$${relationParams.length + 1}`
            const updatedRows = (await params.manager.query(
                `
        UPDATE ${binding.tableIdent} rel
        SET ${buildRuntimeSoftDeleteSetClause(deletedByParam, binding.lifecycleContract, binding.config)},
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE ${relationWhereSql}
          AND ${binding.activeCondition}
        RETURNING id
      `,
                [...relationParams, params.userId]
            )) as Array<{ id: string }>
            if (updatedRows.length === 0) {
                throw new UpdateFailure(409, { error: 'Runtime library relation could not be updated' })
            }
        } else {
            const deletedRows = (await params.manager.query(
                `
        DELETE FROM ${binding.tableIdent} rel
        WHERE ${relationWhereSql}
          AND ${binding.activeCondition}
        RETURNING id
      `,
                relationParams
            )) as Array<{ id: string }>
            if (deletedRows.length === 0) {
                throw new UpdateFailure(409, { error: 'Runtime library relation could not be updated' })
            }
        }

        return { active: false, changed: true }
    }

    const updateContentProgress = async (req: Request, res: Response) => {
        const { applicationId } = req.params

        const parsedBody = runtimeContentProgressBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return

        const targetObject = await resolveRuntimeObjectByCodename(ctx.manager, ctx.schemaIdent, parsedBody.data.targetObjectCodename, {
            includePages: true
        })
        if (!targetObject) {
            return res.status(404).json({ error: 'Progress target object not found' })
        }

        if (targetObject.kind === 'page') {
            if (targetObject.id !== parsedBody.data.targetRecordId) {
                return res.status(404).json({ error: 'Progress target row not found' })
            }
        } else {
            if (!targetObject.table_name) {
                return res.status(404).json({ error: 'Progress target object not found' })
            }

            const targetTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(targetObject.table_name)}`
            const targetActiveCondition = buildRuntimeActiveRowCondition(
                targetObject.lifecycleContract,
                targetObject.config,
                undefined,
                ctx.currentWorkspaceId
            )
            const targetAttrs = await loadRuntimeObjectAttrs(ctx.manager, ctx.schemaIdent, targetObject.id)
            const targetValues: unknown[] = [parsedBody.data.targetRecordId]
            const targetAccessClause = await buildRuntimeRecordAccessClause({
                manager: ctx.manager,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                currentUserId: ctx.userId,
                permissions: ctx.permissions,
                objectCodename: parsedBody.data.targetObjectCodename,
                attrs: targetAttrs,
                config: targetObject.config,
                outerRowIdSql: `${targetTableIdent}.id`,
                values: targetValues
            })
            const targetWhereSql = ['id = $1', targetActiveCondition, targetAccessClause]
                .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                .join(' AND ')
            const targetRows = (await ctx.manager.query(
                `
          SELECT id
          FROM ${targetTableIdent}
          WHERE ${targetWhereSql}
          LIMIT 1
        `,
                targetValues
            )) as Array<{ id: string }>

            if (!targetRows[0]?.id) {
                return res.status(404).json({ error: 'Progress target row not found' })
            }
        }

        const binding = await resolveProgressStoreBinding(ctx.manager, ctx.schemaIdent, ctx.applicationSettings)
        if (!binding) {
            return res.json({ persisted: false, reason: 'progress_store_unavailable' })
        }

        if (parsedBody.data.action !== 'recalculate') {
            const sequenceFailure = await assertRuntimeProgressSequenceAvailable({
                manager: ctx.manager,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                workspacesEnabled: ctx.workspacesEnabled,
                userId: ctx.userId,
                binding,
                targetObject,
                targetObjectCodename: parsedBody.data.targetObjectCodename,
                targetRecordId: parsedBody.data.targetRecordId
            })
            if (sequenceFailure) {
                return res.status(sequenceFailure.statusCode).json(sequenceFailure.body)
            }
        }

        const aggregateConfig = readRuntimeProgressAggregateParents(targetObject.config)
        if (aggregateConfig?.invalid) {
            return res.status(409).json({
                error: 'Progress aggregation is not configured for this target',
                code: 'PROGRESS_AGGREGATION_INVALID'
            })
        }

        if (parsedBody.data.action === 'recalculate') {
            if (!aggregateConfig || aggregateConfig.aggregateParents.length === 0) {
                return res.status(409).json({
                    error: 'Progress recalculation is not configured for this target',
                    code: 'PROGRESS_RECALCULATION_UNAVAILABLE'
                })
            }

            try {
                await ctx.manager.transaction(async (tx) => {
                    const aggregationFailure = await applyRuntimeProgressParentAggregations({
                        manager: tx,
                        schemaIdent: ctx.schemaIdent,
                        currentWorkspaceId: ctx.currentWorkspaceId,
                        workspacesEnabled: ctx.workspacesEnabled,
                        userId: ctx.userId,
                        binding,
                        targetObject,
                        targetObjectCodename: parsedBody.data.targetObjectCodename,
                        targetRecordId: parsedBody.data.targetRecordId,
                        aggregateParents: aggregateConfig.aggregateParents
                    })
                    if (aggregationFailure) throw aggregationFailure
                })
            } catch (e) {
                if (e instanceof UpdateFailure) {
                    return res.status(e.statusCode).json(e.body)
                }
                throw e
            }

            return res.json({
                persisted: true,
                action: 'recalculate',
                targetObjectCodename: parsedBody.data.targetObjectCodename,
                targetRecordId: parsedBody.data.targetRecordId
            })
        }

        const progressPercent = parsedBody.data.action === 'complete' ? 100 : 0
        const status = parsedBody.data.action === 'complete' ? 'completed' : 'inProgress'
        const q = {
            targetObjectCodename: quoteIdentifier(binding.columns.targetObjectCodename),
            targetRecordId: quoteIdentifier(binding.columns.targetRecordId),
            userId: quoteIdentifier(binding.columns.userId),
            status: quoteIdentifier(binding.columns.status),
            progressPercent: quoteIdentifier(binding.columns.progressPercent),
            startedAt: quoteIdentifier(binding.columns.startedAt),
            completedAt: quoteIdentifier(binding.columns.completedAt),
            lastViewedAt: quoteIdentifier(binding.columns.lastViewedAt)
        }

        const activeWorkspaceClause = ctx.workspacesEnabled && ctx.currentWorkspaceId ? 'AND workspace_id = $4' : ''
        const existingParams =
            ctx.workspacesEnabled && ctx.currentWorkspaceId
                ? [parsedBody.data.targetObjectCodename, parsedBody.data.targetRecordId, ctx.userId, ctx.currentWorkspaceId]
                : [parsedBody.data.targetObjectCodename, parsedBody.data.targetRecordId, ctx.userId]

        let storedProgressPercent = progressPercent
        let storedStatus = status

        try {
            await ctx.manager.transaction(async (tx) => {
                await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
                    [
                        ctx.schemaIdent,
                        binding.tableIdent,
                        parsedBody.data.targetObjectCodename,
                        parsedBody.data.targetRecordId,
                        ctx.userId,
                        ctx.workspacesEnabled && ctx.currentWorkspaceId ? ctx.currentWorkspaceId : ''
                    ].join(':')
                ])
                const existingRows = (await tx.query<{ id: string; status?: unknown; progress_percent?: unknown }>(
                    `
          SELECT id,
                 ${q.status} AS status,
                 ${q.progressPercent} AS progress_percent
          FROM ${binding.tableIdent}
          WHERE ${q.targetObjectCodename} = $1
            AND ${q.targetRecordId} = $2
            AND ${q.userId} = $3
            ${activeWorkspaceClause}
            AND _upl_deleted = false
            AND _app_deleted = false
          LIMIT 1
        `,
                    existingParams
                )) as Array<{ id: string; status?: unknown; progress_percent?: unknown }>

                if (existingRows[0]?.id) {
                    if (parsedBody.data.action === 'complete') {
                        storedProgressPercent = progressPercent
                        storedStatus = status
                        const updatedRows = await tx.query<{ id: string }>(
                            `
            UPDATE ${binding.tableIdent}
            SET ${q.status} = $2,
                ${q.progressPercent} = $3,
                ${q.lastViewedAt} = NOW(),
                ${q.startedAt} = COALESCE(${q.startedAt}, NOW()),
                ${q.completedAt} = CASE WHEN $3 >= 100 THEN COALESCE(${q.completedAt}, NOW()) ELSE ${q.completedAt} END,
                _upl_updated_at = NOW(),
                _upl_updated_by = $4,
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1
            RETURNING id
          `,
                            [existingRows[0].id, status, progressPercent, ctx.userId]
                        )
                        if (!updatedRows[0]?.id) {
                            throw new UpdateFailure(409, {
                                error: 'Progress update did not affect a row',
                                code: 'PROGRESS_UPDATE_CONFLICT'
                            })
                        }
                    } else {
                        storedProgressPercent = readRuntimeProgressNumber(existingRows[0].progress_percent) ?? progressPercent
                        storedStatus = readRuntimeProgressString(existingRows[0].status) ?? status
                        const updatedRows = await tx.query<{ id: string }>(
                            `
            UPDATE ${binding.tableIdent}
            SET ${q.lastViewedAt} = NOW(),
                ${q.startedAt} = COALESCE(${q.startedAt}, NOW()),
                _upl_updated_at = NOW(),
                _upl_updated_by = $2,
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1
            RETURNING id
          `,
                            [existingRows[0].id, ctx.userId]
                        )
                        if (!updatedRows[0]?.id) {
                            throw new UpdateFailure(409, {
                                error: 'Progress update did not affect a row',
                                code: 'PROGRESS_UPDATE_CONFLICT'
                            })
                        }
                    }
                } else {
                    const [{ id }] = await tx.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
                    const insertColumns = [
                        'id',
                        q.targetObjectCodename,
                        q.targetRecordId,
                        q.userId,
                        q.status,
                        q.progressPercent,
                        q.startedAt,
                        q.completedAt,
                        q.lastViewedAt
                    ]
                    const insertValues: unknown[] = [
                        id,
                        parsedBody.data.targetObjectCodename,
                        parsedBody.data.targetRecordId,
                        ctx.userId,
                        status,
                        progressPercent
                    ]
                    const insertPlaceholders = [
                        '$1',
                        '$2',
                        '$3',
                        '$4',
                        '$5',
                        '$6',
                        'NOW()',
                        'CASE WHEN $6 >= 100 THEN NOW() ELSE NULL END',
                        'NOW()'
                    ]

                    if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                        insertColumns.push('workspace_id')
                        insertPlaceholders.push(`$${insertValues.length + 1}`)
                        insertValues.push(ctx.currentWorkspaceId)
                    }

                    insertColumns.push('_upl_created_by', '_upl_updated_by')
                    insertPlaceholders.push(`$${insertValues.length + 1}`, `$${insertValues.length + 2}`)
                    insertValues.push(ctx.userId, ctx.userId)

                    const insertedRows = await tx.query<{ id: string }>(
                        `
          INSERT INTO ${binding.tableIdent} (${insertColumns.join(', ')})
          VALUES (${insertPlaceholders.join(', ')})
          RETURNING id
        `,
                        insertValues
                    )
                    if (!insertedRows[0]?.id) {
                        throw new UpdateFailure(409, {
                            error: 'Progress insert did not create a row',
                            code: 'PROGRESS_INSERT_CONFLICT'
                        })
                    }
                }

                if (ctx.userId) {
                    await persistRuntimeActorLibraryRelation({
                        manager: tx,
                        applicationId,
                        schemaIdent: ctx.schemaIdent,
                        objectCollectionId: targetObject.id,
                        objectCodename: parsedBody.data.targetObjectCodename,
                        objectConfig: targetObject.config,
                        relationKey: 'recent',
                        rowId: parsedBody.data.targetRecordId,
                        userId: ctx.userId,
                        currentWorkspaceId: ctx.currentWorkspaceId,
                        workspacesEnabled: ctx.workspacesEnabled,
                        active: true,
                        refreshTimestampOnActive: true
                    })
                }

                if (aggregateConfig && aggregateConfig.aggregateParents.length > 0) {
                    const aggregationFailure = await applyRuntimeProgressParentAggregations({
                        manager: tx,
                        schemaIdent: ctx.schemaIdent,
                        currentWorkspaceId: ctx.currentWorkspaceId,
                        workspacesEnabled: ctx.workspacesEnabled,
                        userId: ctx.userId,
                        binding,
                        targetObject,
                        targetObjectCodename: parsedBody.data.targetObjectCodename,
                        targetRecordId: parsedBody.data.targetRecordId,
                        aggregateParents: aggregateConfig.aggregateParents
                    })
                    if (aggregationFailure) throw aggregationFailure
                }
            })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }

        return res.json({
            persisted: true,
            targetObjectCodename: parsedBody.data.targetObjectCodename,
            targetRecordId: parsedBody.data.targetRecordId,
            progressPercent: storedProgressPercent,
            status: storedStatus
        })
    }

    const setLibraryRelation = async (req: Request, res: Response) => {
        const { applicationId, rowId } = req.params
        const parsedRelationKey = runtimeLibraryRelationKeyParamSchema.safeParse(req.params.relationKey)
        if (!parsedRelationKey.success) {
            return res.status(404).json({ error: 'Runtime library relation action is not configured' })
        }
        if (!UUID_REGEX.test(rowId)) {
            return res.status(400).json({ error: 'Invalid row id' })
        }

        const parsedBody = runtimeLibraryRelationActionBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ctx.userId) {
            return res.status(401).json({ error: 'Runtime library actions require an authenticated user' })
        }

        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, parsedBody.data.objectCollectionId)
        if (!objectCollection) {
            return res.status(404).json({ error: objectCollectionError })
        }

        const objectCodename = resolveRuntimeCodenameText(objectCollection.codename)
        const relationKey = parsedRelationKey.data
        const isSharedRelation = relationKey === 'shared'
        if (!isSharedRelation && (parsedBody.data.principalType || parsedBody.data.principalId)) {
            return res.status(400).json({ error: 'Runtime library principal target is only supported for shared relations' })
        }
        const libraryConfig = readRuntimeLibraryConfig(objectCollection.config)
        const relation = libraryConfig?.[relationKey]
        if (!relation) {
            return res.status(409).json({ error: 'Runtime library relation is not configured for this object' })
        }
        if (!isSharedRelation && !relation.actorFieldCodename) {
            return res.status(409).json({ error: 'Runtime library relation is not configured for this object' })
        }
        if (
            isSharedRelation &&
            (!relation.principalTypeFieldCodename ||
                !relation.principalIdFieldCodename ||
                (relation.accessLevelFieldCodename && !relation.defaultAccessLevel))
        ) {
            return res.status(409).json({ error: 'Runtime library relation is not configured for this object' })
        }

        const binding = await resolveRuntimeRelationBinding({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            currentWorkspaceId: ctx.currentWorkspaceId,
            relation
        })
        if (!binding || (!isSharedRelation && !binding.actorColumnName)) {
            return res.status(409).json({ error: 'Runtime library relation is not configured for this object' })
        }
        if (isSharedRelation && (!binding.principalTypeColumnName || !binding.principalIdColumnName)) {
            return res.status(409).json({ error: 'Runtime library relation is not configured for this object' })
        }
        const sharedPrincipalType = isSharedRelation ? parsedBody.data.principalType ?? 'user' : null
        const sharedPrincipalId = isSharedRelation ? parsedBody.data.principalId ?? ctx.userId : null
        const hasExplicitSharedPrincipal = Boolean(parsedBody.data.principalType && parsedBody.data.principalId)
        const sharedAccessLevel = relation.defaultAccessLevel ?? 'canView'

        const sourceTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const sourceValues: unknown[] = [rowId]
        const sourceActiveCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            'src',
            ctx.currentWorkspaceId
        )
        const sharedOwnerColumnName =
            isSharedRelation && !ctx.permissions.editContent ? resolveRuntimeRecordOwnerColumnName(attrs, objectCollection.config) : null
        if (isSharedRelation && !ctx.permissions.editContent && !sharedOwnerColumnName) {
            return res.status(403).json({ error: 'Runtime library shared relation requires content owner or editor access' })
        }
        const recordAccessClause = await buildRuntimeRecordAccessClause({
            manager: ctx.manager,
            schemaIdent: ctx.schemaIdent,
            currentWorkspaceId: ctx.currentWorkspaceId,
            currentUserId: ctx.userId,
            permissions: ctx.permissions,
            objectCodename,
            attrs,
            config: objectCollection.config,
            outerRowIdSql: 'src.id',
            values: sourceValues,
            minimumAccessLevel: isSharedRelation ? 'edit' : 'read'
        })
        const sourceWhereSql = ['src.id = $1', sourceActiveCondition, recordAccessClause]
            .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
            .join(' AND ')
        const sourceSelectSql = [
            'src.id',
            ...(sharedOwnerColumnName ? [`src.${quoteIdentifier(sharedOwnerColumnName)} AS owner_user_id`] : [])
        ]
        const sourceRows = (await ctx.manager.query(
            `
      SELECT ${sourceSelectSql.join(', ')}
      FROM ${sourceTableIdent} src
      WHERE ${sourceWhereSql}
      LIMIT 1
    `,
            sourceValues
        )) as Array<{ id: string; owner_user_id?: string | null }>
        if (!sourceRows[0]?.id) {
            return res.status(404).json({ error: 'Runtime library target row was not found' })
        }
        if (isSharedRelation && !ctx.permissions.editContent && String(sourceRows[0].owner_user_id ?? '') !== ctx.userId) {
            return res.status(403).json({ error: 'Runtime library shared relation requires content owner or editor access' })
        }
        if (isSharedRelation) {
            const sharedPrincipalError = await validateRuntimeSharedRelationPrincipal({
                manager: ctx.manager,
                applicationId,
                schemaIdent: ctx.schemaIdent,
                currentWorkspaceId: ctx.currentWorkspaceId,
                binding,
                principalType: sharedPrincipalType!,
                principalId: sharedPrincipalId!,
                explicitPrincipal: hasExplicitSharedPrincipal
            })
            if (sharedPrincipalError) {
                return res.status(400).json({ error: sharedPrincipalError })
            }
        }

        const targetObjectColumn = quoteIdentifier(binding.targetObjectColumnName)
        const targetRecordColumn = quoteIdentifier(binding.targetRecordColumnName)
        const actorColumn = binding.actorColumnName ? quoteIdentifier(binding.actorColumnName) : null
        const principalTypeColumn = binding.principalTypeColumnName ? quoteIdentifier(binding.principalTypeColumnName) : null
        const principalIdColumn = binding.principalIdColumnName ? quoteIdentifier(binding.principalIdColumnName) : null
        const accessLevelColumn = binding.accessLevelColumnName ? quoteIdentifier(binding.accessLevelColumnName) : null
        const timestampColumn = binding.timestampColumnName ? quoteIdentifier(binding.timestampColumnName) : null
        const relationParams: unknown[] = isSharedRelation
            ? [objectCodename, rowId, sharedPrincipalType, sharedPrincipalId]
            : [objectCodename, rowId, ctx.userId]
        const relationPredicates = [
            `rel.${targetObjectColumn}::text = $1::text`,
            `rel.${targetRecordColumn}::text = $2::text`,
            isSharedRelation
                ? `rel.${principalTypeColumn!}::text = $3::text AND rel.${principalIdColumn!}::text = $4::text`
                : `rel.${actorColumn!}::text = $3::text`
        ]
        if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
            relationParams.push(ctx.currentWorkspaceId)
            relationPredicates.push(`rel.workspace_id = $${relationParams.length}`)
        }
        const relationWhereSql = relationPredicates.join('\n            AND ')
        const relationLockPrincipal = isSharedRelation ? `${sharedPrincipalType}:${sharedPrincipalId}` : ctx.userId
        const relationLockKey = `${applicationId}:${objectCollection.id}:${rowId}:${relationKey}:${relationLockPrincipal}:${
            ctx.currentWorkspaceId ?? 'default'
        }`

        try {
            const result = await ctx.manager.transaction(async (tx) => {
                await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [relationLockKey])
                const activeRows = (await tx.query(
                    `
        SELECT rel.id
        FROM ${binding.tableIdent} rel
        WHERE ${relationWhereSql}
          AND ${binding.activeCondition}
        LIMIT 1
      `,
                    relationParams
                )) as Array<{ id: string }>
                const wasActive = Boolean(activeRows[0]?.id)

                if (parsedBody.data.active) {
                    if (wasActive) {
                        if ((relationKey === 'recent' && timestampColumn) || (isSharedRelation && (accessLevelColumn || timestampColumn))) {
                            const updateAssignments = [
                                ...(accessLevelColumn ? [`${accessLevelColumn} = $2`] : []),
                                ...(timestampColumn ? [`${timestampColumn} = NOW()`] : []),
                                `_upl_updated_at = NOW()`,
                                `_upl_updated_by = $${accessLevelColumn ? 3 : 2}`,
                                `_upl_version = COALESCE(_upl_version, 1) + 1`
                            ]
                            const updateValues = accessLevelColumn
                                ? [activeRows[0]!.id, sharedAccessLevel, ctx.userId]
                                : [activeRows[0]!.id, ctx.userId]
                            const updatedRows = (await tx.query(
                                `
        UPDATE ${binding.tableIdent} rel
        SET ${updateAssignments.join(',\n            ')}
        WHERE rel.id = $1
          AND ${binding.activeCondition}
        RETURNING id
      `,
                                updateValues
                            )) as Array<{ id: string }>
                            if (updatedRows.length === 0) {
                                throw new UpdateFailure(409, { error: 'Runtime library relation could not be updated' })
                            }
                            return { active: true, changed: true }
                        }
                        return { active: true, changed: false }
                    }

                    const [{ id }] = await tx.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
                    const insertColumns = isSharedRelation
                        ? ['id', targetObjectColumn, targetRecordColumn, principalTypeColumn!, principalIdColumn!]
                        : ['id', targetObjectColumn, targetRecordColumn, actorColumn!]
                    const insertValues: unknown[] = isSharedRelation
                        ? [id, objectCodename, rowId, sharedPrincipalType, sharedPrincipalId]
                        : [id, objectCodename, rowId, ctx.userId]
                    const insertPlaceholders = insertValues.map((_value, index) => `$${index + 1}`)

                    if (timestampColumn) {
                        insertColumns.push(timestampColumn)
                        insertPlaceholders.push('NOW()')
                    }
                    if (isSharedRelation && accessLevelColumn) {
                        insertColumns.push(accessLevelColumn)
                        insertPlaceholders.push(`$${insertValues.length + 1}`)
                        insertValues.push(sharedAccessLevel)
                    }
                    if (ctx.workspacesEnabled && ctx.currentWorkspaceId) {
                        insertColumns.push('workspace_id')
                        insertPlaceholders.push(`$${insertValues.length + 1}`)
                        insertValues.push(ctx.currentWorkspaceId)
                    }

                    insertColumns.push('_upl_created_by', '_upl_updated_by')
                    insertPlaceholders.push(`$${insertValues.length + 1}`, `$${insertValues.length + 2}`)
                    insertValues.push(ctx.userId, ctx.userId)

                    await tx.query(
                        `
        INSERT INTO ${binding.tableIdent} (${insertColumns.join(', ')})
        VALUES (${insertPlaceholders.join(', ')})
      `,
                        insertValues
                    )
                    return { active: true, changed: true }
                }

                if (!wasActive) {
                    return { active: false, changed: false }
                }

                if (binding.isSoftDelete) {
                    const deletedByParam = `$${relationParams.length + 1}`
                    const updatedRows = (await tx.query(
                        `
        UPDATE ${binding.tableIdent} rel
        SET ${buildRuntimeSoftDeleteSetClause(deletedByParam, binding.lifecycleContract, binding.config)},
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE ${relationWhereSql}
          AND ${binding.activeCondition}
        RETURNING id
      `,
                        [...relationParams, ctx.userId]
                    )) as Array<{ id: string }>
                    if (updatedRows.length === 0) {
                        throw new UpdateFailure(409, { error: 'Runtime library relation could not be updated' })
                    }
                } else {
                    const deletedRows = (await tx.query(
                        `
        DELETE FROM ${binding.tableIdent} rel
        WHERE ${relationWhereSql}
          AND ${binding.activeCondition}
        RETURNING id
      `,
                        relationParams
                    )) as Array<{ id: string }>
                    if (deletedRows.length === 0) {
                        throw new UpdateFailure(409, { error: 'Runtime library relation could not be updated' })
                    }
                }

                return { active: false, changed: true }
            })

            return res.json({ relationKey, ...result })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }
    }

    const reorderRows = async (req: Request, res: Response) => {
        const { applicationId } = req.params

        const parsedBody = runtimeReorderBodySchema.safeParse(req.body)
        if (!parsedBody.success) {
            return res.status(400).json({ error: 'Invalid body', details: parsedBody.error.flatten() })
        }

        const ctx = await resolveRuntimeSchema(getDbExecutor, query, req, res, applicationId)
        if (!ctx) return
        if (!ensureRuntimePermission(res, ctx, 'editContent')) return

        const { orderedRowIds, objectCollectionId: requestedObjectCollectionId, expectedVersionsByRowId } = parsedBody.data
        const orderedRowIdSet = new Set(orderedRowIds)
        if (orderedRowIdSet.size !== orderedRowIds.length) {
            return res.status(400).json({
                error: 'Runtime row reorder received duplicate row IDs',
                code: 'RUNTIME_REORDER_DUPLICATE_ROWS'
            })
        }
        const expectedVersionEntries = Object.entries(expectedVersionsByRowId ?? {})
        if (expectedVersionEntries.length > 0) {
            const missingVersionRows = orderedRowIds.filter((id) => expectedVersionsByRowId?.[id] === undefined)
            const extraVersionRows = expectedVersionEntries.map(([id]) => id).filter((id) => !orderedRowIdSet.has(id))
            if (missingVersionRows.length > 0 || extraVersionRows.length > 0) {
                return res.status(409).json({
                    error: 'Runtime row reorder expected-version map must match ordered rows',
                    code: 'RUNTIME_REORDER_VERSION_MAP_MISMATCH',
                    details: { missingVersionRows, extraVersionRows }
                })
            }
        }
        const {
            objectCollection,
            attrs,
            error: objectCollectionError
        } = await resolveRuntimeObjectCollection(ctx.manager, ctx.schemaIdent, requestedObjectCollectionId)
        if (!objectCollection) {
            return res.status(404).json({ error: objectCollectionError })
        }

        const { runtimeConfig } = await resolveEffectiveObjectCollectionRuntimeConfig({
            manager: ctx.manager,
            schemaName: ctx.schemaName,
            schemaIdent: ctx.schemaIdent,
            objectCollectionId: objectCollection.id
        })
        const reorderFieldAttr = resolveRuntimeReorderField(attrs, runtimeConfig.reorderPersistenceField)

        if (!runtimeConfig.enableRowReordering || !reorderFieldAttr) {
            return res.status(409).json({ error: 'Persisted row reordering is not enabled for this object' })
        }

        const dataTableIdent = `${ctx.schemaIdent}.${quoteIdentifier(objectCollection.table_name)}`
        const runtimeRowCondition = buildRuntimeActiveRowCondition(
            objectCollection.lifecycleContract,
            objectCollection.config,
            undefined,
            ctx.currentWorkspaceId
        )

        try {
            await ctx.manager.transaction(async (tx) => {
                const objectCodename = resolveRuntimeCodenameText(objectCollection.codename)
                const countValues: unknown[] = []
                const countAccessClause = await buildRuntimeRecordAccessClause({
                    manager: tx,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename,
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: countValues,
                    minimumAccessLevel: 'edit'
                })
                const countWhereSql = [runtimeRowCondition, countAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const [{ total }] = (await tx.query(
                    `
        SELECT COUNT(*)::int AS total
        FROM ${dataTableIdent}
        WHERE ${countWhereSql}
      `,
                    countValues
                )) as Array<{ total: number }>

                if (total !== orderedRowIds.length) {
                    throw new UpdateFailure(409, {
                        error: 'Persisted row reordering requires the complete loaded dataset',
                        details: { total, received: orderedRowIds.length }
                    })
                }

                const matchValues: unknown[] = [orderedRowIds]
                const matchAccessClause = await buildRuntimeRecordAccessClause({
                    manager: tx,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename,
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: `${dataTableIdent}.id`,
                    values: matchValues,
                    minimumAccessLevel: 'edit'
                })
                const matchWhereSql = [`id = ANY($1::uuid[])`, runtimeRowCondition, matchAccessClause]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')
                const matchedRows = (await tx.query(
                    `
        SELECT id, _upl_version, _upl_locked
        FROM ${dataTableIdent}
        WHERE ${matchWhereSql}
        FOR UPDATE
      `,
                    matchValues
                )) as Array<{ id: string; _upl_version?: number | string | null; _upl_locked?: boolean | null }>

                if (matchedRows.length !== orderedRowIds.length) {
                    throw new UpdateFailure(404, { error: 'One or more rows could not be reordered' })
                }
                if (matchedRows.some((row) => row._upl_locked === true)) {
                    throw new UpdateFailure(423, { error: 'Record is locked' })
                }

                if (expectedVersionEntries.length > 0) {
                    for (const row of matchedRows) {
                        const expectedVersion = expectedVersionsByRowId?.[row.id]
                        if (expectedVersion === undefined) continue
                        const actualVersion = Number(row._upl_version ?? 1)
                        if (actualVersion !== expectedVersion) {
                            throw createRuntimeVersionConflictFailure(expectedVersion, actualVersion)
                        }
                    }
                }

                const valuesSql = orderedRowIds.map((_, index) => `($${index * 2 + 1}::uuid, $${index * 2 + 2}::numeric)`).join(', ')
                const parameters = orderedRowIds.flatMap((rowId, index) => [rowId, index])
                const updateAccessClause = await buildRuntimeRecordAccessClause({
                    manager: tx,
                    schemaIdent: ctx.schemaIdent,
                    currentWorkspaceId: ctx.currentWorkspaceId,
                    currentUserId: ctx.userId,
                    permissions: ctx.permissions,
                    objectCodename,
                    attrs,
                    config: objectCollection.config,
                    outerRowIdSql: 'target.id',
                    values: parameters,
                    minimumAccessLevel: 'edit'
                })
                const updateWhereSql = [
                    'target.id = incoming.id',
                    runtimeRowCondition,
                    'COALESCE(target._upl_locked, false) = false',
                    updateAccessClause
                ]
                    .filter((clause): clause is string => typeof clause === 'string' && clause.length > 0)
                    .join(' AND ')

                const updatedRows = await tx.query<{ id: string }>(
                    `
        WITH incoming(id, sort_order) AS (
          VALUES ${valuesSql}
        )
        UPDATE ${dataTableIdent} AS target
        SET ${quoteIdentifier(reorderFieldAttr.column_name)} = incoming.sort_order,
            _upl_updated_by = $${parameters.length + 1},
            _upl_version = COALESCE(target._upl_version, 1) + 1
        FROM incoming
        WHERE ${updateWhereSql}
        RETURNING target.id
      `,
                    [...parameters, ctx.userId]
                )
                if (updatedRows.length !== orderedRowIds.length) {
                    throw new UpdateFailure(409, {
                        error: 'One or more rows could not be reordered',
                        code: 'RUNTIME_REORDER_UPDATE_CONFLICT',
                        details: { updated: updatedRows.length, received: orderedRowIds.length }
                    })
                }
            })
        } catch (e) {
            if (e instanceof UpdateFailure) {
                return res.status(e.statusCode).json(e.body)
            }
            throw e
        }

        return res.json({ status: 'reordered' })
    }

    return {
        listRecordsUnionDatasource,
        getRuntime,
        updateCell,
        bulkUpdateRow,
        createRow,
        copyRow,
        postRow,
        unpostRow,
        voidRow,
        runWorkflowAction,
        getRow,
        deleteRow,
        restoreRow,
        updateContentProgress,
        setLibraryRelation,
        reorderRows
    }
}
