import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import { z } from 'zod'
import { type DbExecutor } from '@universo-react/utils'
import {
    sanitizeApplicationLearningContentSettings,
    calculateWeightedProgress,
    sequencePolicySchema,
    evaluateSequenceStepAvailability,
    type CompletionItem,
    type SequenceStep
} from '@universo-react/types'
import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import {
    UpdateFailure,
    IDENTIFIER_REGEX,
    UUID_REGEX,
    quoteIdentifier,
    resolveRuntimeCodenameText,
    buildRuntimeActiveRowCondition
} from '../../shared/runtimeHelpers'
import {
    COMPLETION_STATUS_SET,
    runtimeProgressAggregateParentSchema,
    type RuntimeProgressAggregateParent,
    type RuntimeProgressAggregateParentsConfig,
    type RuntimeProgressSequencePolicyConfig,
    type RuntimeProgressStoreBinding
} from './contracts'
import { resolveRuntimeObjectByCodename } from './objects'
import { assertRuntimeEntityMutationAllowed } from '../../shared/entityMutationPolicy'

export const readRuntimeProgressSequencePolicy = (
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

export const readRuntimeProgressAggregateParents = (
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

export const readRuntimeProgressString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined

export const readRuntimeProgressNumber = (value: unknown): number | undefined => {
    const numberValue =
        typeof value === 'number' ? value : typeof value === 'string' && value.trim().length > 0 ? Number(value) : Number.NaN
    return Number.isFinite(numberValue) ? numberValue : undefined
}

export const readRuntimeProgressPrerequisiteIds = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    if (typeof value !== 'string') return []
    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
}

export const readRuntimeProgressStatus = (value: unknown): SequenceStep['status'] =>
    typeof value === 'string' && COMPLETION_STATUS_SET.has(value) ? (value as SequenceStep['status']) : 'notStarted'

export const resolveProgressStoreBinding = async (
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
        config: object.config,
        columns: columns as RuntimeProgressStoreBinding['columns']
    }
}

export const assertRuntimeProgressSequenceAvailable = async ({
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

export const statusFromAggregatedProgress = (progressPercent: number): CompletionItem['status'] => {
    if (progressPercent >= 100) return 'completed'
    if (progressPercent > 0) return 'inProgress'
    return 'notStarted'
}

export const toPositiveRuntimeWeight = (value: unknown): number | undefined => {
    const numberValue = readRuntimeProgressNumber(value)
    return typeof numberValue === 'number' && numberValue > 0 ? numberValue : undefined
}

export const toRuntimeBoolean = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        return normalized === 'true' || normalized === '1' || normalized === 'yes'
    }
    return false
}

type RuntimeProgressAggregationTarget = {
    id: string
    table_name: string | null
    config?: Record<string, unknown> | null
    lifecycleContract: ReturnType<typeof resolveApplicationLifecycleContractFromConfig>
}

type RuntimeProgressAggregationColumns = {
    targetObjectCodename: string
    targetRecordId: string
    userId: string
    status: string
    progressPercent: string
    startedAt: string
    completedAt: string
    lastViewedAt: string
}

type RuntimeProgressAggregationContext = {
    readColumn: (fieldCodename: string | undefined) => string | null
    targetTableIdent: string
    targetActiveCondition: string
    progressColumns: RuntimeProgressAggregationColumns
}

const resolveRuntimeProgressAggregationContext = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    targetObject: RuntimeProgressAggregationTarget
    targetTableName: string
    binding: RuntimeProgressStoreBinding
}): Promise<RuntimeProgressAggregationContext> => {
    const targetAttrs = (await params.manager.query(
        `
      SELECT codename, column_name
      FROM ${params.schemaIdent}._app_components
      WHERE object_id = $1
        AND parent_component_id IS NULL
        AND _upl_deleted = false
        AND _app_deleted = false
    `,
        [params.targetObject.id]
    )) as Array<{ codename: unknown; column_name: string }>

    const attrByCodename = new Map(
        targetAttrs
            .map((attr) => [resolveRuntimeCodenameText(attr.codename), attr.column_name] as const)
            .filter(([, column]) => IDENTIFIER_REGEX.test(column))
    )
    const readColumn = (fieldCodename: string | undefined): string | null =>
        fieldCodename ? attrByCodename.get(fieldCodename) ?? null : null

    return {
        readColumn,
        targetTableIdent: `${params.schemaIdent}.${quoteIdentifier(params.targetTableName)}`,
        targetActiveCondition: buildRuntimeActiveRowCondition(
            params.targetObject.lifecycleContract,
            params.targetObject.config,
            undefined,
            params.currentWorkspaceId
        ),
        progressColumns: {
            targetObjectCodename: quoteIdentifier(params.binding.columns.targetObjectCodename),
            targetRecordId: quoteIdentifier(params.binding.columns.targetRecordId),
            userId: quoteIdentifier(params.binding.columns.userId),
            status: quoteIdentifier(params.binding.columns.status),
            progressPercent: quoteIdentifier(params.binding.columns.progressPercent),
            startedAt: quoteIdentifier(params.binding.columns.startedAt),
            completedAt: quoteIdentifier(params.binding.columns.completedAt),
            lastViewedAt: quoteIdentifier(params.binding.columns.lastViewedAt)
        }
    }
}

const loadRuntimeProgressAggregationInputs = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    workspacesEnabled: boolean
    userId: string
    targetObjectCodename: string
    targetRecordId: string
    binding: RuntimeProgressStoreBinding
    aggregate: RuntimeProgressAggregateParent
    context: RuntimeProgressAggregationContext
}): Promise<
    { parentId: string; aggregateStatus: CompletionItem['status']; aggregateProgressPercent: number } | { failure: UpdateFailure } | null
> => {
    const { readColumn, targetTableIdent, targetActiveCondition, progressColumns } = params.context
    const parentIdColumn = readColumn(params.aggregate.parentIdFieldCodename)
    const weightColumn = readColumn(params.aggregate.itemWeightFieldCodename)
    const requiredColumn = readColumn(params.aggregate.itemRequiredFieldCodename)

    if (
        !parentIdColumn ||
        (params.aggregate.itemWeightFieldCodename && !weightColumn) ||
        (params.aggregate.itemRequiredFieldCodename && !requiredColumn)
    ) {
        return {
            failure: new UpdateFailure(409, {
                error: 'Progress aggregation is not configured for this target',
                code: 'PROGRESS_AGGREGATION_INVALID'
            })
        }
    }

    const selectFields = [
        { alias: 'parent_id', column: parentIdColumn },
        ...(weightColumn ? [{ alias: 'item_weight', column: weightColumn }] : []),
        ...(requiredColumn ? [{ alias: 'item_required', column: requiredColumn }] : [])
    ]
    const selectSql = selectFields.map(({ alias, column }) => `${quoteIdentifier(column)} AS ${quoteIdentifier(alias)}`).join(', ')
    const targetRows = (await params.manager.query(
        `
      SELECT id, ${selectSql}
      FROM ${targetTableIdent}
      WHERE id = $1
        AND ${targetActiveCondition}
      LIMIT 1
    `,
        [params.targetRecordId]
    )) as Array<Record<string, unknown> & { id: string; parent_id?: unknown }>
    const targetRow = targetRows[0]
    const parentId = readRuntimeProgressString(targetRow?.parent_id)
    if (!parentId || !UUID_REGEX.test(parentId)) {
        return {
            failure: new UpdateFailure(409, {
                error: 'Progress aggregation is not configured for this target',
                code: 'PROGRESS_AGGREGATION_INVALID'
            })
        }
    }

    const siblingRows = (await params.manager.query(
        `
      SELECT id, ${selectSql}
      FROM ${targetTableIdent}
      WHERE ${targetActiveCondition}
        AND ${quoteIdentifier(parentIdColumn)} IS NOT DISTINCT FROM $1
    `,
        [parentId]
    )) as Array<Record<string, unknown> & { id: string; item_weight?: unknown; item_required?: unknown }>
    const siblingIds = siblingRows.map((row) => row.id).filter((id) => UUID_REGEX.test(id))
    if (siblingIds.length === 0) return null

    const progressParams: unknown[] = [params.targetObjectCodename, params.userId, siblingIds]
    const progressWorkspaceClause =
        params.workspacesEnabled && params.currentWorkspaceId ? `AND workspace_id = $${progressParams.push(params.currentWorkspaceId)}` : ''
    const progressRows = (await params.manager.query(
        `
      SELECT ${progressColumns.targetRecordId} AS target_record_id,
             ${progressColumns.status} AS status,
             ${progressColumns.progressPercent} AS progress_percent
      FROM ${params.binding.tableIdent}
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
        if (params.aggregate.requiredOnly && requiredColumn && !toRuntimeBoolean(row.item_required)) return []
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

    return { parentId, aggregateStatus, aggregateProgressPercent }
}

const updateAggregatedProgressParentRow = async (params: {
    manager: DbExecutor
    binding: RuntimeProgressStoreBinding
    progressColumns: RuntimeProgressAggregationColumns
    existingRowId: string
    aggregateStatus: CompletionItem['status']
    aggregateProgressPercent: number
    userId: string
}): Promise<UpdateFailure | null> => {
    const { progressColumns } = params
    const updatedRows = await params.manager.query<{ id: string }>(
        `
      UPDATE ${params.binding.tableIdent}
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
        [params.existingRowId, params.aggregateStatus, params.aggregateProgressPercent, params.userId]
    )
    if (!updatedRows[0]?.id) {
        return new UpdateFailure(409, {
            error: 'Progress aggregation update did not affect a row',
            code: 'PROGRESS_AGGREGATION_UPDATE_CONFLICT'
        })
    }

    return null
}

const insertAggregatedProgressParentRow = async (params: {
    manager: DbExecutor
    binding: RuntimeProgressStoreBinding
    progressColumns: RuntimeProgressAggregationColumns
    parentObjectCodename: string
    parentId: string
    aggregateStatus: CompletionItem['status']
    aggregateProgressPercent: number
    userId: string
    workspacesEnabled: boolean
    currentWorkspaceId?: string | null
}): Promise<UpdateFailure | null> => {
    const { progressColumns } = params
    const [{ id }] = await params.manager.query<{ id: string }>('SELECT public.uuid_generate_v7() AS id')
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
    const insertValues: unknown[] = [
        id,
        params.parentObjectCodename,
        params.parentId,
        params.userId,
        params.aggregateStatus,
        params.aggregateProgressPercent
    ]
    const insertPlaceholders = ['$1', '$2', '$3', '$4', '$5', '$6', 'NOW()', 'CASE WHEN $6 >= 100 THEN NOW() ELSE NULL END', 'NOW()']

    if (params.workspacesEnabled && params.currentWorkspaceId) {
        insertColumns.push('workspace_id')
        insertPlaceholders.push(`$${insertValues.length + 1}`)
        insertValues.push(params.currentWorkspaceId)
    }

    insertColumns.push('_upl_created_by', '_upl_updated_by')
    insertPlaceholders.push(`$${insertValues.length + 1}`, `$${insertValues.length + 2}`)
    insertValues.push(params.userId, params.userId)

    const insertedRows = await params.manager.query<{ id: string }>(
        `
      INSERT INTO ${params.binding.tableIdent} (${insertColumns.join(', ')})
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

    return null
}

const recomputeRuntimeProgressParent = async (params: {
    manager: DbExecutor
    schemaIdent: string
    currentWorkspaceId?: string | null
    workspacesEnabled: boolean
    userId: string
    binding: RuntimeProgressStoreBinding
    aggregate: RuntimeProgressAggregateParent
    parentId: string
    aggregateStatus: CompletionItem['status']
    aggregateProgressPercent: number
    progressColumns: RuntimeProgressAggregationColumns
}): Promise<UpdateFailure | null> => {
    const parentObject = await resolveRuntimeObjectByCodename(params.manager, params.schemaIdent, params.aggregate.parentObjectCodename)
    if (!parentObject?.table_name) {
        return new UpdateFailure(409, {
            error: 'Progress aggregation parent is not configured',
            code: 'PROGRESS_AGGREGATION_INVALID'
        })
    }
    try {
        assertRuntimeEntityMutationAllowed(parentObject.config)
    } catch (error) {
        if (error instanceof UpdateFailure) return error
        throw error
    }
    const parentActiveCondition = buildRuntimeActiveRowCondition(
        parentObject.lifecycleContract,
        parentObject.config,
        undefined,
        params.currentWorkspaceId
    )
    const parentRows = (await params.manager.query(
        `
      SELECT id
      FROM ${params.schemaIdent}.${quoteIdentifier(parentObject.table_name)}
      WHERE id = $1
        AND ${parentActiveCondition}
      LIMIT 1
    `,
        [params.parentId]
    )) as Array<{ id: string }>
    if (!parentRows[0]?.id) {
        return new UpdateFailure(404, { error: 'Progress aggregation parent row not found' })
    }

    const existingParams =
        params.workspacesEnabled && params.currentWorkspaceId
            ? [params.aggregate.parentObjectCodename, params.parentId, params.userId, params.currentWorkspaceId]
            : [params.aggregate.parentObjectCodename, params.parentId, params.userId]
    const existingWorkspaceClause = params.workspacesEnabled && params.currentWorkspaceId ? 'AND workspace_id = $4' : ''
    await acquireAdvisoryXactLock(
        params.manager,
        [
            params.schemaIdent,
            params.binding.tableIdent,
            params.aggregate.parentObjectCodename,
            params.parentId,
            params.userId,
            params.workspacesEnabled && params.currentWorkspaceId ? params.currentWorkspaceId : ''
        ].join(':')
    )
    const existingRows = (await params.manager.query(
        `
      SELECT id
      FROM ${params.binding.tableIdent}
      WHERE ${params.progressColumns.targetObjectCodename} = $1
        AND ${params.progressColumns.targetRecordId} = $2
        AND ${params.progressColumns.userId} = $3
        ${existingWorkspaceClause}
        AND _upl_deleted = false
        AND _app_deleted = false
      LIMIT 1
    `,
        existingParams
    )) as Array<{ id: string }>

    if (existingRows[0]?.id) {
        return updateAggregatedProgressParentRow({
            manager: params.manager,
            binding: params.binding,
            progressColumns: params.progressColumns,
            existingRowId: existingRows[0].id,
            aggregateStatus: params.aggregateStatus,
            aggregateProgressPercent: params.aggregateProgressPercent,
            userId: params.userId
        })
    }

    return insertAggregatedProgressParentRow({
        manager: params.manager,
        binding: params.binding,
        progressColumns: params.progressColumns,
        parentObjectCodename: params.aggregate.parentObjectCodename,
        parentId: params.parentId,
        aggregateStatus: params.aggregateStatus,
        aggregateProgressPercent: params.aggregateProgressPercent,
        userId: params.userId,
        workspacesEnabled: params.workspacesEnabled,
        currentWorkspaceId: params.currentWorkspaceId
    })
}

export const applyRuntimeProgressParentAggregations = async ({
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
    targetObject: RuntimeProgressAggregationTarget
    targetObjectCodename: string
    targetRecordId: string
    aggregateParents: RuntimeProgressAggregateParent[]
}): Promise<UpdateFailure | null> => {
    if (!targetObject.table_name || !IDENTIFIER_REGEX.test(targetObject.table_name)) return null

    const context = await resolveRuntimeProgressAggregationContext({
        manager,
        schemaIdent,
        currentWorkspaceId,
        targetObject,
        targetTableName: targetObject.table_name,
        binding
    })

    for (const aggregate of aggregateParents) {
        const inputsResult = await loadRuntimeProgressAggregationInputs({
            manager,
            schemaIdent,
            currentWorkspaceId,
            workspacesEnabled,
            userId,
            targetObjectCodename,
            targetRecordId,
            binding,
            aggregate,
            context
        })
        if (inputsResult === null) continue
        if ('failure' in inputsResult) return inputsResult.failure

        const recomputeFailure = await recomputeRuntimeProgressParent({
            manager,
            schemaIdent,
            currentWorkspaceId,
            workspacesEnabled,
            userId,
            binding,
            aggregate,
            parentId: inputsResult.parentId,
            aggregateStatus: inputsResult.aggregateStatus,
            aggregateProgressPercent: inputsResult.aggregateProgressPercent,
            progressColumns: context.progressColumns
        })
        if (recomputeFailure) return recomputeFailure
    }

    return null
}
