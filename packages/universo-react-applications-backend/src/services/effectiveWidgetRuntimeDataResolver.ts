import {
    dashboardWidgetConfigSchemaByKey,
    expandWidgetBindingSlotFamilies,
    getLayoutWidgetDefinition,
    getPlacementSourcePolicy,
    MAX_WIDGET_BINDING_TARGETS,
    validateWidgetBindings,
    type WidgetBindingTarget
} from '@universo-react/types'
import { isValidUuid, isUuidV7, type DbExecutor } from '@universo-react/utils'
import {
    loadPublishedDashboardMenuEntities,
    loadRuntimeWidgetBindingMetadata,
    loadWidgetBindingRuntimeRecords,
    WidgetBindingRuntimeDataError,
    type RuntimeWidgetBindingObjectMetadata
} from '../persistence/widgetBindingRuntimeStore'
import {
    getWidgetBindingRuntimeMutationIdentity,
    resolveWidgetBindingTargets,
    withWidgetBindingRuntimeData,
    WidgetBindingResolutionError
} from './widgetBindingResolver'
import { effectiveWidgetRuntimeDataSchema, type EffectiveWidgetRuntimeData } from './effectiveWidgetRuntimeData'
import { buildGeneratedRuntimeMenu } from './effectiveWidgetRuntimeMenu'
import { loadSavedRuntimeReportSource, SavedRuntimeReportSourceError } from '../persistence/savedRuntimeReportSourceStore'
import { UpdateFailure } from '../shared/runtimeHelpers'
import {
    authorizeWidgetTargets,
    collectBindingMetadataRequests,
    estimateRecordBudget,
    isRecord,
    positiveRuntimeRecordVersion,
    projectLearnerPlayer,
    projectLibraryTable,
    projectRecordsTable,
    projectPayload,
    semanticText,
    type PreparedWidget
} from './effectiveWidgetRuntimeDataProjectors'
import type { EffectiveWidgetRuntimeCandidate, EffectiveWidgetRuntimeReadScope } from './effectiveWidgetRuntimeDataContracts'

export type { EffectiveWidgetRuntimeCandidate, EffectiveWidgetRuntimeReadScope } from './effectiveWidgetRuntimeDataContracts'

const MAX_BOUND_WIDGETS = 64
const MAX_RUNTIME_RECORDS_PER_LAYOUT = 2000

const state = (status: EffectiveWidgetRuntimeData['status']): EffectiveWidgetRuntimeData =>
    effectiveWidgetRuntimeDataSchema.parse({ status })

const errorState = (error: unknown): EffectiveWidgetRuntimeData => {
    if (error instanceof SavedRuntimeReportSourceError) return state(error.reason)
    if (error instanceof UpdateFailure) {
        if (error.statusCode === 401 || error.statusCode === 403) return state('permission-denied')
        if (error.statusCode === 404) return state('stale-source')
        if (error.statusCode >= 400 && error.statusCode < 500) return state('malformed-config')
    }
    if (error instanceof WidgetBindingResolutionError) {
        return state(error.reason === 'target-unavailable' ? 'stale-source' : 'malformed-config')
    }
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : ''
    if (code === '42501' || code === '28000') return state('permission-denied')
    if (['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH'].includes(code)) {
        return state('network-error')
    }
    if (error instanceof WidgetBindingRuntimeDataError) return state('stale-source')
    return state('server-error')
}

const prepareWidget = (candidate: EffectiveWidgetRuntimeCandidate): PreparedWidget | EffectiveWidgetRuntimeData => {
    const configSchema = dashboardWidgetConfigSchemaByKey[candidate.widgetKey as keyof typeof dashboardWidgetConfigSchemaByKey]
    if (!configSchema || !isRecord(candidate.config)) return state('malformed-config')
    const parsedConfig = configSchema.safeParse(candidate.config)
    if (!parsedConfig.success || !isRecord(parsedConfig.data)) return state('malformed-config')
    const config = parsedConfig.data
    const baseDefinition = getLayoutWidgetDefinition(candidate.widgetKey, config)
    if (!baseDefinition) return state('malformed-config')
    const validatedCandidate = { ...candidate, config }
    if (candidate.bindings == null && (baseDefinition.bindingSlots ?? []).some((slot) => slot.cardinality.min > 0)) {
        return state('required-missing')
    }
    let bindings: ReturnType<typeof validateWidgetBindings>
    let definition: NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>
    try {
        definition = expandWidgetBindingSlotFamilies(baseDefinition, candidate.bindings ?? { version: 1, slots: [] })
        bindings = validateWidgetBindings(definition, candidate.bindings ?? { version: 1, slots: [] })
    } catch {
        return state('malformed-config')
    }
    const slotByKey = new Map((definition.bindingSlots ?? []).map((slot) => [slot.key, slot]))
    const targets: Array<{ slot: string; target: WidgetBindingTarget }> = []
    for (const slot of bindings.slots) {
        for (const target of slot.targets) targets.push({ slot: slot.slot, target })
    }
    if (targets.length > MAX_WIDGET_BINDING_TARGETS) return state('malformed-config')
    return { candidate: validatedCandidate, definition, bindings, slotByKey, targets }
}

type RuntimeWidgetBindingMetadata = Awaited<ReturnType<typeof loadRuntimeWidgetBindingMetadata>>
type RuntimeWidgetBindingRows = Awaited<ReturnType<typeof loadWidgetBindingRuntimeRecords>>
type RuntimeWidgetBindingQuery = Parameters<Parameters<typeof resolveWidgetBindingTargets>[2]>[0]
type ResolvedRuntimeWidgetTargets = Awaited<ReturnType<typeof resolveWidgetBindingTargets>>
type PreparedWidgetBindingSlot = NonNullable<NonNullable<PreparedWidget['definition']['bindingSlots']>[number]>

interface RuntimeWidgetCandidateSelection {
    readonly hasTrustedRuntimeActor: boolean
    readonly preparedWidgets: PreparedWidget[]
    readonly generatedMenus: PreparedWidget[]
}

interface CandidateSelectionAccumulator extends RuntimeWidgetCandidateSelection {
    preparedCount: number
}

interface CandidatePreparationContext {
    readonly executor: DbExecutor
    readonly scope: EffectiveWidgetRuntimeReadScope
    readonly locale: string
    readonly result: Map<string, EffectiveWidgetRuntimeData>
    readonly selection: CandidateSelectionAccumulator
}

interface AuthorizedWidgetMetadataBatch {
    readonly metadata: RuntimeWidgetBindingMetadata
    readonly widgets: readonly PreparedWidget[]
}

interface ResolvedWidgetBindingRead {
    readonly targets: ResolvedRuntimeWidgetTargets
    readonly projectionTargets: ResolvedRuntimeWidgetTargets
}

interface WidgetProjectorSharedInput {
    readonly executor: DbExecutor
    readonly scope: EffectiveWidgetRuntimeReadScope
    readonly widget: PreparedWidget
    readonly metadata: RuntimeWidgetBindingMetadata
    readonly locale: string
    readonly hasTrustedRuntimeActor: boolean
}

type WidgetProjectorInput =
    | (WidgetProjectorSharedInput & { readonly kind: 'library' })
    | (WidgetProjectorSharedInput & { readonly kind: 'records' })
    | (WidgetProjectorSharedInput & {
          readonly kind: 'bindings'
          readonly targets: ResolvedRuntimeWidgetTargets
      })

const isGeneratedRuntimeMenu = (widget: PreparedWidget): boolean =>
    widget.candidate.widgetKey === 'menuWidget' && widget.candidate.config.variant === 'generated'

const isLibraryRuntimeTable = (widget: PreparedWidget): boolean =>
    widget.candidate.widgetKey === 'detailsTable' && widget.candidate.config.variant === 'library'

const isRecordsRuntimeTable = (widget: PreparedWidget): boolean =>
    widget.candidate.widgetKey === 'detailsTable' &&
    (widget.candidate.config.variant === undefined || widget.candidate.config.variant === 'records')

const registerPreparedCandidate = (
    candidateId: string,
    overflowStatus: EffectiveWidgetRuntimeData['status'],
    context: CandidatePreparationContext
): boolean => {
    context.selection.preparedCount += 1
    if (context.selection.preparedCount <= MAX_BOUND_WIDGETS) return true
    context.result.set(candidateId, state(overflowStatus))
    return false
}

const resolveSavedRuntimeReport = async (widget: PreparedWidget, context: CandidatePreparationContext): Promise<void> => {
    const reportCodename = widget.candidate.config.reportCodename
    if (typeof reportCodename !== 'string') {
        context.result.set(widget.candidate.id, state('malformed-config'))
        return
    }

    try {
        const definition = await loadSavedRuntimeReportSource(context.executor, context.scope, reportCodename)
        context.result.set(
            widget.candidate.id,
            effectiveWidgetRuntimeDataSchema.parse({
                status: 'ready',
                data: { kind: 'report', codename: definition.codename, title: semanticText(definition.title, context.locale, 160) }
            })
        )
    } catch (error) {
        context.result.set(widget.candidate.id, errorState(error))
    }
}

const prepareRuntimeWidgetCandidate = async (
    candidate: EffectiveWidgetRuntimeCandidate,
    context: CandidatePreparationContext
): Promise<void> => {
    if (!candidate.isActive) return
    const registryDefinition = getLayoutWidgetDefinition(candidate.widgetKey, candidate.config)
    if (!registryDefinition) return

    const hasTrustedRuntimeActor = context.selection.hasTrustedRuntimeActor
    if (candidate.widgetKey === 'detailsTable' && candidate.config.variant === 'learner-enrollments' && !hasTrustedRuntimeActor) {
        context.result.set(candidate.id, state('permission-denied'))
        return
    }

    const sourceMode = getPlacementSourcePolicy(registryDefinition).sourceMode
    const isSavedReport = candidate.widgetKey === 'detailsTable' && candidate.config.variant === 'report'
    if ((sourceMode === 'none' || sourceMode === 'specialized') && !isSavedReport) return

    const preparedWidget = prepareWidget(candidate)
    if (!('candidate' in preparedWidget)) {
        context.result.set(candidate.id, preparedWidget)
        return
    }

    if (isSavedReport) {
        if (!registerPreparedCandidate(candidate.id, 'malformed-config', context)) return
        if (preparedWidget.bindings.slots.length > 0) {
            context.result.set(candidate.id, state('malformed-config'))
            return
        }
        await resolveSavedRuntimeReport(preparedWidget, context)
        return
    }

    if (isGeneratedRuntimeMenu(preparedWidget)) {
        if (preparedWidget.targets.length > 0) {
            context.result.set(candidate.id, state('malformed-config'))
            return
        }
        if (!registerPreparedCandidate(candidate.id, 'server-error', context)) return
        context.selection.generatedMenus.push(preparedWidget)
        return
    }

    if (preparedWidget.targets.length === 0) {
        context.result.set(candidate.id, state(sourceMode === 'required' ? 'required-missing' : 'optional-unbound'))
        return
    }
    if (!registerPreparedCandidate(candidate.id, 'server-error', context)) return
    context.selection.preparedWidgets.push(preparedWidget)
}

/** Filter inactive, unsupported, untrusted, and unbound placements before any batch source reads. */
const selectEffectiveWidgetCandidates = async (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    widgets: readonly EffectiveWidgetRuntimeCandidate[],
    locale: string,
    result: Map<string, EffectiveWidgetRuntimeData>
): Promise<RuntimeWidgetCandidateSelection> => {
    const selection: CandidateSelectionAccumulator = {
        hasTrustedRuntimeActor: typeof scope.currentUserId === 'string' && isValidUuid(scope.currentUserId),
        preparedWidgets: [],
        generatedMenus: [],
        preparedCount: 0
    }
    const context: CandidatePreparationContext = { executor, scope, locale, result, selection }
    for (const candidate of widgets) {
        await prepareRuntimeWidgetCandidate(candidate, context)
    }
    return selection
}

/** Fail closed before runtime reads when the requested workspace does not belong to this scope. */
const applyRuntimeWorkspacePermissionFilter = (
    scope: EffectiveWidgetRuntimeReadScope,
    selection: RuntimeWidgetCandidateSelection,
    result: Map<string, EffectiveWidgetRuntimeData>
): boolean => {
    if (!selection.preparedWidgets.length && !selection.generatedMenus.length) return true
    const invalidWorkspaceScope =
        (scope.workspacesEnabled && (!scope.workspaceId || !isUuidV7(scope.workspaceId))) ||
        (!scope.workspacesEnabled && scope.workspaceId !== null)
    if (!invalidWorkspaceScope) return true

    for (const widget of [...selection.preparedWidgets, ...selection.generatedMenus]) {
        result.set(widget.candidate.id, state('permission-denied'))
    }
    return false
}

/** Resolve one generated menu payload for every generated-menu placement in the batch. */
const resolveGeneratedMenuBatch = async (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    widgets: readonly PreparedWidget[],
    locale: string,
    result: Map<string, EffectiveWidgetRuntimeData>
): Promise<void> => {
    if (widgets.length === 0) return
    try {
        const source = await loadPublishedDashboardMenuEntities(executor, scope.schemaName)
        const payload = buildGeneratedRuntimeMenu(source, locale, scope.workspacesEnabled, scope.permissions)
        for (const widget of widgets) {
            result.set(widget.candidate.id, payload === null ? state('malformed-config') : projectedDataState(payload, 'menu'))
        }
    } catch (error) {
        const failed = errorState(error)
        for (const widget of widgets) result.set(widget.candidate.id, failed)
    }
}

const loadAuthorizedWidgetMetadataBatch = async (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    widgets: readonly PreparedWidget[],
    result: Map<string, EffectiveWidgetRuntimeData>
): Promise<AuthorizedWidgetMetadataBatch | null> => {
    const metadataRequests = collectBindingMetadataRequests(widgets)
    if (metadataRequests.size > MAX_WIDGET_BINDING_TARGETS * MAX_BOUND_WIDGETS) {
        for (const widget of widgets) result.set(widget.candidate.id, state('malformed-config'))
        return null
    }

    let metadata: RuntimeWidgetBindingMetadata
    try {
        metadata = await loadRuntimeWidgetBindingMetadata(
            executor,
            scope.schemaName,
            new Map([...metadataRequests].map(([codename, components]) => [codename, [...components]]))
        )
    } catch (error) {
        const failed = errorState(error)
        for (const widget of widgets) result.set(widget.candidate.id, failed)
        return null
    }

    const authorizedWidgets: PreparedWidget[] = []
    for (const widget of widgets) {
        if (authorizeWidgetTargets(widget, metadata)) authorizedWidgets.push(widget)
        else result.set(widget.candidate.id, state('stale-source'))
    }
    return { metadata, widgets: authorizedWidgets }
}

const loadWidgetBindingRows = async (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    widget: PreparedWidget,
    metadata: RuntimeWidgetBindingMetadata
): Promise<ResolvedWidgetBindingRead> => {
    const loadedRowsByQuery = new Map<string, RuntimeWidgetBindingRows>()
    let totalLoadedRecords = 0
    const targets = await resolveWidgetBindingTargets(widget.definition, widget.bindings, async (query: RuntimeWidgetBindingQuery) => {
        const object = metadata.objectsByCodename.get(query.target.entityCodename)
        const slot = widget.slotByKey.get(query.slot)
        if (!object || !slot || query.target.entityKind !== 'object') {
            throw new WidgetBindingRuntimeDataError('Widget binding source is unavailable')
        }

        let parentObject: RuntimeWidgetBindingObjectMetadata | undefined
        let parentSlot: PreparedWidgetBindingSlot | undefined
        let parentObjectId: string | undefined
        if (query.kind === 'relation-set') {
            const relation = slot.relation
            const parentTarget = query.selector.parentTarget
            parentSlot = relation ? widget.slotByKey.get(relation.parentSlot) : undefined
            parentObject = metadata.objectsByCodename.get(parentTarget.entityCodename)
            if (parentTarget.entityKind !== 'object' || !parentObject || !parentSlot) {
                throw new WidgetBindingRuntimeDataError('Widget binding relation source is unavailable')
            }
            parentObjectId = String(parentObject.id)
        }

        const cacheKey = JSON.stringify([query, object.id, parentObjectId])
        const cachedRows = loadedRowsByQuery.get(cacheKey)
        if (cachedRows !== undefined) return cachedRows

        const rows = await loadWidgetBindingRuntimeRecords(executor, {
            schemaName: scope.schemaName,
            workspaceId: scope.workspaceId,
            workspacesEnabled: scope.workspacesEnabled,
            currentUserId: scope.currentUserId ?? null,
            permissions: scope.permissions,
            query,
            object,
            components: metadata.componentsByObjectId.get(String(object.id)) ?? [],
            slot,
            ...(parentObject ? { parentObject } : {}),
            ...(parentObject ? { parentComponents: metadata.componentsByObjectId.get(String(parentObject.id)) ?? [] } : {}),
            ...(parentSlot ? { parentSlot } : {}),
            ...(parentObjectId ? { parentObjectId } : {})
        })
        totalLoadedRecords += rows.length
        if (totalLoadedRecords > MAX_RUNTIME_RECORDS_PER_LAYOUT) {
            throw new WidgetBindingRuntimeDataError('Widget binding result exceeds its runtime limit')
        }
        loadedRowsByQuery.set(cacheKey, rows)
        return rows
    })

    const relationRecordVersions = new Map<string, number>()
    if (widget.candidate.widgetKey === 'relationBuilder') {
        for (const rows of loadedRowsByQuery.values()) {
            for (const row of rows) {
                const version = positiveRuntimeRecordVersion(row.data._upl_version)
                if (version !== undefined) relationRecordVersions.set(row.recordId, version)
            }
        }
    }

    const projectionTargets =
        relationRecordVersions.size === 0
            ? targets
            : targets.map((target) => {
                  const recordId = getWidgetBindingRuntimeMutationIdentity(target)?.recordId
                  const version = recordId ? relationRecordVersions.get(recordId) : undefined
                  return version === undefined ? target : withWidgetBindingRuntimeData(target, { ...target.data, _upl_version: version })
              })
    return { targets, projectionTargets }
}

const hasRequiredWidgetProjectionTargets = (widget: PreparedWidget, targets: ResolvedRuntimeWidgetTargets): boolean => {
    if (!targets.length && widget.candidate.widgetKey !== 'detailsTable') return false
    if (widget.candidate.widgetKey === 'menuWidget' && !targets.some((target) => target.slot === 'items')) return false
    return true
}

const dispatchWidgetProjector = async (input: WidgetProjectorInput): Promise<unknown | null> => {
    if (input.kind === 'library') {
        return projectLibraryTable(input.executor, input.scope, input.widget, input.metadata, input.locale)
    }

    const isRecordsTable = isRecordsRuntimeTable(input.widget)
    const allowRowActions =
        isRecordsTable &&
        input.hasTrustedRuntimeActor &&
        (input.scope.permissions?.editContent === true ||
            input.scope.permissions?.createContent === true ||
            input.scope.permissions?.deleteContent === true)
    const allowRowReordering =
        isRecordsTable &&
        input.widget.candidate.config.enableRowReordering === true &&
        input.hasTrustedRuntimeActor &&
        input.scope.permissions?.editContent === true

    if (input.kind === 'records') {
        return projectRecordsTable(
            input.executor,
            input.scope,
            input.widget,
            input.metadata,
            input.locale,
            allowRowActions,
            allowRowReordering
        )
    }

    if (input.widget.candidate.widgetKey === 'learnerPlayer') {
        return projectLearnerPlayer(input.executor, input.scope, input.widget, input.targets, input.locale, input.metadata)
    }

    return projectPayload(input.scope, input.widget, input.targets, input.locale, input.metadata, allowRowActions, allowRowReordering)
}

const projectedDataState = (payload: unknown, emptyKind?: 'menu' | 'table'): EffectiveWidgetRuntimeData => {
    const parsed = effectiveWidgetRuntimeDataSchema.safeParse({ status: 'ready', data: payload })
    if (!parsed.success) return state('malformed-config')
    if (parsed.data.status === 'ready') {
        if (emptyKind === 'menu' && parsed.data.data.kind === 'menu' && parsed.data.data.items.length === 0) {
            return state('empty')
        }
        if (emptyKind === 'table' && parsed.data.data.kind === 'table' && parsed.data.data.rows.length === 0) {
            return state('empty')
        }
    }
    return parsed.data
}

interface AuthorizedWidgetResolutionContext extends WidgetProjectorSharedInput {
    readonly result: Map<string, EffectiveWidgetRuntimeData>
}

const resolveAuthorizedWidget = async (widget: PreparedWidget, context: AuthorizedWidgetResolutionContext): Promise<void> => {
    try {
        if (isLibraryRuntimeTable(widget)) {
            const payload = await dispatchWidgetProjector({
                ...context,
                widget,
                kind: 'library'
            })
            context.result.set(widget.candidate.id, projectedDataState(payload, 'table'))
            return
        }

        if (isRecordsRuntimeTable(widget)) {
            const payload = await dispatchWidgetProjector({
                ...context,
                widget,
                kind: 'records'
            })
            context.result.set(widget.candidate.id, projectedDataState(payload))
            return
        }

        const read = await loadWidgetBindingRows(context.executor, context.scope, widget, context.metadata)
        if (!hasRequiredWidgetProjectionTargets(widget, read.targets)) {
            context.result.set(widget.candidate.id, state('empty'))
            return
        }
        const payload = await dispatchWidgetProjector({
            ...context,
            widget,
            kind: 'bindings',
            targets: read.projectionTargets
        })
        context.result.set(widget.candidate.id, payload === null ? state('malformed-config') : projectedDataState(payload))
    } catch (error) {
        context.result.set(widget.candidate.id, errorState(error))
    }
}

/** Resolve authorized widgets sequentially so all source reads retain the caller's transaction and record budget. */
const resolveAuthorizedWidgetBatch = async (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    widgets: readonly PreparedWidget[],
    metadata: RuntimeWidgetBindingMetadata,
    locale: string,
    hasTrustedRuntimeActor: boolean,
    result: Map<string, EffectiveWidgetRuntimeData>
): Promise<void> => {
    let estimatedRecords = 0
    for (const widget of widgets) {
        estimatedRecords += estimateRecordBudget(widget)
        if (estimatedRecords > MAX_RUNTIME_RECORDS_PER_LAYOUT) {
            result.set(widget.candidate.id, state('server-error'))
            continue
        }
        await resolveAuthorizedWidget(widget, {
            executor,
            scope,
            widget,
            metadata,
            locale,
            hasTrustedRuntimeActor,
            result
        })
    }
}

/** Resolve only registry-bound, live published Entity data inside the already-authorized request transaction. */
export const resolveEffectiveWidgetRuntimeData = async (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    widgets: readonly EffectiveWidgetRuntimeCandidate[],
    locale = 'en'
): Promise<ReadonlyMap<string, EffectiveWidgetRuntimeData>> => {
    const result = new Map<string, EffectiveWidgetRuntimeData>()
    const selection = await selectEffectiveWidgetCandidates(executor, scope, widgets, locale, result)

    if (!selection.preparedWidgets.length && !selection.generatedMenus.length) return result
    if (!applyRuntimeWorkspacePermissionFilter(scope, selection, result)) return result

    await resolveGeneratedMenuBatch(executor, scope, selection.generatedMenus, locale, result)
    if (!selection.preparedWidgets.length) return result

    const metadataBatch = await loadAuthorizedWidgetMetadataBatch(executor, scope, selection.preparedWidgets, result)
    if (!metadataBatch) return result

    await resolveAuthorizedWidgetBatch(
        executor,
        scope,
        metadataBatch.widgets,
        metadataBatch.metadata,
        locale,
        selection.hasTrustedRuntimeActor,
        result
    )
    return result
}
