import { z } from 'zod'
import type { DbExecutor, SqlQueryable } from '@universo-react/utils/database'
import { queryMany, queryOneOrThrow } from '@universo-react/utils/database'
import { qSchemaTable } from '@universo-react/database'
import {
    getLayoutWidgetDefinition,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    applicationLayoutWidgetKeySchema
} from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'
import { MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { requireLayoutWidgetOwnership } from '../widgetOwnership'
import { cloneRecordWidgetBindingsInSubtree } from './cloneRecordWidgetSubtree'
import type { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubWidgetBindingsService } from './MetahubWidgetBindingsService'
import { WidgetBindingService } from '../widgetBindingService'
import { createWidgetBindingSourceProvisioner } from '../widgetBindingSourceProvisioner'
import {
    type LayoutZoneWidgetRow,
    type DbRow,
    type ResolvedLayoutWidgetState,
    isRecord,
    assignLayoutZoneWidgetSchema,
    duplicateLayoutZoneWidgetSchema
} from './layoutServiceContracts'
import { MetahubLayoutCrudService } from './layoutCrudService'

/** Provides the widget placement service operations used by the public layout service. */
export class MetahubLayoutWidgetPlacementService extends MetahubLayoutCrudService {
    private readonly widgetBindingService: WidgetBindingService
    readonly widgetBindings: MetahubWidgetBindingsService

    constructor(exec: DbExecutor, schemaService: MetahubSchemaService) {
        super(exec, schemaService)
        this.widgetBindingService = new WidgetBindingService({
            schemaService,
            provisionSource: createWidgetBindingSourceProvisioner(exec, schemaService),
            syncLayoutConfig: (db, schemaName, layoutId, userId) => this.syncLayoutConfigFromZoneWidgets(db, schemaName, layoutId, userId)
        })
        this.widgetBindings = new MetahubWidgetBindingsService(exec, this.widgetBindingService)
    }

    async listLayoutZoneWidgets(metahubId: string, layoutId: string, userId?: string | null): Promise<LayoutZoneWidgetRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            const lockedLayout = await this.lockLayoutScopeRow(tx, schemaName, layoutId)
            if (!lockedLayout) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }
            await this.ensureDefaultZoneWidgets(tx, schemaName, layoutId, userId ?? null)
            const layoutScope = await this.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }
            if (layoutScope && this.isScopedEntityLayout(layoutScope)) {
                return (await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)).map((row) =>
                    this.mapResolvedLayoutWidgetState(row)
                )
            }

            const templateKey = this.assertLayoutSupportsWidgets(layoutScope)

            const rows = await queryMany<DbRow>(
                tx,
                `SELECT * FROM ${wt} WHERE layout_id = $1 AND ${ACTIVE}
                 ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
                [layoutId]
            )
            const mapped = this.mapZoneWidgetRows(rows, templateKey)
            this.assertUniquePlacementInstanceKeys(mapped)
            this.assertPlacementGraph(
                templateKey,
                rows.map((row) => ({
                    id: String(row.id),
                    instanceKey: row.instance_key,
                    parentWidgetId: row.parent_widget_id,
                    slotKey: row.slot_key,
                    widgetKey: row.widget_key,
                    zone: row.zone,
                    config: this.parseWidgetConfig(templateKey, applicationLayoutWidgetKeySchema.parse(row.widget_key), row.config)
                }))
            )
            return mapped
        })
    }

    async assignLayoutZoneWidget(
        metahubId: string,
        layoutId: string,
        input: z.infer<typeof assignLayoutZoneWidgetSchema>,
        userId?: string | null
    ): Promise<LayoutZoneWidgetRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)

        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'

        return this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            const initialLayoutScope = await this.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!initialLayoutScope) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }
            const initialTemplateKey = this.assertLayoutSupportsWidgets(initialLayoutScope)
            this.assertWidgetAllowedInZone(initialTemplateKey, input.widgetKey, input.zone)
            const parsedWidgetConfig = this.parseWidgetConfig(initialTemplateKey, input.widgetKey, input.config ?? {})
            const widgetConfig = parsedWidgetConfig
            const assignmentRendererConfig = isRecord(parsedWidgetConfig.rendererConfig)
                ? parsedWidgetConfig.rendererConfig
                : parsedWidgetConfig
            const assignmentDefinition = getLayoutWidgetDefinition(input.widgetKey, assignmentRendererConfig)
            this.assertLayoutWidgetBindingOwnership(initialLayoutScope, initialTemplateKey, input.widgetKey, assignmentRendererConfig)
            if (assignmentDefinition?.bindingSlots?.length) {
                await this.widgetBindingService.validateAssignedConfig(tx, schemaName, {
                    templateKey: initialTemplateKey,
                    widgetKey: input.widgetKey,
                    zone: input.zone,
                    config: widgetConfig
                })
            }

            const lockedLayoutScope = await this.lockLayoutScopeRow(tx, schemaName, layoutId)
            if (!lockedLayoutScope) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }
            if (lockedLayoutScope.template_key !== initialLayoutScope.template_key) {
                throw this.createConflictError('Layout template changed during widget assignment')
            }
            await this.ensureDefaultZoneWidgets(tx, schemaName, layoutId, userId ?? null)
            const layoutScope = await this.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) {
                throw new MetahubNotFoundError('Layout', layoutId)
            }
            await this.lockLayoutPlacementRows(tx, schemaName, layoutScope)
            const templateKey = this.assertLayoutSupportsWidgets(layoutScope)
            this.assertWidgetAllowedInZone(templateKey, input.widgetKey, input.zone)
            this.assertLayoutWidgetBindingOwnership(layoutScope, templateKey, input.widgetKey, assignmentRendererConfig)
            const existingPlacements = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
            const widgetId = generateUuidV7()
            const instanceKey = generateUuidV7()
            const parentWidgetId = this.resolvePlacementParent(
                templateKey,
                existingPlacements,
                input.widgetKey,
                assignmentRendererConfig,
                input.zone,
                input.parentInstanceKey,
                input.slotKey
            )
            this.assertPlacementGraph(templateKey, [
                ...existingPlacements,
                {
                    id: widgetId,
                    widgetKey: input.widgetKey,
                    instanceKey,
                    parentWidgetId,
                    slotKey: input.slotKey ?? null,
                    zone: input.zone,
                    config: widgetConfig
                }
            ])

            if (this.isScopedEntityLayout(layoutScope)) {
                const resolvedWidgets = existingPlacements
                const nextSortOrder = input.sortOrder ?? resolvedWidgets.filter((row) => row.zone === input.zone).length + 1

                this.assertNoDuplicateActiveSingleInstanceWidgets([...resolvedWidgets, { widgetKey: input.widgetKey, isActive: true }])

                this.assertUniquePlacementInstanceKeys([...resolvedWidgets, { instanceKey }])

                this.assertExpectedLayoutVersion(layoutScope, input.expectedVersion)
                const inserted = await queryOneOrThrow<DbRow>(
                    tx,
                    `INSERT INTO ${wt} (id, layout_id, instance_key, parent_widget_id, slot_key, zone, widget_key, sort_order, config, is_active,
                        _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                        _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                        _mhb_published, _mhb_archived, _mhb_deleted)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, $10, $11, 1, false, false, false, true, false, false)
                     RETURNING *`,
                    [
                        widgetId,
                        layoutId,
                        instanceKey,
                        parentWidgetId,
                        input.slotKey ?? null,
                        input.zone,
                        input.widgetKey,
                        nextSortOrder,
                        JSON.stringify(widgetConfig),
                        new Date(),
                        userId ?? null
                    ]
                )

                const normalizedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                await this.normalizeResolvedScopedLayoutSortOrders(tx, schemaName, layoutScope, normalizedWidgets, userId ?? null)
                await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)

                const refreshedWidgets = await this.listResolvedLayoutWidgetStates(tx, schemaName, layoutScope)
                const createdWidget = refreshedWidgets.find((row) => row.id === String(inserted.id))
                if (!createdWidget) {
                    throw this.createNotFoundError('Zone widget not found after assignment')
                }
                return this.mapResolvedLayoutWidgetState(createdWidget)
            }

            const now = new Date()
            const zoneRows = await queryMany<{ id: string }>(tx, `SELECT id FROM ${wt} WHERE layout_id = $1 AND zone = $2 AND ${ACTIVE}`, [
                layoutId,
                input.zone
            ])
            const nextSortOrder = input.sortOrder ?? zoneRows.length + 1

            const existingWidgetRows = await queryMany<DbRow>(
                tx,
                `SELECT widget_key, is_active FROM ${wt}
                 WHERE layout_id = $1 AND ${ACTIVE}
                 FOR UPDATE`,
                [layoutId]
            )
            this.assertNoDuplicateActiveSingleInstanceWidgets([...existingWidgetRows, { widgetKey: input.widgetKey, isActive: true }])

            this.assertExpectedLayoutVersion(layoutScope, input.expectedVersion)

            this.assertUniquePlacementInstanceKeys([...existingPlacements, { instanceKey }])

            const inserted = await queryOneOrThrow<DbRow>(
                tx,
                `INSERT INTO ${wt} (id, layout_id, instance_key, parent_widget_id, slot_key, zone, widget_key, sort_order, config, is_active,
                    _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                    _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                    _mhb_published, _mhb_archived, _mhb_deleted)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, $10, $11, 1, false, false, false, true, false, false)
                 RETURNING *`,
                [
                    widgetId,
                    layoutId,
                    instanceKey,
                    parentWidgetId,
                    input.slotKey ?? null,
                    input.zone,
                    input.widgetKey,
                    nextSortOrder,
                    JSON.stringify(widgetConfig),
                    now,
                    userId ?? null
                ]
            )

            await this.normalizeZoneSortOrders(tx, schemaName, layoutId, input.zone, userId ?? null)
            await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)

            const parentInstanceKey: string | null = input.parentInstanceKey ?? null
            return this.mapZoneWidgetRow(inserted, templateKey, parentInstanceKey)
        })
    }

    async duplicateLayoutZoneWidget(
        metahubId: string,
        layoutId: string,
        input: z.infer<typeof duplicateLayoutZoneWidgetSchema>,
        userId?: string | null
    ): Promise<LayoutZoneWidgetRow> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        return this.exec.transaction(async (tx: DbExecutor) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            const layoutScope = await this.lockLayoutScopeRow(tx, schemaName, layoutId)
            if (!layoutScope) throw new MetahubNotFoundError('Layout', layoutId)
            this.assertExpectedLayoutVersion(layoutScope, input.expectedLayoutVersion)
            const templateKey = this.assertLayoutSupportsWidgets(layoutScope)
            await this.ensureDefaultZoneWidgets(tx, schemaName, layoutId, userId ?? null)
            const currentScope = await this.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!currentScope) throw new MetahubNotFoundError('Layout', layoutId)
            await this.lockLayoutPlacementRows(tx, schemaName, currentScope)
            const placements = await this.listResolvedLayoutWidgetStates(tx, schemaName, currentScope)
            const root = placements.find((item) => item.id === input.widgetId)
            if (!root) throw new MetahubNotFoundError('Layout widget', input.widgetId)
            this.assertExpectedWidgetVersion(root, input.expectedVersion)
            const sourceLayoutId = root.isInherited ? String(currentScope.base_layout_id) : layoutId
            const lockedSourceRoot = await tx.query<{ id: string }>(
                `SELECT id FROM ${wt}
                  WHERE id = $1 AND layout_id = $2
                    AND _upl_deleted = false AND _mhb_deleted = false
                    AND COALESCE(_upl_version, 1) = $3
                  FOR UPDATE`,
                [root.id, sourceLayoutId, root.isInherited ? root.baseVersion ?? root.version : input.expectedVersion]
            )
            if (lockedSourceRoot.length !== 1 || lockedSourceRoot[0].id !== root.id) {
                throw this.createConflictError('Layout widget was modified by another request')
            }

            const subtree = this.resolvePlacementSubtree(placements, root.id)
            const byId = new Map(subtree.map((item) => [item.id, item]))
            const depth = (item: ResolvedLayoutWidgetState): number => {
                let result = 0
                let parentId = item.parentWidgetId
                const visited = new Set<string>([item.id])
                while (parentId && byId.has(parentId)) {
                    if (visited.has(parentId)) throw new MetahubValidationError('Layout widget placement graph contains a cycle')
                    visited.add(parentId)
                    result += 1
                    parentId = byId.get(parentId)?.parentWidgetId ?? null
                }
                return result
            }
            const ordered = [...subtree].sort((left, right) => depth(left) - depth(right) || left.sortOrder - right.sortOrder)
            const idMap = new Map(ordered.map((item) => [item.id, generateUuidV7()]))
            const identityMap = new Map(ordered.map((item) => [item.id, generateUuidV7()]))
            const copiedRecordConfigs = await cloneRecordWidgetBindingsInSubtree({
                executor: tx,
                metahubId,
                schemaName,
                templateKey,
                placements: ordered,
                userId
            })
            const rootParent = root.isInherited ? null : root.parentWidgetId
            const rootSlot = root.isInherited ? null : root.slotKey
            const prepared = ordered.map((item) => {
                const definition = requireLayoutWidgetOwnership(templateKey, item.widgetKey, item.config)
                if (definition.copyPolicy.placement !== 'copy') {
                    throw new MetahubValidationError('This widget placement cannot be duplicated', { widgetKey: item.widgetKey })
                }
                if (
                    item.isInherited &&
                    definition.sourcePolicy.inheritBindings &&
                    definition.sourcePolicy.sourceMode !== 'none' &&
                    definition.sourcePolicy.sourceMode !== 'specialized'
                ) {
                    throw new MetahubValidationError('An inherited source-bound placement cannot be detached by placement duplication', {
                        widgetKey: item.widgetKey
                    })
                }
                const decoded = decodeWidgetConfigEnvelope(item.config, {
                    templateKey,
                    widgetKey: item.widgetKey,
                    zone: item.zone,
                    requireBindings: definition.sourcePolicy.sourceMode === 'required'
                })
                let config: Record<string, unknown>
                if (definition.copyPolicy.binding === 'clone-record') {
                    const copiedConfig = copiedRecordConfigs.get(item.id)
                    if (!copiedConfig) {
                        throw new MetahubValidationError('The registered Entity binding could not be copied with its placement', {
                            widgetKey: item.widgetKey
                        })
                    }
                    config = copiedConfig
                } else {
                    const neutral = { ...decoded.neutral }
                    if (definition.copyPolicy.binding === 'none') delete neutral.bindings
                    config = encodeWidgetConfigEnvelope(
                        { rendererConfig: decoded.rendererConfig, neutral },
                        { templateKey, widgetKey: item.widgetKey, zone: item.zone }
                    )
                }
                const parentWidgetId =
                    item.id === root.id ? rootParent : item.parentWidgetId ? idMap.get(item.parentWidgetId) ?? null : null
                const slotKey = item.id === root.id ? rootSlot : item.slotKey
                if (item.parentWidgetId && item.id !== root.id && !parentWidgetId) {
                    throw new MetahubValidationError('A duplicated child placement has no duplicated parent')
                }
                return {
                    source: item,
                    id: idMap.get(item.id) as string,
                    instanceKey: identityMap.get(item.id) as string,
                    parentWidgetId,
                    slotKey,
                    config
                }
            })
            const siblingCount = placements.filter(
                (item) => item.parentWidgetId === rootParent && item.slotKey === rootSlot && item.zone === root.zone
            ).length
            const rootOrder = siblingCount + 1
            const now = new Date()
            const newRows: ResolvedLayoutWidgetState[] = []
            for (const item of prepared) {
                const sortOrder = item.source.id === root.id ? rootOrder : item.source.sortOrder
                const inserted = await tx.query<{ id: string; instance_key: string }>(
                    `INSERT INTO ${wt} (id, layout_id, instance_key, parent_widget_id, slot_key, zone, widget_key, sort_order, config, is_active,
                        _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                        _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                        _mhb_published, _mhb_archived, _mhb_deleted)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $11, $12, 1, false, false, false, true, false, false)
                     RETURNING id, instance_key`,
                    [
                        item.id,
                        layoutId,
                        item.instanceKey,
                        item.parentWidgetId,
                        item.slotKey,
                        item.source.zone,
                        item.source.widgetKey,
                        sortOrder,
                        JSON.stringify(item.config),
                        item.source.isActive,
                        now,
                        userId ?? null
                    ]
                )
                if (inserted.length !== 1 || inserted[0].id !== item.id || inserted[0].instance_key !== item.instanceKey) {
                    throw this.createConflictError('Layout widget subtree could not be duplicated atomically')
                }
                const parentInstanceKey = item.parentWidgetId
                    ? identityMap.get(item.source.parentWidgetId as string) ??
                      placements.find((row) => row.id === item.parentWidgetId)?.instanceKey ??
                      null
                    : null
                if (item.parentWidgetId && !parentInstanceKey) {
                    throw new MetahubValidationError('Duplicated widget parent identity could not be resolved')
                }
                this.assertSemanticPlacementPair(item.id, parentInstanceKey, item.slotKey)
                newRows.push({
                    ...item.source,
                    id: item.id,
                    layoutId,
                    instanceKey: item.instanceKey,
                    parentWidgetId: item.parentWidgetId,
                    parentInstanceKey,
                    slotKey: item.slotKey,
                    sortOrder,
                    config: item.config,
                    isInherited: false,
                    isOverridden: false,
                    baseWidgetId: null,
                    baseZone: null,
                    baseSortOrder: null,
                    baseIsActive: null,
                    version: 1
                })
            }
            this.assertUniquePlacementInstanceKeys([...placements, ...newRows])
            this.assertPlacementGraph(templateKey, [...placements, ...newRows])
            await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
            const refreshedScope = await this.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!refreshedScope) throw new MetahubNotFoundError('Layout', layoutId)
            const refreshed = await this.listResolvedLayoutWidgetStates(tx, schemaName, refreshedScope)
            const createdRoot = refreshed.find((item) => item.id === idMap.get(root.id))
            if (!createdRoot) throw new MetahubNotFoundError('Duplicated layout widget')
            return this.mapResolvedLayoutWidgetState(createdRoot)
        })
    }
}
