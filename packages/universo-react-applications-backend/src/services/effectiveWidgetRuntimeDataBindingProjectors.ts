import { resourceSourceSchema } from '@universo-react/types'
import { isUuidV7 } from '@universo-react/utils'
import type { loadRuntimeWidgetBindingMetadata } from '../persistence/widgetBindingRuntimeStore'
import { getWidgetBindingRuntimeMutationIdentity, type ResolvedWidgetBindingTarget } from './widgetBindingResolver'
import { issueRuntimeRecordHandle } from './runtimeRecordHandle'
import type { EffectiveWidgetRuntimeReadScope } from './effectiveWidgetRuntimeDataContracts'
import {
    isRecord,
    positiveRuntimeRecordVersion,
    semanticText,
    SEMANTIC_KEY_PATTERN,
    UUID_TEXT_PATTERN,
    type PreparedWidget,
    type RuntimeRecord
} from './effectiveWidgetRuntimeDataProjectionShared'

const MAX_RELATION_DISPLAY_FIELDS = 8
const MAX_RELATION_DISPLAY_VALUE_LENGTH = 240

const isJsonContainerText = (value: string): boolean => {
    const trimmed = value.trim()
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
    try {
        const parsed: unknown = JSON.parse(trimmed)
        return Boolean(parsed && typeof parsed === 'object')
    } catch {
        return false
    }
}

const relationDisplayText = (value: unknown, valueType: 'string' | 'number' | 'boolean', locale: string): string => {
    if (valueType === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) return ''
    if (valueType === 'boolean' && typeof value !== 'boolean') return ''
    if (valueType === 'string' && typeof value !== 'string' && !isRecord(value)) return ''
    const text = semanticText(value, locale, MAX_RELATION_DISPLAY_VALUE_LENGTH + 1).trim()
    if (!text || UUID_TEXT_PATTERN.test(text) || isJsonContainerText(text)) return ''
    return text.slice(0, MAX_RELATION_DISPLAY_VALUE_LENGTH)
}

interface RelationDisplayFieldConfig {
    readonly fieldCodename: string
    readonly valueType: 'string' | 'number' | 'boolean'
}

interface RelationDisplayColumn extends RelationDisplayFieldConfig {
    readonly key: string
    readonly label: string
}

const readRelationDisplayFields = (panel: RuntimeRecord): readonly RelationDisplayFieldConfig[] | null => {
    if (panel.displayFields === undefined) return []
    if (!Array.isArray(panel.displayFields) || panel.displayFields.length > MAX_RELATION_DISPLAY_FIELDS) return null
    const fields: RelationDisplayFieldConfig[] = []
    for (const value of panel.displayFields) {
        if (!isRecord(value)) return null
        const { fieldCodename, valueType } = value
        if (typeof fieldCodename !== 'string' || (valueType !== 'string' && valueType !== 'number' && valueType !== 'boolean')) {
            return null
        }
        fields.push({ fieldCodename, valueType })
    }
    return fields
}

const projectRelationDisplayColumns = (
    widget: PreparedWidget,
    panel: RuntimeRecord,
    targetEntityCodename: string,
    metadata: Awaited<ReturnType<typeof loadRuntimeWidgetBindingMetadata>>,
    locale: string
): RelationDisplayColumn[] | null => {
    const displayFields = readRelationDisplayFields(panel)
    if (!displayFields) return null
    if (displayFields.length === 0) return []

    const slotKey = typeof panel.slotKey === 'string' ? panel.slotKey : ''
    const slot = widget.slotByKey.get(slotKey)
    const boundTargets = widget.bindings.slots.find(({ slot: key }) => key === slotKey)?.targets ?? []
    const boundTarget = boundTargets.length === 1 ? boundTargets[0] : undefined
    const object = metadata.objectsByCodename.get(targetEntityCodename)
    if (!slot || !boundTarget || boundTarget.selector.kind !== 'relation-set' || !object) return null
    const components = metadata.componentsByObjectId.get(String(object.id)) ?? []

    const columns = displayFields.map((field, index): RelationDisplayColumn | null => {
        const key = `display${index + 1}`
        const requirement = slot.requirements.components.find(
            ({ field: requirementField, componentCodename }) => requirementField === key && componentCodename === field.fieldCodename
        )
        const authorizedProjection = boundTarget.projection.some(
            ({ field: projectionField, componentCodename }) => projectionField === key && componentCodename === field.fieldCodename
        )
        if (!requirement || !authorizedProjection) return null

        const component = components.find(({ codename }) => String(codename) === field.fieldCodename)
        const name = isRecord(component?.presentation) ? component.presentation.name : undefined
        const label = semanticText(name, locale, 120).trim()
        if (!label || UUID_TEXT_PATTERN.test(label) || isJsonContainerText(label)) return null
        return { key, label, ...field }
    })
    return columns.some((column) => column === null) ? null : (columns as RelationDisplayColumn[])
}

export const projectResource = (value: unknown): ReturnType<typeof resourceSourceSchema.parse> | null => {
    let candidate: unknown = value
    if (typeof candidate === 'string') {
        try {
            candidate = JSON.parse(candidate)
        } catch {
            candidate = { type: 'url', url: candidate }
        }
    }
    if (!isRecord(candidate) || 'packageDescriptor' in candidate) return null
    const allowlisted = {
        ...(typeof candidate.type === 'string' ? { type: candidate.type } : {}),
        ...(typeof candidate.url === 'string' ? { url: candidate.url } : {}),
        ...(typeof candidate.pageCodename === 'string' ? { pageCodename: candidate.pageCodename } : {}),
        ...(typeof candidate.storageKey === 'string' ? { storageKey: candidate.storageKey } : {}),
        ...(typeof candidate.mimeType === 'string' ? { mimeType: candidate.mimeType } : {}),
        ...(candidate.launchMode === 'inline' || candidate.launchMode === 'newTab' || candidate.launchMode === 'download'
            ? { launchMode: candidate.launchMode }
            : {})
    }
    const parsed = resourceSourceSchema.safeParse(allowlisted)
    return parsed.success ? parsed.data : null
}

export const projectTable = (
    scope: EffectiveWidgetRuntimeReadScope,
    widget: PreparedWidget,
    targets: readonly ResolvedWidgetBindingTarget[],
    locale: string,
    metadata: Awaited<ReturnType<typeof loadRuntimeWidgetBindingMetadata>>,
    allowRowActions: boolean,
    allowRowReordering: boolean
) => {
    const slot = widget.slotByKey.get('rows')
    if (!slot || targets.some((target) => target.slot !== 'rows')) return null
    const firstTarget = targets[0]
    const sourceCodename =
        firstTarget?.entityCodename ?? widget.bindings.slots.find(({ slot }) => slot === 'rows')?.targets[0]?.entityCodename
    const sourceObject = sourceCodename ? metadata.objectsByCodename.get(sourceCodename) : undefined
    if (!sourceObject) return null
    const componentMetadata = metadata.componentsByObjectId.get(String(sourceObject.id)) ?? []
    const isLearnerEnrollmentTable = widget.candidate.config.variant === 'learner-enrollments'
    if (
        isLearnerEnrollmentTable &&
        (sourceCodename !== 'Enrollments' || targets.some((target) => target.entityCodename !== 'Enrollments'))
    ) {
        return null
    }
    const visibleRequirements = isLearnerEnrollmentTable
        ? slot.requirements.components.filter(({ field }) => field === 'title')
        : slot.requirements.components
    if (isLearnerEnrollmentTable && visibleRequirements.length !== 1) return null
    const columns = visibleRequirements.map(({ field, componentCodename, valueType }) => {
        const component = componentMetadata.find(({ codename }) => codename === componentCodename)
        const name = isRecord(component?.presentation) ? component.presentation.name : undefined
        const label = semanticText(name, locale, 120).trim()
        return label && valueType !== 'json' && valueType !== 'ref' ? { key: field, label, valueType } : null
    })
    if (columns.some((column) => column === null)) return null
    const resolvedColumns = columns.filter(
        (column): column is { key: string; label: string; valueType: 'string' | 'number' | 'boolean' } => column !== null
    )
    if (!resolvedColumns.length || new Set(resolvedColumns.map(({ key }) => key)).size !== resolvedColumns.length) return null
    const maxRows = typeof widget.candidate.config.maxRows === 'number' ? Math.min(widget.candidate.config.maxRows, 1000) : 1000
    const boundTargets = widget.bindings.slots.find(({ slot: key }) => key === 'rows')?.targets ?? []
    const mutationTargets = targets.map((target) => {
        const identity = getWidgetBindingRuntimeMutationIdentity(target)
        const version = positiveRuntimeRecordVersion(identity?.version)
        if (
            !identity ||
            !sourceCodename ||
            target.entityKind !== 'object' ||
            target.entityCodename !== sourceCodename ||
            !isUuidV7(identity.recordId) ||
            version === undefined
        ) {
            return undefined
        }
        if (!scope.applicationId) return undefined
        return {
            recordHandle: issueRuntimeRecordHandle({
                applicationId: scope.applicationId,
                workspaceId: scope.workspaceId,
                entityCodename: target.entityCodename,
                recordId: identity.recordId
            }),
            entityCodename: target.entityCodename,
            version
        }
    })
    const actionTargets = targets.map((target) => {
        const recordId = getWidgetBindingRuntimeMutationIdentity(target)?.recordId
        if (
            !allowRowActions ||
            !sourceCodename ||
            target.entityKind !== 'object' ||
            target.entityCodename !== sourceCodename ||
            !recordId ||
            !isUuidV7(recordId)
        ) {
            return undefined
        }
        if (!scope.applicationId) return undefined
        return {
            recordHandle: issueRuntimeRecordHandle({
                applicationId: scope.applicationId,
                workspaceId: scope.workspaceId,
                entityCodename: target.entityCodename,
                recordId
            }),
            entityCodename: target.entityCodename
        }
    })
    const hasCompleteReorderTargetSet =
        allowRowReordering &&
        typeof sourceCodename === 'string' &&
        boundTargets.length === 1 &&
        targets.length <= maxRows &&
        mutationTargets.every((target) => target !== undefined)
    const rows = targets.slice(0, maxRows).map((target, index) => {
        const mutationTarget = hasCompleteReorderTargetSet ? mutationTargets[index] : undefined
        const actionTarget = actionTargets[index]
        return {
            key: target.semanticKey,
            ...(mutationTarget ? { mutationTarget } : {}),
            ...(actionTarget ? { actionTarget } : {}),
            cells: resolvedColumns.map(({ key }) => ({ key, value: semanticText(target.data[key], locale, 2000) }))
        }
    })
    return {
        kind: 'table' as const,
        columns: resolvedColumns,
        rows,
        ...(hasCompleteReorderTargetSet
            ? {
                  sourceEntityCodename: sourceCodename,
                  pagination: { total: targets.length, limit: maxRows, offset: 0, complete: true as const }
              }
            : {})
    }
}

export const projectSeries = (widget: PreparedWidget, targets: readonly ResolvedWidgetBindingTarget[], locale: string) => {
    if (targets.some((target) => target.slot !== 'series')) return null
    const bySeries = new Map<string, { seriesLabel: string; points: Array<{ label: string; value: number; order: number }> }>()
    for (const target of targets) {
        const seriesKey = target.data.seriesKey
        const seriesLabel = semanticText(target.data.seriesLabel, locale, 160).trim()
        const pointLabel = semanticText(target.data.timestamp, locale, 120)
        const value = target.data.value
        if (
            typeof seriesKey !== 'string' ||
            !SEMANTIC_KEY_PATTERN.test(seriesKey) ||
            !seriesLabel ||
            !pointLabel ||
            typeof value !== 'number' ||
            !Number.isFinite(value)
        ) {
            return null
        }
        const entry = bySeries.get(seriesKey)
        if (entry && entry.seriesLabel !== seriesLabel) return null
        const points = entry?.points ?? []
        points.push({ label: pointLabel, value, order: typeof target.data.order === 'number' ? target.data.order : points.length })
        bySeries.set(seriesKey, { seriesLabel, points })
    }
    if (bySeries.size === 0 || bySeries.size > 8) return null

    const seriesEntries = [...bySeries.entries()].map(
        ([key, entry]) =>
            [
                key,
                entry.seriesLabel,
                entry.points.sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
            ] as const
    )
    const labels = seriesEntries[0]?.[2].map(({ label }) => label) ?? []
    if (
        seriesEntries.some(
            ([, , points]) => points.length !== labels.length || points.some((point, index) => point.label !== labels[index])
        )
    ) {
        return null
    }
    const series = seriesEntries.map(([key, seriesLabel, points]) => ({
        id: key.slice(0, 64),
        label: seriesLabel,
        values: points.map(({ value }) => value)
    }))
    return {
        kind: 'series' as const,
        title: semanticText(widget.candidate.config.title, locale, 160),
        labels,
        series
    }
}

export const projectMetrics = (widget: PreparedWidget, targets: readonly ResolvedWidgetBindingTarget[], locale: string) => {
    if (targets.some((target) => target.slot !== 'metrics')) return null
    const maxCards = typeof widget.candidate.config.maxCards === 'number' ? Math.min(widget.candidate.config.maxCards, 8) : 8
    const cards = []
    for (const target of targets.slice(0, maxCards)) {
        const metricKey = target.data.metricKey
        const label = semanticText(target.data.title, locale, 120).trim()
        const value = target.data.value
        if (
            typeof metricKey !== 'string' ||
            !SEMANTIC_KEY_PATTERN.test(metricKey) ||
            !label ||
            typeof value !== 'number' ||
            !Number.isFinite(value)
        ) {
            return null
        }
        const trendLabel = semanticText(target.data.interval, locale, 80).trim()
        cards.push({
            label,
            value: String(value).slice(0, 80),
            ...(trendLabel ? { trendLabel } : {})
        })
    }
    return { kind: 'metrics' as const, cards }
}

export const projectRelation = (
    scope: EffectiveWidgetRuntimeReadScope,
    widget: PreparedWidget,
    targets: readonly ResolvedWidgetBindingTarget[],
    locale: string,
    metadata: Awaited<ReturnType<typeof loadRuntimeWidgetBindingMetadata>>
) => {
    const panels = Array.isArray(widget.candidate.config.panels) ? widget.candidate.config.panels : null
    if (!panels) return null
    const panelSlots = new Set<string>()
    for (const panel of panels) {
        if (!isRecord(panel) || typeof panel.slotKey !== 'string' || panelSlots.has(panel.slotKey)) return null
        panelSlots.add(panel.slotKey)
    }
    if (targets.some((target) => target.slot !== 'parent' && !panelSlots.has(target.slot))) return null

    const parents = targets
        .filter((target) => target.slot === 'parent')
        .map((target) => {
            const label = semanticText(target.data.title, locale, 160).trim()
            const recordId = getWidgetBindingRuntimeMutationIdentity(target)?.recordId
            if (!label || !recordId || !isUuidV7(recordId)) return null
            if (!scope.applicationId) return null
            return {
                key: target.semanticKey,
                label,
                target: {
                    entityCodename: target.entityCodename,
                    recordHandle: issueRuntimeRecordHandle({
                        applicationId: scope.applicationId,
                        workspaceId: scope.workspaceId,
                        entityCodename: target.entityCodename,
                        recordId
                    })
                }
            }
        })
    if (parents.some((parent) => parent === null)) return null

    const projectedPanels = [...panels]
        .sort((left, right) => {
            const leftOrder = isRecord(left) && typeof left.order === 'number' ? left.order : 0
            const rightOrder = isRecord(right) && typeof right.order === 'number' ? right.order : 0
            return leftOrder - rightOrder
        })
        .map((panel) => {
            if (!isRecord(panel) || typeof panel.slotKey !== 'string') return null
            const title = semanticText(panel.title, locale, 160).trim()
            const parentFieldCodename = typeof panel.parentFieldCodename === 'string' ? panel.parentFieldCodename.trim() : ''
            const panelBindingTargets = widget.targets.filter(({ slot }) => slot === panel.slotKey).map(({ target }) => target)
            const targetEntityCodename = panelBindingTargets.length === 1 ? panelBindingTargets[0]?.entityCodename : undefined
            if (!title || !parentFieldCodename || !targetEntityCodename) return null
            const displayColumns = projectRelationDisplayColumns(widget, panel, targetEntityCodename, metadata, locale)
            if (!displayColumns) return null
            const rows = targets
                .filter((target) => target.slot === panel.slotKey)
                .map((target) => {
                    const label = semanticText(target.data.title, locale, 160).trim()
                    if (!target.parentSemanticKey || !label) {
                        return null
                    }
                    const recordId = getWidgetBindingRuntimeMutationIdentity(target)?.recordId
                    const version = positiveRuntimeRecordVersion(target.data._upl_version)
                    if (!recordId || !isUuidV7(recordId) || version === undefined) return null
                    if (!scope.applicationId) return null
                    const row = {
                        key: target.semanticKey,
                        parentKey: target.parentSemanticKey,
                        label,
                        target: {
                            entityCodename: target.entityCodename,
                            recordHandle: issueRuntimeRecordHandle({
                                applicationId: scope.applicationId,
                                workspaceId: scope.workspaceId,
                                entityCodename: target.entityCodename,
                                recordId
                            }),
                            version
                        }
                    }
                    return displayColumns.length
                        ? {
                              ...row,
                              cells: displayColumns.map(({ key, valueType }) => ({
                                  key,
                                  value: relationDisplayText(target.data[key], valueType, locale)
                              }))
                          }
                        : row
                })
            if (rows.some((row) => row === null)) return null
            return {
                slotKey: panel.slotKey,
                title,
                targetEntityCodename,
                parentFieldCodename,
                ...(displayColumns.length
                    ? { displayColumns: displayColumns.map(({ key, label: columnLabel }) => ({ key, label: columnLabel })) }
                    : {}),
                rows
            }
        })
    if (projectedPanels.some((panel) => panel === null)) return null
    return { kind: 'relation' as const, parents, panels: projectedPanels }
}
