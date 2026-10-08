import { qSchemaTable } from '@universo-react/database'
import stableStringify from 'json-stable-stringify'
import {
    encodeLayoutWidgetConfigEnvelope,
    applicationLayoutZoneSchema,
    getLayoutWidgetDefinition,
    type ApplicationLayoutWidget,
    type ApplicationLayoutWidgetConfigBatchMutation,
    type ApplicationLayoutWidgetConfigMutation,
    type ApplicationLayoutWidgetResetBatchMutation
} from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import {
    assertInterpretationNetworkSingleSystemTransitionAllowed,
    lockInterpretationNetworkStructureMode
} from '../shared/interpretationNetworkStructureModeGuard'
import {
    applicationLayoutWidgetSourceStatesEqual,
    createApplicationLayoutWidgetSourceState,
    parseApplicationLayoutWidgetSourceState
} from '../services/applicationLayoutWidgetSourceState'
import {
    strictApplicationLayoutWidgetConfigBatchMutationSchema,
    strictApplicationLayoutWidgetConfigMutationSchema,
    strictApplicationLayoutWidgetResetBatchMutationSchema
} from '../validation/applicationLayoutMutationSchemas'
import { classifyPlacementLineage, resolvePlacementBindingValidation } from './applicationLayoutWidgetPlacement'
import { mapWidgetWithCanonicalSourceState, refreshLayoutLocalContentHash } from './applicationLayoutWidgetMutationSupport'
import {
    applicationLayoutWidgetPredicate,
    assertApplicationLayoutWidgetConfig,
    assertRendererConfigInput,
    copyApplicationLayoutWidgetSourceBindingState,
    encodeWidgetConfigForStorage,
    getWidgetPlacement,
    isRecord,
    lockApplicationLayoutMutation,
    readWidgetConfigEnvelope,
    runApplicationLayoutTransaction,
    validateApplicationLayoutWidgetGraph,
    type ApplicationLayoutWidgetWithPlacement,
    type WidgetRow
} from './applicationLayoutStoreSupport'

const MISSING_CONFIG_VALUE = Symbol('missing-config-value')

const configValuesEqual = (left: unknown, right: unknown): boolean =>
    left === MISSING_CONFIG_VALUE || right === MISSING_CONFIG_VALUE ? left === right : stableStringify(left) === stableStringify(right)

const collectChangedConfigPaths = (before: unknown, after: unknown, path: string[] = [], changedPaths: string[][] = []): string[][] => {
    if (configValuesEqual(before, after)) return changedPaths

    const beforeIsRecord = before === MISSING_CONFIG_VALUE || isRecord(before)
    const afterIsRecord = after === MISSING_CONFIG_VALUE || isRecord(after)
    if (beforeIsRecord && afterIsRecord) {
        const beforeRecord = isRecord(before) ? before : {}
        const afterRecord = isRecord(after) ? after : {}
        const keys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)])
        if (keys.size === 0) changedPaths.push(path)
        for (const key of keys) {
            collectChangedConfigPaths(
                Object.prototype.hasOwnProperty.call(beforeRecord, key) ? beforeRecord[key] : MISSING_CONFIG_VALUE,
                Object.prototype.hasOwnProperty.call(afterRecord, key) ? afterRecord[key] : MISSING_CONFIG_VALUE,
                [...path, key],
                changedPaths
            )
        }
        return changedPaths
    }

    if (Array.isArray(before) && Array.isArray(after)) {
        if (before.length !== after.length) {
            changedPaths.push(path)
            return changedPaths
        }
        before.forEach((value, index) => collectChangedConfigPaths(value, after[index], [...path, String(index)], changedPaths))
        return changedPaths
    }

    changedPaths.push(path)
    return changedPaths
}

const configFieldPathMatches = (fieldPath: string, changedPath: readonly string[]): boolean => {
    const fieldSegments = fieldPath
        .split('.')
        .flatMap((segment) => segment.match(/[^.[\]]+|\[\]/gu) ?? [])
        .map((segment) => (segment === '[]' ? '*' : segment))
    return (
        fieldSegments.length <= changedPath.length &&
        fieldSegments.every((segment, index) => (segment === '*' ? /^\d+$/u.test(changedPath[index]!) : segment === changedPath[index]))
    )
}

const assertSourceLinkedPresentationConfig = (
    widgetKey: string,
    currentConfig: Record<string, unknown>,
    nextConfig: Record<string, unknown>
): void => {
    const definition = getLayoutWidgetDefinition(widgetKey, currentConfig)
    if (!definition) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
    const presentationFields = definition.configFields.filter(({ owner }) => owner === 'presentation')
    const unauthorizedChange = collectChangedConfigPaths(currentConfig, nextConfig).some(
        (path) => !presentationFields.some(({ path: fieldPath }) => configFieldPathMatches(fieldPath, path))
    )
    if (unauthorizedChange) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
}

export async function updateApplicationLayoutWidgetConfig(
    executor: DbExecutor,
    schemaName: string,
    layoutId: string,
    widgetId: string,
    input: ApplicationLayoutWidgetConfigMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget | null> {
    if (isRecord(input)) assertRendererConfigInput(input.config)
    const data = strictApplicationLayoutWidgetConfigMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    return runApplicationLayoutTransaction(executor, async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
        const current = currentLayout?.widgets.find((widget) => widget.id === widgetId)
        if (!currentLayout || !currentLayout.item.isActive || !current) return null
        const config = assertApplicationLayoutWidgetConfig(current.widgetKey, data.config)
        if (classifyPlacementLineage(current.sourceWidgetId, current.sourceBaseWidgetId).kind === 'source-linked') {
            assertSourceLinkedPresentationConfig(current.widgetKey, current.config, config)
        }
        const placement =
            (current as ApplicationLayoutWidgetWithPlacement).placement ??
            getWidgetPlacement(currentLayout.item.templateKey, current.widgetKey, current.zone, current.config)
        const storedConfig = encodeWidgetConfigForStorage(
            currentLayout.item.templateKey,
            current.widgetKey,
            current.zone,
            config,
            placement
        )
        const candidateWidgets = currentLayout.widgets.map((widget) =>
            widget.id === current.id ? copyApplicationLayoutWidgetSourceBindingState(current, { ...current, config }) : widget
        )
        validateApplicationLayoutWidgetGraph(currentLayout.item.templateKey, candidateWidgets)
        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            [
                {
                    current: {
                        widgetKey: current.widgetKey,
                        config: current.config,
                        isActive: current.isActive
                    },
                    next: { widgetKey: current.widgetKey, config, isActive: current.isActive }
                }
            ],
            { lockAlreadyHeld: true }
        )
        const rows = await tx.query<WidgetRow>(
            `
            UPDATE ${widgetsTable}
            SET config = $2::jsonb, _upl_updated_at = NOW(), _upl_updated_by = $3, _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1
              AND layout_id = $4
              AND COALESCE(_upl_version, 1) = $5
              AND _upl_deleted = false
              AND _app_deleted = false
              AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
            RETURNING *,
                      (source_config IS NOT NULL AND config IS DISTINCT FROM source_config) AS is_customized,
                      COALESCE(_upl_version, 1)::int AS version
            `,
            [widgetId, JSON.stringify(storedConfig), userId, layoutId, data.expectedVersion]
        )
        if (!rows[0]) throw new Error('APPLICATION_LAYOUT_VERSION_CONFLICT')
        await refreshLayoutLocalContentHash(tx, schemaName, String(rows[0].layout_id), userId)
        return mapWidgetWithCanonicalSourceState(rows[0], currentLayout.item.templateKey)
    })
}

export async function updateApplicationLayoutWidgetConfigsBatch(
    executor: DbExecutor,
    schemaName: string,
    input: ApplicationLayoutWidgetConfigBatchMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget[]> {
    if (isRecord(input) && Array.isArray(input.updates)) {
        for (const update of input.updates) {
            if (isRecord(update)) assertRendererConfigInput(update.config)
        }
    }
    const data = strictApplicationLayoutWidgetConfigBatchMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const updates = [...data.updates].sort((left, right) => left.widgetId.localeCompare(right.widgetId))

    return executor.transaction(async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const layoutIds = [...new Set(updates.map((update) => update.layoutId))].sort((left, right) => left.localeCompare(right))
        const layoutById = new Map<string, Awaited<ReturnType<typeof lockApplicationLayoutMutation>>>()
        for (const layoutId of layoutIds) {
            const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
            if (!currentLayout || !currentLayout.item.isActive) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }
            layoutById.set(layoutId, currentLayout)
        }

        const currentRows = await tx.query<WidgetRow>(
            `SELECT w.id, w.layout_id, w.zone, w.widget_key, w.instance_key, w.parent_widget_id, w.slot_key,
                    w.sort_order, w.config, w.source_config, w.source_state,
                    w.source_widget_id, w.source_base_widget_id,
                    (w.source_config IS NOT NULL AND w.config IS DISTINCT FROM w.source_config) AS is_customized,
                    w.is_active, COALESCE(w._upl_version, 1)::int AS version
             FROM ${widgetsTable} w
             WHERE (layout_id, id) IN (
                   SELECT requested.layout_id, requested.widget_id
                   FROM UNNEST($1::uuid[], $2::uuid[]) AS requested(layout_id, widget_id)
             )
               AND _upl_deleted = false
               AND _app_deleted = false
               AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
             ORDER BY id
             FOR UPDATE`,
            [updates.map((update) => update.layoutId), updates.map((update) => update.widgetId)]
        )
        const currentByScopedId = new Map(currentRows.map((row) => [`${row.layout_id}:${row.id}`, row]))
        const validatedConfigs = new Map<string, Record<string, unknown>>()

        for (const update of updates) {
            const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)
            if (!current || current.version !== update.expectedVersion) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }
            const currentLayout = layoutById.get(update.layoutId)!
            const currentWidget = currentLayout.widgets.find((widget) => widget.id === update.widgetId)
            if (!currentWidget) throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            const validatedConfig = assertApplicationLayoutWidgetConfig(current.widget_key, update.config)
            if (classifyPlacementLineage(current.source_widget_id, current.source_base_widget_id).kind === 'source-linked') {
                assertSourceLinkedPresentationConfig(current.widget_key, currentWidget.config, validatedConfig)
            }
            validatedConfigs.set(update.widgetId, validatedConfig)
        }

        for (const layoutId of layoutIds) {
            const currentLayout = layoutById.get(layoutId)!
            const layoutUpdates = new Map(
                updates
                    .filter((update) => update.layoutId === layoutId)
                    .map((update) => [update.widgetId, validatedConfigs.get(update.widgetId)!])
            )
            const candidateWidgets = currentLayout.widgets.map((widget) =>
                layoutUpdates.has(widget.id)
                    ? copyApplicationLayoutWidgetSourceBindingState(widget, { ...widget, config: layoutUpdates.get(widget.id)! })
                    : widget
            )
            validateApplicationLayoutWidgetGraph(currentLayout.item.templateKey, candidateWidgets)
        }

        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            updates.map((update) => {
                const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!
                const currentLayout = layoutById.get(update.layoutId)!
                const currentWidget = currentLayout.widgets.find((widget) => widget.id === update.widgetId)
                if (!currentWidget) throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
                return {
                    current: {
                        widgetKey: current.widget_key,
                        config: currentWidget.config,
                        isActive: currentWidget.isActive
                    },
                    next: {
                        widgetKey: current.widget_key,
                        config: validatedConfigs.get(update.widgetId)!,
                        isActive: currentWidget.isActive
                    }
                }
            }),
            { lockAlreadyHeld: true }
        )

        const saved: ApplicationLayoutWidget[] = []
        const touchedLayoutIds = new Set<string>()
        for (const update of updates) {
            const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!
            const currentLayout = layoutById.get(update.layoutId)!
            const placement = getWidgetPlacement(currentLayout.item.templateKey, current.widget_key, current.zone, current.config)
            const storedConfig = encodeWidgetConfigForStorage(
                currentLayout.item.templateKey,
                current.widget_key,
                current.zone,
                validatedConfigs.get(update.widgetId)!,
                placement
            )
            const rows = await tx.query<WidgetRow>(
                `
                UPDATE ${widgetsTable}
                SET config = $2::jsonb, _upl_updated_at = NOW(), _upl_updated_by = $3, _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE id = $1
                  AND layout_id = $4
                  AND _upl_deleted = false
                  AND _app_deleted = false
                  AND COALESCE(_upl_version, 1) = $5
                  AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
                RETURNING *,
                          (source_config IS NOT NULL AND config IS DISTINCT FROM source_config) AS is_customized,
                          COALESCE(_upl_version, 1)::int AS version
                `,
                [update.widgetId, JSON.stringify(storedConfig), userId, update.layoutId, update.expectedVersion]
            )
            if (!rows[0]) throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            saved.push(mapWidgetWithCanonicalSourceState(rows[0], currentLayout.item.templateKey))
            touchedLayoutIds.add(String(rows[0].layout_id))
        }

        for (const layoutId of touchedLayoutIds) {
            await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        }
        return saved
    })
}

export async function resetApplicationLayoutWidgetConfigsBatch(
    executor: DbExecutor,
    schemaName: string,
    input: ApplicationLayoutWidgetResetBatchMutation,
    userId: string | null
): Promise<ApplicationLayoutWidget[]> {
    const data = strictApplicationLayoutWidgetResetBatchMutationSchema.parse(input)
    const widgetsTable = qSchemaTable(schemaName, '_app_widgets')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const updates = [...data.updates].sort((left, right) => left.widgetId.localeCompare(right.widgetId))

    return executor.transaction(async (tx) => {
        await lockInterpretationNetworkStructureMode(tx, schemaName)
        const layoutIds = [...new Set(updates.map((update) => update.layoutId))].sort((left, right) => left.localeCompare(right))
        const layoutById = new Map<string, Awaited<ReturnType<typeof lockApplicationLayoutMutation>>>()
        for (const layoutId of layoutIds) {
            const currentLayout = await lockApplicationLayoutMutation(tx, schemaName, layoutId)
            if (!currentLayout || !currentLayout.item.isActive) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }
            layoutById.set(layoutId, currentLayout)
        }

        const currentRows = await tx.query<WidgetRow>(
            `SELECT w.id, w.layout_id, w.zone, w.widget_key, w.instance_key, w.parent_widget_id, w.slot_key,
                    w.sort_order, w.config, w.source_config, w.source_state,
                    w.source_widget_id, w.source_base_widget_id,
                    (w.source_config IS NOT NULL AND w.config IS DISTINCT FROM w.source_config) AS is_customized,
                    w.is_active, COALESCE(w._upl_version, 1)::int AS version
             FROM ${widgetsTable} w
             WHERE (w.layout_id, w.id) IN (
                   SELECT requested.layout_id, requested.widget_id
                   FROM UNNEST($1::uuid[], $2::uuid[]) AS requested(layout_id, widget_id)
             )
               AND w.source_config IS NOT NULL
               AND w._upl_deleted = false
               AND w._app_deleted = false
               AND ${applicationLayoutWidgetPredicate(layoutsTable, 'w.layout_id')}
             ORDER BY w.id
             FOR UPDATE`,
            [updates.map((update) => update.layoutId), updates.map((update) => update.widgetId)]
        )
        const currentByScopedId = new Map(currentRows.map((row) => [`${row.layout_id}:${row.id}`, row]))
        const validatedSourceStates = new Map<string, ReturnType<typeof parseApplicationLayoutWidgetSourceState>>()
        for (const update of updates) {
            const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)
            if (!current || current.version !== update.expectedVersion) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            }
            const currentLayout = layoutById.get(update.layoutId)!
            const sourceLineage = classifyPlacementLineage(current.source_widget_id, current.source_base_widget_id)
            const sourceLinked = sourceLineage.kind === 'source-linked'
            const bindingsInheritedFromBase = current.source_base_widget_id !== null && current.source_base_widget_id !== undefined
            const bindingOptions = resolvePlacementBindingValidation(
                current.widget_key,
                current.source_config,
                sourceLinked,
                bindingsInheritedFromBase
            )
            try {
                const decodedSource = readWidgetConfigEnvelope(
                    currentLayout.item.templateKey,
                    current.widget_key,
                    current.zone,
                    current.source_config,
                    bindingOptions
                )
                if (bindingOptions.rejectBindings && decodedSource.bindings !== undefined) {
                    throw new Error('Inherited widget source config cannot contain bindings')
                }
            } catch {
                throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
            }
            const sourceState = parseApplicationLayoutWidgetSourceState(
                (current as WidgetRow & { source_state?: unknown }).source_state,
                currentLayout.item.templateKey,
                current.widget_key
            )
            const validatedSourceState = createApplicationLayoutWidgetSourceState(
                currentLayout.item.templateKey,
                current.widget_key,
                {
                    zone: sourceState.zone,
                    sortOrder: sourceState.sortOrder,
                    isActive: sourceState.isActive,
                    config: current.source_config,
                    instanceKey: sourceState.instanceKey,
                    parentWidgetId: sourceState.parentWidgetId,
                    slotKey: sourceState.slotKey
                },
                bindingOptions
            )
            if (!applicationLayoutWidgetSourceStatesEqual(sourceState, validatedSourceState)) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
            }
            validatedSourceStates.set(`${update.layoutId}:${update.widgetId}`, validatedSourceState)
        }

        for (const layoutId of layoutIds) {
            const currentLayout = layoutById.get(layoutId)!
            const candidateWidgets = currentLayout.widgets.map((widget) => {
                const sourceState = validatedSourceStates.get(`${layoutId}:${widget.id}`)
                if (!sourceState) return widget
                const zone = applicationLayoutZoneSchema.safeParse(sourceState.zone)
                if (!zone.success) throw new Error('APPLICATION_LAYOUT_WIDGET_INVALID')
                return copyApplicationLayoutWidgetSourceBindingState(widget, {
                    ...widget,
                    zone: zone.data,
                    sortOrder: sourceState.sortOrder,
                    isActive: sourceState.isActive,
                    instanceKey: sourceState.instanceKey,
                    parentWidgetId: sourceState.parentWidgetId,
                    slotKey: sourceState.slotKey,
                    config: sourceState.rendererConfig
                })
            })
            validateApplicationLayoutWidgetGraph(currentLayout.item.templateKey, candidateWidgets)
        }

        await assertInterpretationNetworkSingleSystemTransitionAllowed(
            tx,
            schemaName,
            updates.map((update) => {
                const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!
                const currentLayout = layoutById.get(update.layoutId)!
                const sourceState = parseApplicationLayoutWidgetSourceState(
                    (current as WidgetRow & { source_state?: unknown }).source_state,
                    currentLayout.item.templateKey,
                    current.widget_key
                )
                const currentWidget = currentLayout.widgets.find((widget) => widget.id === update.widgetId)
                if (!currentWidget) throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
                return {
                    current: { widgetKey: current.widget_key, config: currentWidget.config, isActive: currentWidget.isActive },
                    next: { widgetKey: current.widget_key, config: sourceState.rendererConfig, isActive: sourceState.isActive }
                }
            }),
            { lockAlreadyHeld: true }
        )

        const saved: ApplicationLayoutWidget[] = []
        const touchedLayoutIds = new Set<string>()
        for (const update of updates) {
            const current = currentByScopedId.get(`${update.layoutId}:${update.widgetId}`)!
            const currentLayout = layoutById.get(update.layoutId)!
            const sourceState = parseApplicationLayoutWidgetSourceState(
                (current as WidgetRow & { source_state?: unknown }).source_state,
                currentLayout.item.templateKey,
                current.widget_key
            )
            const config = encodeLayoutWidgetConfigEnvelope(
                {
                    rendererConfig: sourceState.rendererConfig,
                    neutral: sourceState.placement === null ? {} : { placement: sourceState.placement }
                },
                { templateKey: currentLayout.item.templateKey, widgetKey: current.widget_key, zone: sourceState.zone }
            )
            const rows = await tx.query<WidgetRow>(
                `
                UPDATE ${widgetsTable}
                SET config = $3::jsonb,
                    zone = $5,
                    sort_order = $6,
                    is_active = $7,
                    instance_key = $9,
                    parent_widget_id = $10,
                    slot_key = $11,
                    _upl_updated_at = NOW(),
                    _upl_updated_by = $4,
                    _upl_version = COALESCE(_upl_version, 1) + 1
                WHERE id = $1
                  AND layout_id = $2
                  AND source_config IS NOT NULL
                  AND source_state IS NOT NULL
                  AND _upl_deleted = false
                  AND _app_deleted = false
                  AND COALESCE(_upl_version, 1) = $8
                  AND ${applicationLayoutWidgetPredicate(layoutsTable, 'layout_id')}
                RETURNING *,
                          false AS is_customized,
                          COALESCE(_upl_version, 1)::int AS version
                `,
                [
                    update.widgetId,
                    update.layoutId,
                    JSON.stringify(config),
                    userId,
                    sourceState.zone,
                    sourceState.sortOrder,
                    sourceState.isActive,
                    update.expectedVersion,
                    sourceState.instanceKey,
                    sourceState.parentWidgetId,
                    sourceState.slotKey
                ]
            )
            if (!rows[0]) throw new Error('APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT')
            saved.push(mapWidgetWithCanonicalSourceState(rows[0], layoutById.get(update.layoutId)!.item.templateKey))
            touchedLayoutIds.add(update.layoutId)
        }

        for (const layoutId of touchedLayoutIds) {
            await refreshLayoutLocalContentHash(tx, schemaName, layoutId, userId)
        }
        return saved
    })
}
