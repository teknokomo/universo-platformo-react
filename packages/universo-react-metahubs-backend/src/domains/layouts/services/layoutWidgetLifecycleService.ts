import { z } from 'zod'
import type { SqlQueryable } from '@universo-react/utils/database'
import { queryMany, queryOne } from '@universo-react/utils/database'
import { qSchemaTable } from '@universo-react/database'
import { applicationLayoutWidgetKeySchema, applicationLayoutZoneSchema, type ApplicationLayoutZone } from '@universo-react/types'
import { MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { layoutWidgetOwnsComposition, requireLayoutWidgetOwnership } from '../widgetOwnership'
import { assertAllowedLayoutWidgetChild } from '../widgetOwnership'
import { assertMarketingHeroLayoutMutationPreservesActions } from '../marketingHeroActionIntegrityStore'
import {
    type LayoutZoneWidgetRow,
    type DbRow,
    type LayoutWidgetOverrideDbRow,
    isRecord,
    resolveWidgetPlacementOverridePolicy,
    LAYOUT_ZONES_BY_TEMPLATE,
    moveLayoutZoneWidgetSchema
} from './layoutServiceContracts'
import { MetahubLayoutWidgetPlacementService } from './layoutWidgetPlacementService'

/** Provides the widget lifecycle service operations used by the public layout service. */
export class MetahubLayoutWidgetLifecycleService extends MetahubLayoutWidgetPlacementService {
    async moveLayoutZoneWidget(
        metahubId: string,
        layoutId: string,
        input: z.infer<typeof moveLayoutZoneWidgetSchema>,
        userId?: string | null
    ): Promise<LayoutZoneWidgetRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)

        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            const lockedLayoutScope = await this.lockLayoutScopeRow(tx, schemaName, layoutId)
            if (!lockedLayoutScope) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }
            await this.ensureDefaultZoneWidgets(tx, schemaName, layoutId, userId ?? null)
            const layoutScope = await this.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }
            await this.lockLayoutPlacementRows(tx, schemaName, layoutScope)
            const templateKey = this.assertLayoutSupportsWidgets(layoutScope)

            if (this.isScopedEntityLayout(layoutScope)) {
                const resolvedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const current = resolvedWidgets.find((row) => row.id === input.widgetId)
                if (!current) throw new MetahubNotFoundError('Layout widget', input.widgetId)
                this.assertExpectedWidgetVersion(current, input.expectedVersion)
                const sourceZone = current.zone
                const targetZone = input.targetZone ?? sourceZone
                const overridePolicy = resolveWidgetPlacementOverridePolicy(current.templateKey, current.widgetKey, current.config)
                if (
                    current.isInherited &&
                    ((!overridePolicy.canChangeZone && targetZone !== sourceZone) ||
                        (!overridePolicy.canReorder && input.targetIndex !== undefined) ||
                        (!overridePolicy.canChangeParentSlot && input.targetParentInstanceKey !== undefined))
                ) {
                    throw new MetahubValidationError('Inherited widget position is locked by the base layout and cannot be moved.', {
                        widgetId: current.id,
                        widgetKey: current.widgetKey,
                        layoutId
                    })
                }
                this.assertWidgetAllowedInZone(templateKey, current.widgetKey, targetZone)
                const descendants = new Set<string>()
                let added = true
                while (added) {
                    added = false
                    for (const row of resolvedWidgets) {
                        if (
                            !descendants.has(row.id) &&
                            row.parentWidgetId &&
                            (row.parentWidgetId === current.id || descendants.has(row.parentWidgetId))
                        ) {
                            descendants.add(row.id)
                            added = true
                        }
                    }
                }
                let parentWidgetId = current.parentWidgetId
                let slotKey = current.slotKey
                if (input.targetParentInstanceKey) {
                    if (current.isInherited)
                        throw new MetahubValidationError('Inherited placement composition is owned by its source layout')
                    const parent = resolvedWidgets.find((row) => row.instanceKey === input.targetParentInstanceKey)
                    if (!parent) throw new MetahubNotFoundError('Layout widget parent', input.targetParentInstanceKey)
                    if (parent.id === current.id || descendants.has(parent.id)) {
                        throw new MetahubValidationError('A placement cannot be moved into its own subtree')
                    }
                    const parentDefinition = requireLayoutWidgetOwnership(templateKey, parent.widgetKey, parent.config)
                    const childDefinition = requireLayoutWidgetOwnership(templateKey, current.widgetKey, current.config)
                    if (
                        parent.isInherited &&
                        !layoutWidgetOwnsComposition(parentDefinition, {
                            scopeEntityId: null,
                            baseLayoutId: parent.layoutId,
                            sourceBaseWidgetId: parent.baseWidgetId
                        })
                    ) {
                        throw new MetahubValidationError('Inherited placement composition is owned by its source layout')
                    }
                    assertAllowedLayoutWidgetChild(parentDefinition, childDefinition, input.targetSlotKey as string)
                    parentWidgetId = parent.id
                    slotKey = input.targetSlotKey as string
                }
                const targetParent = resolvedWidgets.find((row) => row.id === parentWidgetId)
                if (targetParent && targetParent.zone !== targetZone) {
                    throw new MetahubValidationError('A nested placement must remain in its parent zone')
                }
                const remaining = resolvedWidgets
                    .filter((row) => row.id !== input.widgetId)
                    .map((row) => (descendants.has(row.id) ? { ...row, zone: targetZone } : row))
                const targetZoneItems = remaining.filter(
                    (row) => row.zone === targetZone && row.parentWidgetId === parentWidgetId && row.slotKey === slotKey
                )
                const targetIndex =
                    typeof input.targetIndex === 'number'
                        ? Math.max(0, Math.min(input.targetIndex, targetZoneItems.length))
                        : targetZoneItems.length
                const insertBefore = targetZoneItems[targetIndex]
                const insertIndex = insertBefore ? remaining.findIndex((row) => row.id === insertBefore.id) : remaining.length
                const moved = { ...current, zone: targetZone, parentWidgetId, slotKey }
                remaining.splice(insertIndex, 0, moved)

                this.assertPlacementGraph(
                    templateKey,
                    remaining.map((row) => ({
                        id: row.id,
                        instanceKey: row.instanceKey,
                        parentWidgetId: row.parentWidgetId,
                        slotKey: row.slotKey,
                        widgetKey: row.widgetKey,
                        zone: row.zone,
                        config: row.config
                    }))
                )

                for (const zone of LAYOUT_ZONES_BY_TEMPLATE[templateKey]) {
                    let sortOrder = 1
                    for (const row of remaining) {
                        if (row.zone !== zone) continue
                        row.sortOrder = sortOrder
                        sortOrder += 1
                    }
                }

                if (!current.isInherited && (parentWidgetId !== current.parentWidgetId || slotKey !== current.slotKey)) {
                    const relationRows = await tx.query<{ id: string }>(
                        `UPDATE ${wt}
                            SET parent_widget_id = $1, slot_key = $2,
                                _upl_updated_at = $3, _upl_updated_by = $4,
                                _upl_version = COALESCE(_upl_version, 1) + 1
                          WHERE id = $5 AND layout_id = $6 AND _upl_deleted = false AND _mhb_deleted = false
                            AND COALESCE(_upl_version, 1) = $7
                          RETURNING id`,
                        [parentWidgetId, slotKey, new Date(), userId ?? null, current.id, layoutId, input.expectedVersion]
                    )
                    if (relationRows.length !== 1) throw this.createConflictError('Layout widget was modified by another request')
                }
                await this.normalizeResolvedScopedLayoutSortOrders(tx, schemaName, layoutScope, remaining, userId ?? null)
                await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
                return (await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)).map((row) =>
                    this.mapResolvedLayoutWidgetState(row)
                )
            }

            const currentRows = await queryMany<DbRow>(
                tx,
                `SELECT * FROM ${wt} WHERE layout_id = $1 AND ${ACTIVE}
                 ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC
                 FOR UPDATE`,
                [layoutId]
            )
            const widgets = currentRows.map((row) => {
                const widgetKey = applicationLayoutWidgetKeySchema.parse(row.widget_key)
                const zone = applicationLayoutZoneSchema.parse(row.zone)
                this.assertWidgetAllowedInZone(templateKey, widgetKey, zone)
                return {
                    id: String(row.id),
                    zone,
                    widgetKey,
                    instanceKey: this.getPlacementInstanceKey(row.instance_key),
                    parentWidgetId: typeof row.parent_widget_id === 'string' ? row.parent_widget_id : null,
                    slotKey: typeof row.slot_key === 'string' ? row.slot_key : null,
                    config: this.parseWidgetConfig(templateKey, widgetKey, row.config),
                    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 1
                }
            })
            const current = widgets.find((widget) => widget.id === input.widgetId)
            if (!current) throw new MetahubNotFoundError('Layout widget', input.widgetId)
            this.assertExpectedWidgetVersion(currentRows.find((row) => String(row.id) === input.widgetId) ?? {}, input.expectedVersion)

            const sourceZone = current.zone
            const targetZone = input.targetZone ?? sourceZone
            this.assertWidgetAllowedInZone(templateKey, current.widgetKey, targetZone)

            const byId = new Map(widgets.map((widget) => [widget.id, widget]))
            const descendants = new Set<string>()
            let changed = true
            while (changed) {
                changed = false
                for (const widget of widgets) {
                    if (
                        !descendants.has(widget.id) &&
                        widget.parentWidgetId &&
                        (widget.parentWidgetId === current.id || descendants.has(widget.parentWidgetId))
                    ) {
                        descendants.add(widget.id)
                        changed = true
                    }
                }
            }
            let parentWidgetId = current.parentWidgetId
            let slotKey = current.slotKey
            if (input.targetParentInstanceKey) {
                const targetParent = widgets.find((widget) => widget.instanceKey === input.targetParentInstanceKey)
                if (!targetParent) throw new MetahubNotFoundError('Layout widget parent', input.targetParentInstanceKey)
                if (descendants.has(targetParent.id) || targetParent.id === current.id) {
                    throw new MetahubValidationError('A placement cannot be moved into its own subtree')
                }
                const parentDefinition = requireLayoutWidgetOwnership(templateKey, targetParent.widgetKey, targetParent.config)
                const childDefinition = requireLayoutWidgetOwnership(templateKey, current.widgetKey, current.config)
                assertAllowedLayoutWidgetChild(parentDefinition, childDefinition, input.targetSlotKey as string)
                parentWidgetId = targetParent.id
                slotKey = input.targetSlotKey as string
            }
            const targetParent = parentWidgetId ? byId.get(parentWidgetId) : undefined
            if (targetParent && targetParent.zone !== targetZone) {
                throw new MetahubValidationError('A nested placement must remain in its parent zone')
            }

            const remaining = widgets.filter((widget) => widget.id !== input.widgetId)
            const widgetsByZone = new Map<ApplicationLayoutZone, typeof remaining>()
            for (const widget of remaining) {
                const zoneWidgets = widgetsByZone.get(widget.zone) ?? []
                zoneWidgets.push(widget)
                widgetsByZone.set(widget.zone, zoneWidgets)
            }
            const targetRows = widgetsByZone.get(targetZone) ?? []
            const targetLane = targetRows.filter((widget) => widget.parentWidgetId === parentWidgetId && widget.slotKey === slotKey)
            const clampedIndex =
                typeof input.targetIndex === 'number' ? Math.max(0, Math.min(input.targetIndex, targetLane.length)) : targetLane.length
            const insertBefore = targetLane[clampedIndex]
            const insertAt = insertBefore
                ? targetRows.findIndex((widget) => widget.id === insertBefore.id)
                : targetLane.length > 0
                ? targetRows.findIndex((widget) => widget.id === targetLane[targetLane.length - 1].id) + 1
                : targetRows.length
            targetRows.splice(insertAt, 0, { ...current, zone: targetZone, parentWidgetId, slotKey })
            widgetsByZone.set(targetZone, targetRows)

            for (const descendantId of descendants) {
                const descendant = byId.get(descendantId)
                if (!descendant) throw new MetahubValidationError('Layout widget subtree is incomplete')
                widgetsByZone.set(
                    descendant.zone,
                    (widgetsByZone.get(descendant.zone) ?? []).filter((widget) => widget.id !== descendant.id)
                )
                const targetItems = widgetsByZone.get(targetZone) ?? []
                targetItems.push({ ...descendant, zone: targetZone })
                widgetsByZone.set(targetZone, targetItems)
            }

            this.assertPlacementGraph(
                templateKey,
                widgets.map((widget) => {
                    const updated =
                        widget.id === current.id
                            ? { ...widget, zone: targetZone, parentWidgetId, slotKey }
                            : descendants.has(widget.id)
                            ? { ...widget, zone: targetZone }
                            : widget
                    return {
                        id: updated.id,
                        instanceKey: updated.instanceKey,
                        parentWidgetId: updated.parentWidgetId,
                        slotKey: updated.slotKey,
                        widgetKey: updated.widgetKey,
                        zone: updated.zone,
                        config: updated.config
                    }
                })
            )

            const orderedWidgets = [...widgetsByZone.entries()].flatMap(([zone, zoneWidgets]) =>
                zoneWidgets.map((widget, index) => ({ id: widget.id, zone, sortOrder: index + 1 }))
            )
            await this.persistGlobalLayoutWidgetOrder(
                tx,
                schemaName,
                layoutId,
                orderedWidgets,
                sourceZone === targetZone ? [sourceZone] : [sourceZone, targetZone],
                userId ?? null,
                { widgetId: input.widgetId, expectedVersion: input.expectedVersion }
            )

            const relationRows = await tx.query<{ id: string }>(
                `UPDATE ${wt}
                    SET parent_widget_id = $1, slot_key = $2,
                        _upl_updated_at = $3, _upl_updated_by = $4,
                        _upl_version = COALESCE(_upl_version, 1) + 1
                  WHERE id = $5 AND layout_id = $6 AND _upl_deleted = false AND _mhb_deleted = false
                    AND COALESCE(_upl_version, 1) = $7
                  RETURNING id`,
                [parentWidgetId, slotKey, new Date(), userId ?? null, current.id, layoutId, input.expectedVersion + 1]
            )
            if (relationRows.length !== 1) throw this.createConflictError('Layout widget was modified by another request')

            await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)

            const rows = await queryMany<DbRow>(
                tx,
                `SELECT * FROM ${wt} WHERE layout_id = $1 AND ${ACTIVE}
                 ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
                [layoutId]
            )
            return this.mapZoneWidgetRows(rows, templateKey)
        })
    }

    async removeLayoutZoneWidget(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        await this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            const layoutScope = await this.lockLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) {
                throw this.createNotFoundError('Layout not found')
            }
            await this.lockLayoutPlacementRows(tx, schemaName, layoutScope)
            const templateKey = this.assertLayoutSupportsWidgets(layoutScope)

            if (this.isScopedEntityLayout(layoutScope)) {
                const resolvedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const current = resolvedWidgets.find((row) => row.id === widgetId)
                if (!current) {
                    throw this.createNotFoundError('Zone widget not found')
                }
                this.assertExpectedWidgetVersion(current, expectedVersion)

                const subtree = this.resolvePlacementSubtree(resolvedWidgets, current.id)
                for (const item of subtree) {
                    await assertMarketingHeroLayoutMutationPreservesActions(tx, schemaName, layoutId, {
                        widgetId: item.id,
                        widgetKey: item.widgetKey,
                        config: item.config,
                        kind: 'remove'
                    })
                }

                if (current.isInherited) {
                    for (const item of subtree) {
                        const overridePolicy = resolveWidgetPlacementOverridePolicy(item.templateKey, item.widgetKey, item.config)
                        if (!overridePolicy.canExclude || !item.baseWidgetId) {
                            throw new MetahubValidationError('An inherited subtree placement cannot be excluded by this layout.', {
                                widgetId: item.id,
                                widgetKey: item.widgetKey,
                                layoutId
                            })
                        }
                        await this.upsertLayoutWidgetOverride(tx, schemaName, {
                            layoutId,
                            baseWidgetId: item.baseWidgetId,
                            templateKey,
                            widgetKey: item.widgetKey,
                            baseConfig: item.config,
                            patch: { zone: null, sortOrder: null, isActive: null, isDeletedOverride: true },
                            userId,
                            expectedVersion: item.id === current.id ? expectedVersion : item.version
                        })
                    }

                    const refreshedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                    await this.normalizeResolvedScopedLayoutSortOrders(tx, schemaName, layoutScope, refreshedWidgets, userId ?? null)
                    await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
                    return
                }

                for (const item of subtree) {
                    if (item.isInherited)
                        throw new MetahubValidationError('An owned placement cannot partially remove an inherited subtree')
                    const removedRows = await tx.query<{ id: string }>(
                        `UPDATE ${wt} SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                            _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                         WHERE id = $3 AND layout_id = $4 AND _upl_deleted = false AND _mhb_deleted = false
                           AND COALESCE(_upl_version, 1) = $5
                         RETURNING id`,
                        [new Date(), userId ?? null, item.id, layoutId, item.id === current.id ? expectedVersion : item.version]
                    )
                    if (removedRows.length !== 1) throw this.createConflictError('Layout widget was modified by another request')
                }

                const refreshedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                await this.normalizeResolvedScopedLayoutSortOrders(tx, schemaName, layoutScope, refreshedWidgets, userId ?? null)
                await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
                return
            }

            const activeRows = await queryMany<DbRow>(tx, `SELECT * FROM ${wt} WHERE layout_id = $1 AND ${ACTIVE} FOR UPDATE`, [layoutId])
            const current = activeRows.find((row) => String(row.id) === widgetId)
            if (!current) throw this.createNotFoundError('Zone widget not found')
            this.assertExpectedWidgetVersion(current, expectedVersion)

            const currentStates = activeRows.map((row) => ({
                id: String(row.id),
                parentWidgetId: typeof row.parent_widget_id === 'string' ? row.parent_widget_id : null,
                version: typeof row._upl_version === 'number' ? row._upl_version : 1,
                widgetKey: applicationLayoutWidgetKeySchema.parse(row.widget_key),
                config: this.parseWidgetConfig(templateKey, applicationLayoutWidgetKeySchema.parse(row.widget_key), row.config)
            }))
            this.assertPlacementGraph(
                templateKey,
                activeRows.map((row) => ({
                    id: String(row.id),
                    instanceKey: row.instance_key,
                    parentWidgetId: row.parent_widget_id,
                    slotKey: row.slot_key,
                    widgetKey: row.widget_key,
                    zone: row.zone,
                    config: this.parseWidgetConfig(templateKey, applicationLayoutWidgetKeySchema.parse(row.widget_key), row.config)
                }))
            )
            const subtree = this.resolvePlacementSubtree(currentStates, widgetId)

            // Overlay-owned children may point directly at placements from this base layout.
            // Keep the effective graph valid by requiring those children to be removed first.
            // Every layout-graph mutation takes the same advisory lock, so this check and the
            // subsequent soft delete form one serialized graph operation.
            const dependentOverlayChildren = await queryMany<DbRow>(
                tx,
                `SELECT child.id, child.layout_id
                   FROM ${lt} dependent_layout
                   JOIN ${wt} child ON child.layout_id = dependent_layout.id
                  WHERE dependent_layout.base_layout_id = $1
                    AND dependent_layout._upl_deleted = false AND dependent_layout._mhb_deleted = false
                    AND child.parent_widget_id = ANY($2::uuid[])
                    AND child._upl_deleted = false AND child._mhb_deleted = false
                  ORDER BY child.layout_id ASC, child.id ASC
                  FOR UPDATE OF child`,
                [layoutId, subtree.map(({ id }) => id)]
            )
            if (dependentOverlayChildren.length > 0) {
                throw this.createConflictError('A layout placement cannot be removed while dependent layouts contain nested placements')
            }

            const widgetKey = applicationLayoutWidgetKeySchema.parse(current.widget_key)
            const zone = applicationLayoutZoneSchema.parse(current.zone)
            this.assertWidgetAllowedInZone(templateKey, widgetKey, zone)
            for (const item of subtree) {
                const removedRows = await tx.query<{ id: string }>(
                    `UPDATE ${wt} SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                        _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
                     WHERE id = $3 AND layout_id = $4 AND _upl_deleted = false AND _mhb_deleted = false
                       AND COALESCE(_upl_version, 1) = $5
                     RETURNING id`,
                    [new Date(), userId ?? null, item.id, layoutId, item.id === widgetId ? expectedVersion : item.version]
                )
                if (removedRows.length !== 1) throw this.createConflictError('Layout widget was modified by another request')
            }

            await this.normalizeZoneSortOrders(tx, schemaName, layoutId, zone, userId ?? null)
            await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
        })
    }

    async resetLayoutZoneWidgetOverride(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ot = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        await this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            const layoutScope = await this.lockLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) throw this.createNotFoundError('Layout not found')
            if (!this.isScopedEntityLayout(layoutScope)) {
                throw new MetahubValidationError('Only entity-scoped layouts can reset widget overrides.')
            }

            const baseWidget = await queryOne<DbRow>(tx, `SELECT * FROM ${wt} WHERE id = $1 AND ${ACTIVE}`, [widgetId])
            const override = await queryOne<LayoutWidgetOverrideDbRow>(
                tx,
                `SELECT * FROM ${ot} WHERE layout_id = $1 AND base_widget_id = $2 AND ${ACTIVE}`,
                [layoutId, widgetId]
            )
            if (!baseWidget && !override) throw this.createNotFoundError('Layout widget override not found')

            this.assertExpectedWidgetVersion(override ?? baseWidget ?? {}, expectedVersion)
            if (override) {
                if (baseWidget) {
                    await assertMarketingHeroLayoutMutationPreservesActions(tx, schemaName, layoutId, {
                        widgetId,
                        widgetKey: applicationLayoutWidgetKeySchema.parse(baseWidget.widget_key),
                        config: isRecord(baseWidget.config) ? (baseWidget.config as Record<string, unknown>) : undefined,
                        kind: 'reset-override'
                    })
                }
                await this.softDeleteLayoutWidgetOverride(tx, schemaName, override.id, userId, expectedVersion)
            }

            const resolvedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
            await this.normalizeResolvedScopedLayoutSortOrders(tx, schemaName, layoutScope, resolvedWidgets, userId ?? null)
            await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
        })
    }

    /**
     * Update the JSONB config of a specific zone widget.
     * Used primarily to store menu configuration inside menuWidget.
     */
    async updateLayoutZoneWidgetConfig(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        config: Record<string, unknown>,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<LayoutZoneWidgetRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            const layoutScope = await this.lockLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) {
                throw this.createNotFoundError('Layout not found')
            }
            const templateKey = this.assertLayoutSupportsWidgets(layoutScope)

            if (this.isScopedEntityLayout(layoutScope)) {
                const resolvedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const currentResolved = resolvedWidgets.find((row) => row.id === widgetId)
                if (!currentResolved) {
                    throw this.createNotFoundError('Zone widget not found')
                }
                this.assertExpectedWidgetVersion(currentResolved, expectedVersion)

                if (currentResolved.isInherited) {
                    const validatedConfig = this.parseWidgetRendererUpdate(
                        templateKey,
                        currentResolved.widgetKey,
                        currentResolved.zone,
                        currentResolved.config,
                        config
                    )
                    if (!currentResolved.baseWidgetId) {
                        throw new MetahubValidationError('Inherited widget has no source identity')
                    }
                    await assertMarketingHeroLayoutMutationPreservesActions(tx, schemaName, layoutId, {
                        widgetId: currentResolved.id,
                        widgetKey: currentResolved.widgetKey,
                        config: validatedConfig,
                        kind: 'set-config'
                    })
                    await this.upsertLayoutWidgetOverride(tx, schemaName, {
                        layoutId,
                        baseWidgetId: currentResolved.baseWidgetId,
                        templateKey,
                        widgetKey: currentResolved.widgetKey,
                        baseConfig: currentResolved.config,
                        patch: {
                            config: this.projectScopedWidgetConfigOverride(
                                templateKey,
                                currentResolved.widgetKey,
                                currentResolved.zone,
                                validatedConfig
                            ),
                            isDeletedOverride: false
                        },
                        userId,
                        expectedVersion
                    })
                    const refreshed = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                    const updated = refreshed.find((row) => row.id === widgetId)
                    if (!updated) throw this.createNotFoundError('Zone widget not found')
                    return this.mapResolvedLayoutWidgetState(updated)
                }

                const validatedConfig = this.parseWidgetRendererUpdate(
                    templateKey,
                    currentResolved.widgetKey,
                    currentResolved.zone,
                    currentResolved.config,
                    config
                )
                await assertMarketingHeroLayoutMutationPreservesActions(tx, schemaName, layoutId, {
                    widgetId: currentResolved.id,
                    widgetKey: currentResolved.widgetKey,
                    config: validatedConfig,
                    kind: 'set-config'
                })
                const now = new Date()
                const updatedRows = await tx.query<DbRow>(
                    `UPDATE ${wt} SET config = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                     WHERE id = $4 AND _upl_deleted = false AND _mhb_deleted = false
                       AND COALESCE(_upl_version, 1) = $5
                     RETURNING *`,
                    [JSON.stringify(validatedConfig), now, userId ?? null, currentResolved.id, expectedVersion]
                )
                if (!updatedRows[0]) throw this.createConflictError('Layout widget was modified by another request')

                await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
                const refreshed = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const updated = refreshed.find((row) => row.id === widgetId)
                if (!updated) {
                    throw this.createNotFoundError('Zone widget not found')
                }
                return this.mapResolvedLayoutWidgetState(updated)
            }

            const current = await queryOne<DbRow>(tx, `SELECT * FROM ${wt} WHERE id = $1 AND layout_id = $2 AND ${ACTIVE}`, [
                widgetId,
                layoutId
            ])
            if (!current) {
                throw this.createNotFoundError('Zone widget not found')
            }
            this.assertExpectedWidgetVersion(current, expectedVersion)

            const widgetKey = applicationLayoutWidgetKeySchema.parse(current.widget_key)
            const zone = applicationLayoutZoneSchema.parse(current.zone)
            this.assertWidgetAllowedInZone(templateKey, widgetKey, zone)
            const currentConfig = this.parseWidgetConfig(templateKey, widgetKey, current.config)
            const validatedConfig = this.parseWidgetRendererUpdate(templateKey, widgetKey, zone, currentConfig, config)
            await assertMarketingHeroLayoutMutationPreservesActions(tx, schemaName, layoutId, {
                widgetId: String(current.id),
                widgetKey,
                config: validatedConfig,
                kind: 'set-config'
            })

            const resolvedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
            this.assertPlacementGraph(
                templateKey,
                resolvedWidgets.map((row) => (row.id === String(current.id) ? { ...row, config: validatedConfig } : row))
            )

            const now = new Date()
            const updatedRows = await tx.query<DbRow>(
                `UPDATE ${wt} SET config = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                 WHERE id = $4 AND _upl_deleted = false AND _mhb_deleted = false
                   AND COALESCE(_upl_version, 1) = $5
                 RETURNING *`,
                [JSON.stringify(validatedConfig), now, userId ?? null, current.id, expectedVersion]
            )
            if (!updatedRows[0]) throw this.createConflictError('Layout widget was modified by another request')

            return this.mapZoneWidgetRow(updatedRows[0], templateKey, await this.loadParentInstanceKey(tx, schemaName, updatedRows[0]))
        })
    }

    /**
     * Toggle the is_active flag of a specific zone widget.
     * When deactivated, the widget is excluded from published layout config.
     */
    async toggleLayoutZoneWidgetActive(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        isActive: boolean,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<LayoutZoneWidgetRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            const layoutScope = await this.lockLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) {
                throw this.createNotFoundError('Layout not found')
            }
            const templateKey = this.assertLayoutSupportsWidgets(layoutScope)

            if (this.isScopedEntityLayout(layoutScope)) {
                const resolvedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const currentResolved = resolvedWidgets.find((row) => row.id === widgetId)
                if (!currentResolved) {
                    throw this.createNotFoundError('Zone widget not found')
                }
                this.assertExpectedWidgetVersion(currentResolved, expectedVersion)
                this.assertNoDuplicateActiveSingleInstanceWidgets([
                    ...resolvedWidgets.filter((row) => row.id !== currentResolved.id),
                    { ...currentResolved, isActive }
                ])

                if (!currentResolved.isInherited) {
                    await assertMarketingHeroLayoutMutationPreservesActions(tx, schemaName, layoutId, {
                        widgetId: currentResolved.id,
                        widgetKey: currentResolved.widgetKey,
                        config: currentResolved.config,
                        kind: 'set-active',
                        isActive
                    })
                    const now = new Date()
                    const updatedRows = await tx.query<DbRow>(
                        `UPDATE ${wt} SET is_active = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                         WHERE id = $4 AND _upl_deleted = false AND _mhb_deleted = false
                           AND COALESCE(_upl_version, 1) = $5
                         RETURNING *`,
                        [isActive, now, userId ?? null, currentResolved.id, expectedVersion]
                    )
                    if (!updatedRows[0]) throw this.createConflictError('Layout widget was modified by another request')
                } else if (currentResolved.baseWidgetId) {
                    const overridePolicy = resolveWidgetPlacementOverridePolicy(
                        currentResolved.templateKey,
                        currentResolved.widgetKey,
                        currentResolved.config
                    )
                    if (!overridePolicy.canDeactivate && isActive !== currentResolved.baseIsActive) {
                        throw new MetahubValidationError(
                            'Inherited widget activation is locked by the base layout and cannot be changed.',
                            {
                                widgetId: currentResolved.id,
                                widgetKey: currentResolved.widgetKey,
                                layoutId
                            }
                        )
                    }

                    await assertMarketingHeroLayoutMutationPreservesActions(tx, schemaName, layoutId, {
                        widgetId: currentResolved.id,
                        widgetKey: currentResolved.widgetKey,
                        config: currentResolved.config,
                        kind: 'set-active',
                        isActive
                    })

                    await this.upsertLayoutWidgetOverride(tx, schemaName, {
                        layoutId: layoutId,
                        baseWidgetId: currentResolved.baseWidgetId,
                        templateKey,
                        widgetKey: currentResolved.widgetKey,
                        baseConfig: currentResolved.config,
                        patch: {
                            isActive: this.resolveScopedWidgetActiveOverride(isActive, currentResolved.baseIsActive),
                            isDeletedOverride: false
                        },
                        userId,
                        expectedVersion
                    })
                }

                await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
                const refreshed = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const updated = refreshed.find((row) => row.id === widgetId)
                if (!updated) {
                    throw this.createNotFoundError('Zone widget not found')
                }
                return this.mapResolvedLayoutWidgetState(updated)
            }

            const current = await queryOne<DbRow>(tx, `SELECT * FROM ${wt} WHERE id = $1 AND layout_id = $2 AND ${ACTIVE}`, [
                widgetId,
                layoutId
            ])
            if (!current) {
                throw this.createNotFoundError('Zone widget not found')
            }
            this.assertExpectedWidgetVersion(current, expectedVersion)

            const widgetKey = applicationLayoutWidgetKeySchema.parse(current.widget_key)
            const zone = applicationLayoutZoneSchema.parse(current.zone)
            this.assertWidgetAllowedInZone(templateKey, widgetKey, zone)
            const currentConfig = this.parseWidgetConfig(templateKey, widgetKey, current.config)

            const existingWidgetRows = await queryMany<DbRow>(
                tx,
                `SELECT id, widget_key, is_active FROM ${wt}
                 WHERE layout_id = $1 AND ${ACTIVE}
                 FOR UPDATE`,
                [layoutId]
            )
            this.assertNoDuplicateActiveSingleInstanceWidgets(
                existingWidgetRows.map((row) => ({
                    ...row,
                    isActive: String(row.id) === String(current.id) ? isActive : row.is_active
                }))
            )

            await assertMarketingHeroLayoutMutationPreservesActions(tx, schemaName, layoutId, {
                widgetId: String(current.id),
                widgetKey,
                config: currentConfig,
                kind: 'set-active',
                isActive
            })

            const now = new Date()
            const updatedRows = await tx.query<DbRow>(
                `UPDATE ${wt} SET is_active = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                 WHERE id = $4 AND _upl_deleted = false AND _mhb_deleted = false
                   AND COALESCE(_upl_version, 1) = $5
                 RETURNING *`,
                [isActive, now, userId ?? null, current.id, expectedVersion]
            )
            if (!updatedRows[0]) throw this.createConflictError('Layout widget was modified by another request')

            await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)

            return this.mapZoneWidgetRow(updatedRows[0], templateKey, await this.loadParentInstanceKey(tx, schemaName, updatedRows[0]))
        })
    }
}
