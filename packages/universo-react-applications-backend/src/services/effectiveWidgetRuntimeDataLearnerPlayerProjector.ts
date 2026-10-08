import {
    getLayoutWidgetDefinition,
    MAX_WIDGET_BINDING_RESOLVED_RECORDS,
    pageBlockContentSchema,
    type WidgetBindingTarget
} from '@universo-react/types'
import { isUuidV7, resolveApplicationLifecycleContractFromConfig, type DbExecutor } from '@universo-react/utils'
import { qSchema } from '@universo-react/database'
import { loadRuntimeWidgetBindingMetadata, loadWidgetBindingRuntimeRecords } from '../persistence/widgetBindingRuntimeStore'
import type { EffectiveWidgetRuntimeReadScope } from './effectiveWidgetRuntimeDataContracts'
import { getWidgetBindingRuntimeMutationIdentity, type ResolvedWidgetBindingTarget } from './widgetBindingResolver'
import { loadRuntimeRowByIdWithRecordAccess, readRuntimeRecordParentAccessConfigs } from './runtimeRowSupport/access'
import {
    findRuntimeAttrByFieldKey,
    readRuntimeAttrValue,
    resolveRuntimeObjectCollectionByCodename
} from './runtimeRowSupport/objectMetadata'
import {
    readRuntimeProgressSequencePolicy,
    resolveProgressStoreBinding,
    resolveRuntimeProgressItemStates
} from './runtimeRowSupport/progress'
import { buildRuntimeActiveRowCondition, quoteIdentifier } from '../shared/runtimeHelpers'
import { isRecord, semanticText, SEMANTIC_KEY_PATTERN, type PreparedWidget } from './effectiveWidgetRuntimeDataProjectionShared'
import { issueRuntimeRecordHandle } from './runtimeRecordHandle'

const LEARNER_PLAYER_TARGET_CODENAMES = new Set(['LearningResources', 'Quizzes', 'Courses'])

const loadLearnerPlayerTargetBlocks = async (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    targetObjectCodename: string,
    targetRecordId: string,
    objectCache: Map<string, Awaited<ReturnType<typeof resolveRuntimeObjectCollectionByCodename>>>
) => {
    if (!LEARNER_PLAYER_TARGET_CODENAMES.has(targetObjectCodename) || !isUuidV7(targetRecordId) || !scope.permissions) return null
    let object = objectCache.get(targetObjectCodename)
    if (object === undefined) {
        object = await resolveRuntimeObjectCollectionByCodename(executor, qSchema(scope.schemaName), targetObjectCodename)
        objectCache.set(targetObjectCodename, object)
    }
    if (!object) return null

    const row = await loadRuntimeRowByIdWithRecordAccess({
        manager: executor,
        schemaIdent: qSchema(scope.schemaName),
        dataTableIdent: `${qSchema(scope.schemaName)}.${quoteIdentifier(object.tableName)}`,
        currentWorkspaceId: scope.workspaceId,
        currentUserId: scope.currentUserId ?? null,
        permissions: scope.permissions,
        objectCodename: object.codename,
        attrs: object.attrs,
        config: object.config,
        rowId: targetRecordId,
        rowCondition: buildRuntimeActiveRowCondition(
            resolveApplicationLifecycleContractFromConfig(object.config),
            object.config,
            undefined,
            scope.workspaceId
        ),
        minimumAccessLevel: 'read'
    })
    if (!row) return null
    if (targetObjectCodename !== 'LearningResources') return []

    const bodyAttr = findRuntimeAttrByFieldKey(object.attrs, 'Body')
    if (!bodyAttr) return null
    const body = readRuntimeAttrValue(row, bodyAttr)
    if (body === null || body === undefined) return []
    const blockContent = pageBlockContentSchema.safeParse(body)
    return blockContent.success ? blockContent.data.blocks ?? blockContent.data.data?.blocks ?? [] : null
}

type LearnerPlayerSlot = NonNullable<NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>['bindingSlots']>[number]

const getLearnerPlayerSlotProjection = (slot: LearnerPlayerSlot) =>
    slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))

const loadLearnerPlayerCourseItems = async (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    courseRecordIds: readonly string[]
) => {
    if (courseRecordIds.length === 0 || courseRecordIds.length > MAX_WIDGET_BINDING_RESOLVED_RECORDS) return null

    const courseDefinition = getLayoutWidgetDefinition('learnerPlayer', { variant: 'course' })
    const parentSlot = courseDefinition?.bindingSlots?.find(({ key }) => key === 'parent')
    const itemsSlot = courseDefinition?.bindingSlots?.find(({ key }) => key === 'items')
    const relation = itemsSlot?.relation
    const relationComponent = relation?.field ? itemsSlot?.requirements.components.find(({ field }) => field === relation.field) : undefined
    const orderComponent = itemsSlot?.orderByField
        ? itemsSlot.requirements.components.find(({ field }) => field === itemsSlot.orderByField)
        : undefined
    if (!parentSlot || !itemsSlot || !relation || !relationComponent || !orderComponent) return null

    const nestedMetadata = await loadRuntimeWidgetBindingMetadata(
        executor,
        scope.schemaName,
        new Map([
            ['Courses', parentSlot.requirements.components.map(({ componentCodename }) => componentCodename)],
            ['CourseItems', itemsSlot.requirements.components.map(({ componentCodename }) => componentCodename)]
        ])
    )
    const courseObject = nestedMetadata.objectsByCodename.get('Courses')
    const courseItemsObject = nestedMetadata.objectsByCodename.get('CourseItems')
    if (!courseObject || !courseItemsObject || !isUuidV7(String(courseObject.id)) || !isUuidV7(String(courseItemsObject.id))) {
        return null
    }

    const courseTarget: WidgetBindingTarget = {
        entityKind: 'object',
        entityCodename: 'Courses',
        selector: { kind: 'record-set' },
        projection: getLearnerPlayerSlotProjection(parentSlot)
    }
    const courseItemsTarget: WidgetBindingTarget = {
        entityKind: 'object',
        entityCodename: 'CourseItems',
        selector: { kind: 'relation-set', parentSlot: parentSlot.key },
        projection: getLearnerPlayerSlotProjection(itemsSlot)
    }

    return loadWidgetBindingRuntimeRecords(executor, {
        schemaName: scope.schemaName,
        workspaceId: scope.workspaceId,
        workspacesEnabled: scope.workspacesEnabled,
        currentUserId: scope.currentUserId ?? null,
        permissions: scope.permissions,
        query: {
            kind: 'relation-set',
            target: courseItemsTarget,
            slot: itemsSlot.key,
            projection: courseItemsTarget.projection,
            selector: {
                relationComponentCodename: relationComponent.componentCodename,
                parentRecordIds: courseRecordIds,
                parentTarget: courseTarget
            },
            ordered: {
                orderByComponentCodename: orderComponent.componentCodename,
                limit: itemsSlot.maxResolvedRecords ?? MAX_WIDGET_BINDING_RESOLVED_RECORDS
            }
        },
        object: courseItemsObject,
        components: nestedMetadata.componentsByObjectId.get(String(courseItemsObject.id)) ?? [],
        slot: itemsSlot,
        parentObject: courseObject,
        parentComponents: nestedMetadata.componentsByObjectId.get(String(courseObject.id)) ?? [],
        parentSlot,
        parentObjectId: String(courseObject.id)
    })
}

const resolveTrackStepContent = async (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    itemTargets: readonly { target: ResolvedWidgetBindingTarget; recordId: string }[],
    objectCache: Map<string, Awaited<ReturnType<typeof resolveRuntimeObjectCollectionByCodename>>>
) => {
    const courseIds = [
        ...new Set(
            itemTargets
                .map(({ target }) => target.data.targetRecordId)
                .filter((value): value is string => typeof value === 'string' && isUuidV7(value))
        )
    ]
    const readableCourseIds = new Set<string>()
    for (const courseId of courseIds) {
        const course = await loadLearnerPlayerTargetBlocks(executor, scope, 'Courses', courseId, objectCache)
        if (course !== null) readableCourseIds.add(courseId)
    }

    const courseItems = readableCourseIds.size > 0 ? await loadLearnerPlayerCourseItems(executor, scope, [...readableCourseIds]) : []
    const contentByCourseId = new Map<string, { blocks: unknown[]; usable: boolean; itemCount: number }>()
    for (const courseId of courseIds) {
        contentByCourseId.set(courseId, { blocks: [], usable: readableCourseIds.has(courseId), itemCount: 0 })
    }

    if (courseItems === null) {
        for (const content of contentByCourseId.values()) content.usable = false
    } else {
        for (const courseItem of courseItems) {
            const courseId = courseItem.data.parent
            if (typeof courseId !== 'string') continue
            const content = contentByCourseId.get(courseId)
            if (!content) continue
            content.itemCount += 1

            const targetObjectCodename = courseItem.data.targetObjectCodename
            const targetRecordId = courseItem.data.targetRecordId
            if (typeof targetObjectCodename !== 'string' || typeof targetRecordId !== 'string' || !isUuidV7(targetRecordId)) {
                content.usable = false
                continue
            }
            const blocks = await loadLearnerPlayerTargetBlocks(executor, scope, targetObjectCodename, targetRecordId, objectCache)
            if (blocks === null || blocks.length === 0 || content.blocks.length + blocks.length > 256) {
                content.usable = false
                content.blocks = []
                continue
            }
            content.blocks.push(...blocks)
        }
        for (const content of contentByCourseId.values()) {
            if (content.itemCount === 0 || content.blocks.length === 0) content.usable = false
        }
    }

    return new Map(
        itemTargets.map(({ target, recordId }) => {
            const courseId = target.data.targetRecordId
            const content = typeof courseId === 'string' ? contentByCourseId.get(courseId) : undefined
            return [recordId, { blocks: content?.blocks ?? [], usable: content?.usable === true }] as const
        })
    )
}

export const projectLearnerPlayer = async (
    executor: DbExecutor,
    scope: EffectiveWidgetRuntimeReadScope,
    widget: PreparedWidget,
    targets: readonly ResolvedWidgetBindingTarget[],
    locale: string,
    metadata: Awaited<ReturnType<typeof loadRuntimeWidgetBindingMetadata>>
) => {
    if (targets.some((target) => target.slot !== 'parent' && target.slot !== 'items')) return null
    if (!scope.applicationId) return null
    const applicationId = scope.applicationId
    const parentTargets = targets.filter((target) => target.slot === 'parent')
    const parentRecordIdsByKey = new Map<string, string>()
    const parents = parentTargets.map((target) => {
        const key = target.semanticKey
        const label = semanticText(target.data.title, locale, 160).trim()
        const recordId = getWidgetBindingRuntimeMutationIdentity(target)?.recordId
        if (typeof key !== 'string' || !SEMANTIC_KEY_PATTERN.test(key) || !label || !recordId || !isUuidV7(recordId)) return null
        parentRecordIdsByKey.set(key, recordId)
        return {
            key,
            label,
            target: {
                entityCodename: target.entityCodename,
                recordHandle: issueRuntimeRecordHandle({
                    applicationId,
                    workspaceId: scope.workspaceId,
                    entityCodename: target.entityCodename,
                    recordId
                })
            }
        }
    })
    if (parents.some((parent) => parent === null)) return null
    const resolvedParents = parents as Array<NonNullable<(typeof parents)[number]>>
    const parentKeys = new Set(resolvedParents.map(({ key }) => key))
    const variant = widget.candidate.config.variant
    if (variant !== 'course' && variant !== 'track') return null
    const itemTargets = targets.filter((candidate) => candidate.slot === 'items')
    const progressObjectCodename = variant === 'course' ? 'CourseItems' : 'TrackSteps'
    const resolvedItemTargets: Array<{ target: ResolvedWidgetBindingTarget; recordId: string }> = []
    for (const target of itemTargets) {
        const recordId = getWidgetBindingRuntimeMutationIdentity(target)?.recordId
        if (target.entityCodename !== progressObjectCodename || !recordId || !isUuidV7(recordId)) return null
        resolvedItemTargets.push({ target, recordId })
    }
    const progressObject = metadata.objectsByCodename.get(progressObjectCodename)
    if (!progressObject) return null
    const progressSequencePolicy = readRuntimeProgressSequencePolicy(isRecord(progressObject.config) ? progressObject.config : null)
    const scopeFieldCodename =
        progressSequencePolicy && !progressSequencePolicy.invalid ? progressSequencePolicy.sequencePolicy.scopeFieldCodename : undefined
    if (scopeFieldCodename) {
        const definition = getLayoutWidgetDefinition('learnerPlayer', widget.candidate.config)
        const itemsSlot = definition?.bindingSlots?.find(({ key }) => key === 'items')
        const relationField = itemsSlot?.relation?.field
        const relationComponentCodename = relationField
            ? itemsSlot?.requirements.components.find(({ field }) => field === relationField)?.componentCodename
            : undefined
        const parentAccessConfigs = readRuntimeRecordParentAccessConfigs(isRecord(progressObject.config) ? progressObject.config : null)
        const expectedParentObjectCodename = variant === 'course' ? 'Courses' : 'LearningTracks'
        if (!parentAccessConfigs || parentAccessConfigs.length !== 1) return null
        const [parentAccess] = parentAccessConfigs
        if (
            !parentAccess ||
            !relationComponentCodename ||
            relationComponentCodename !== scopeFieldCodename ||
            parentAccess.mode !== 'parentRecord' ||
            parentAccess.parentFieldCodename !== scopeFieldCodename ||
            parentAccess.parentObjectCodename !== expectedParentObjectCodename ||
            resolvedParents.some(({ target }) => target.entityCodename !== expectedParentObjectCodename)
        ) {
            return null
        }
    }
    const progressBinding = await resolveProgressStoreBinding(executor, qSchema(scope.schemaName), scope.applicationSettings)
    const progressItems = resolvedItemTargets.map(({ target, recordId }) => ({
        id: recordId,
        order: typeof target.data.order === 'number' && Number.isFinite(target.data.order) ? target.data.order : undefined,
        ...(scopeFieldCodename
            ? { scopeKey: typeof target.parentSemanticKey === 'string' ? parentRecordIdsByKey.get(target.parentSemanticKey) : undefined }
            : {})
    }))
    if (scopeFieldCodename && progressItems.some((item) => !item.scopeKey)) return null
    const progressStates = await resolveRuntimeProgressItemStates({
        manager: executor,
        currentWorkspaceId: scope.workspaceId,
        workspacesEnabled: scope.workspacesEnabled,
        userId: scope.currentUserId ?? null,
        binding: progressBinding,
        targetObjectCodename: progressObjectCodename,
        targetObjectConfig: isRecord(progressObject.config) ? progressObject.config : null,
        items: progressItems
    })
    const objectCache = new Map<string, Awaited<ReturnType<typeof resolveRuntimeObjectCollectionByCodename>>>()
    const trackStepContent = variant === 'track' ? await resolveTrackStepContent(executor, scope, resolvedItemTargets, objectCache) : null
    const items = []
    for (const { target, recordId } of resolvedItemTargets) {
        const key = target.semanticKey
        const title = semanticText(target.data.title, locale, 160).trim()
        const targetObjectCodename = variant === 'course' ? target.data.targetObjectCodename : 'Courses'
        const targetRecordId = target.data.targetRecordId
        if (
            typeof key !== 'string' ||
            !SEMANTIC_KEY_PATTERN.test(key) ||
            !title ||
            !target.parentSemanticKey ||
            !parentKeys.has(target.parentSemanticKey) ||
            typeof targetObjectCodename !== 'string' ||
            typeof targetRecordId !== 'string' ||
            !isUuidV7(targetRecordId)
        ) {
            return null
        }
        const trackContent = variant === 'track' ? trackStepContent?.get(recordId) : undefined
        const blocks =
            variant === 'track'
                ? trackContent?.blocks ?? []
                : await loadLearnerPlayerTargetBlocks(executor, scope, targetObjectCodename, targetRecordId, objectCache)
        if (blocks === null) return null
        const progress = progressStates.get(recordId)
        if (!progress) return null
        const contentUsable = variant === 'course' || trackContent?.usable === true
        items.push({
            key,
            parentKey: target.parentSemanticKey,
            title,
            blocks,
            progressTarget: {
                objectCodename: progressObjectCodename,
                recordHandle: issueRuntimeRecordHandle({
                    applicationId,
                    workspaceId: scope.workspaceId,
                    entityCodename: progressObjectCodename,
                    recordId
                })
            },
            availability: contentUsable ? progress.availability : 'locked',
            ...(contentUsable && progress.progressPercent !== undefined ? { progressPercent: progress.progressPercent } : {})
        })
    }
    return { kind: 'learner-player' as const, parents, items }
}
