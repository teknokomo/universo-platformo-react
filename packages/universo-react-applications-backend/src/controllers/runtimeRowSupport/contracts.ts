import { z } from 'zod'
import {
    isBuiltinEntityKind,
    recordsUnionDatasourceSchema,
    runtimeDatasourceFilterSchema,
    runtimeDatasourceSortSchema,
    COMPLETION_ITEM_STATUSES,
    DASHBOARD_LAYOUT_ZONES,
    type BuiltinEntityKind,
    type SequencePolicy,
    type DashboardLayoutZone
} from '@universo-react/types'
import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import {
    UpdateFailure,
    runtimeObjectFilterSql,
    runtimeLayoutCapableFilterSql,
    type RuntimeDataType,
    type RuntimeRefOption
} from '../../shared/runtimeHelpers'

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const parseJsonQueryValue = (value: unknown): unknown => {
    if (typeof value !== 'string') {
        return value
    }

    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}

export const runtimeQuerySchema = z.object({
    limit: z.coerce.number().int().positive().max(10000).default(100),
    offset: z.coerce.number().int().min(0).default(0),
    locale: z.string().optional(),
    sectionId: z.string().uuid().optional(),
    objectCollectionId: z.string().uuid().optional(),
    objectCollectionCodename: z.string().trim().min(1).max(128).optional(),
    lifecycleState: z.enum(['active', 'deleted']).default('active'),
    libraryView: z.enum(['all', 'recent', 'starred', 'shared']).default('all'),
    search: z.string().trim().max(200).optional(),
    sort: z.preprocess(parseJsonQueryValue, z.array(runtimeDatasourceSortSchema).max(5).optional()),
    filters: z.preprocess(parseJsonQueryValue, z.array(runtimeDatasourceFilterSchema).max(20).optional())
})

export const runtimeRecordsUnionBodySchema = z
    .object({
        datasource: recordsUnionDatasourceSchema,
        limit: z.coerce.number().int().positive().max(1000).default(100),
        offset: z.coerce.number().int().min(0).default(0),
        locale: z.string().optional()
    })
    .strict()

export const runtimeUpdateBodySchema = z.object({
    field: z.string().min(1),
    value: z.unknown(),
    objectCollectionId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive().optional()
})

export const runtimeBulkUpdateBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    data: z.record(z.unknown()),
    expectedVersion: z.number().int().positive().optional()
})

export const runtimeCreateBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    data: z.record(z.unknown())
})

export const runtimeCopyBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    copyChildTables: z.boolean().optional(),
    data: z.record(z.unknown()).optional(),
    expectedVersion: z.number().int().positive().optional()
})

export const runtimeReorderBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    orderedRowIds: z.array(z.string().uuid()).min(1).max(1000),
    expectedVersionsByRowId: z.record(z.string().uuid(), z.number().int().positive()).optional()
})

export const runtimeRecordCommandBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive().optional()
})

export const runtimeCompensateCreateBodySchema = z
    .object({
        objectCollectionId: z.string().uuid().optional(),
        expectedVersion: z.literal(1)
    })
    .strict()

export const runtimeRestoreBodySchema = z.object({
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

export const runtimeLibraryRelationActionBodySchema = z
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

export const runtimeLibraryRelationKeyParamSchema = z.enum(['recent', 'starred', 'shared'])

export { createRuntimeVersionConflictFailure } from '../runtimeVersionConflict'

export const buildRuntimeExpectedVersionPredicate = (expectedVersion: number | undefined, parameterIndex: number): string =>
    expectedVersion === undefined ? '' : `\n                AND COALESCE(_upl_version, 1) = $${parameterIndex}`

export const runtimeWorkflowActionBodySchema = z.object({
    objectCollectionId: z.string().uuid().optional(),
    expectedVersion: z.number().int().positive()
})

export const runtimeContentProgressBodySchema = z
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

export const runtimeWorkflowActionParamSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)

export const RUNTIME_RECORD_SYSTEM_FIELDS = [
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

export const RUNTIME_OBJECT_FILTER_SQL = runtimeObjectFilterSql()

export const RUNTIME_LAYOUT_CAPABLE_FILTER_SQL = runtimeLayoutCapableFilterSql()

export const resolveRuntimeStandardKind = (kind: unknown): BuiltinEntityKind | null =>
    typeof kind === 'string' && isBuiltinEntityKind(kind) ? kind : null

export const isRuntimeObjectTargetKind = (kind: unknown): kind is string =>
    typeof kind === 'string' && !['hub', 'set', 'enumeration', 'page', 'ledger'].includes(resolveRuntimeStandardKind(kind) ?? '')

export const isRuntimeEnumerationKind = (kind: unknown): kind is string =>
    typeof kind === 'string' && resolveRuntimeStandardKind(kind) === 'enumeration'

export const isRuntimeSetKind = (kind: unknown): kind is string => typeof kind === 'string' && resolveRuntimeStandardKind(kind) === 'set'

export const isRuntimeHubKind = (kind: unknown): kind is string => typeof kind === 'string' && resolveRuntimeStandardKind(kind) === 'hub'

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

export type RuntimeObjectCollectionRow = {
    id: string
    kind: string | null
    codename: unknown
    table_name: string
    presentation?: unknown
    config?: Record<string, unknown> | null
    lifecycleContract: ReturnType<typeof resolveApplicationLifecycleContractFromConfig>
}

export type RuntimeZoneWidget = {
    id: string
    layoutId: string
    widgetKey: string
    sortOrder: number
    config: Record<string, unknown>
}

export type RuntimeZoneWidgetRow = {
    id: string
    layout_id: string
    widget_key: string
    sort_order: number
    config: Record<string, unknown> | null
    zone: unknown
}

export type RuntimeZoneWidgets = Record<DashboardLayoutZone, RuntimeZoneWidget[]>

export const createEmptyRuntimeZoneWidgets = (): RuntimeZoneWidgets => ({
    left: [],
    top: [],
    right: [],
    bottom: [],
    center: []
})

export const isRuntimeDashboardZone = (value: unknown): value is DashboardLayoutZone =>
    typeof value === 'string' && (DASHBOARD_LAYOUT_ZONES as readonly string[]).includes(value)

export const mapRuntimeZoneWidgets = (rows: readonly RuntimeZoneWidgetRow[]): RuntimeZoneWidgets => {
    const zoneWidgets = createEmptyRuntimeZoneWidgets()

    for (const row of rows) {
        if (!isRuntimeDashboardZone(row.zone)) {
            throw new UpdateFailure(409, {
                error: 'Runtime layout contains an unsupported zone',
                code: 'LAYOUT_PERSISTED_INVALID'
            })
        }

        zoneWidgets[row.zone].push({
            id: row.id,
            layoutId: row.layout_id,
            widgetKey: row.widget_key,
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
            config: row.config && typeof row.config === 'object' ? row.config : {}
        })
    }

    return zoneWidgets
}

export type RuntimeReadableComponent = RuntimeObjectCollectionAttr & {
    data_type: RuntimeDataType
    is_display_component?: boolean
    presentation?: unknown
    sort_order?: number
}

export type RuntimeColumnDefinition = {
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

export type RuntimeRecordPickerReferenceConfig = {
    targetObjectCodenameField: string
    allowedObjectCodenames?: string[]
}

export type RuntimeDateOrderRule = {
    startField: string
    endField: string
    allowEqual: boolean
    message?: string
}

export type RuntimeFieldCondition = {
    field: string
    equals?: unknown
    notEquals?: unknown
    in?: unknown[]
    notIn?: unknown[]
}

export type RuntimeRequiredWhenRule = {
    field: string
    when: RuntimeFieldCondition
    message?: string
}

export type RuntimeDateOffsetDerivationRule = {
    targetField: string
    startField: string
    offsetDaysField: string
    when?: RuntimeFieldCondition
    clearWhen?: RuntimeFieldCondition
}

export const runtimeCopyRelationRefRemapSchema = z
    .object({
        fieldCodename: z.string().trim().min(1).max(128),
        sourceObjectCodename: z.string().trim().min(1).max(128)
    })
    .strict()

export const runtimeCopyRelationSchema = z
    .object({
        objectCodename: z.string().trim().min(1).max(128),
        parentFieldCodename: z.string().trim().min(1).max(128),
        orderFieldCodename: z.string().trim().min(1).max(128).optional(),
        refRemaps: z.array(runtimeCopyRelationRefRemapSchema).max(16).default([])
    })
    .strict()

export type RuntimeCopyRelation = z.infer<typeof runtimeCopyRelationSchema>

export type RuntimeCopyRelationsConfig =
    | {
          relations: RuntimeCopyRelation[]
          invalid: false
      }
    | {
          invalid: true
      }

export const runtimeLibraryRelationSchema = z
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

export const runtimeLibraryConfigSchema = z
    .object({
        recent: runtimeLibraryRelationSchema.optional(),
        starred: runtimeLibraryRelationSchema.optional(),
        shared: runtimeLibraryRelationSchema.optional()
    })
    .strict()

export const runtimeRecordAccessConfigSchema = z
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

export const runtimeRecordParentAccessConfigSchema = z
    .object({
        mode: z.literal('parentRecord'),
        parentObjectCodename: z.string().trim().min(1).max(128),
        parentFieldCodename: z.string().trim().min(1).max(128)
    })
    .strict()

export const runtimeAccessEntryConfigSchema = z
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

export type RuntimeLibraryRelation = z.infer<typeof runtimeLibraryRelationSchema>

export type RuntimeLibraryConfig = z.infer<typeof runtimeLibraryConfigSchema>

export type RuntimeLibraryRelationKey = z.infer<typeof runtimeLibraryRelationKeyParamSchema>

export type RuntimeRecordAccessConfig = z.infer<typeof runtimeRecordAccessConfigSchema>

export type RuntimeRecordParentAccessConfig = z.infer<typeof runtimeRecordParentAccessConfigSchema>

export type RuntimeAccessEntryConfig = z.infer<typeof runtimeAccessEntryConfigSchema>

export const isRuntimeServerOwnedAttr = (attr: { ui_config?: Record<string, unknown> | null }): boolean =>
    attr.ui_config?.serverOwned === true

export const readRuntimeRecordAccessConfig = (config: Record<string, unknown> | null | undefined): RuntimeRecordAccessConfig | null => {
    const parsed = runtimeRecordAccessConfigSchema.safeParse(config?.runtimeRecordAccess)
    return parsed.success ? parsed.data : null
}

export type RuntimeRelationBinding = {
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

export type RuntimeMenuPartitionPlacement = 'primary' | 'overflow' | 'hidden'

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

export type RuntimeListComponent = {
    codename: unknown
    column_name: string
    data_type: RuntimeDataType
    validation_rules?: Record<string, unknown>
}

export const RUNTIME_CURRENT_USER_ID_TOKEN = '{{runtime.currentUserId}}'

export type RuntimeProgressStoreBinding = {
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

export type RuntimeProgressSequencePolicyConfig =
    | {
          sequencePolicy: SequencePolicy
          invalid: false
      }
    | {
          invalid: true
      }

export const runtimeProgressAggregateParentSchema = z
    .object({
        parentObjectCodename: z.string().trim().min(1).max(128),
        parentIdFieldCodename: z.string().trim().min(1).max(128),
        itemWeightFieldCodename: z.string().trim().min(1).max(128).optional(),
        itemRequiredFieldCodename: z.string().trim().min(1).max(128).optional(),
        requiredOnly: z.boolean().default(false)
    })
    .strict()

export type RuntimeProgressAggregateParent = z.infer<typeof runtimeProgressAggregateParentSchema>

export type RuntimeProgressAggregateParentsConfig =
    | {
          aggregateParents: RuntimeProgressAggregateParent[]
          invalid: false
      }
    | {
          invalid: true
      }

export const COMPLETION_STATUS_SET = new Set<string>(COMPLETION_ITEM_STATUSES)

export type RuntimeUnionSystemProjectionField = 'type' | 'title' | 'status' | 'project' | 'updatedAt' | 'recentAt' | 'sharedAt'

export type RuntimeUnionProjectionSpec = {
    field: string
    sourceColumnName: string | null
    column: RuntimeColumnDefinition
    valueSql: string
}

export const RUNTIME_UNION_PROJECTION_LABELS: Record<RuntimeUnionSystemProjectionField, { en: string; ru: string }> = {
    type: { en: 'Type', ru: 'Тип' },
    title: { en: 'Title', ru: 'Заголовок' },
    status: { en: 'Status', ru: 'Статус' },
    project: { en: 'Project', ru: 'Проект' },
    updatedAt: { en: 'Updated', ru: 'Обновлено' },
    recentAt: { en: 'Viewed', ru: 'Просмотрено' },
    sharedAt: { en: 'Shared', ru: 'Доступ открыт' }
}

export type RuntimePostingMovementWriteResult = {
    postingMovements: Array<{ ledgerCodename: string; facts: Array<{ id: string; idempotent?: boolean }> }>
    postingReversals: Array<{ ledgerCodename: string; facts: Array<{ id: string }> }>
}

// ---------------------------------------------------------------------------
// Controller factory
// ---------------------------------------------------------------------------
