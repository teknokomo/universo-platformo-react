import type { SqlQueryable } from '@universo-react/utils/database'
import { queryMany, queryOne } from '@universo-react/utils/database'
import { qSchemaTable } from '@universo-react/database'
import {
    decodeWidgetConfigEnvelope,
    encodeLayoutConfigEnvelope,
    encodeWidgetConfigEnvelope,
    applicationLayoutWidgetKeySchema,
    applicationLayoutZoneSchema,
    type ApplicationLayoutWidgetKey,
    type ApplicationLayoutZone,
    applicationTemplateKeySchema
} from '@universo-react/types'
import { generateUuidV7 } from '@universo-react/utils'
import { DEFAULT_DASHBOARD_ZONE_WIDGETS } from '../../shared/layoutDefaults'
import { MetahubNotFoundError, MetahubValidationError } from '../../shared/domainErrors'
import { assertLayoutWidgetBindingAuthority, layoutWidgetOwnsComposition, requireLayoutWidgetOwnership } from '../widgetOwnership'
import { assertAllowedLayoutWidgetChild } from '../widgetOwnership'
import { validateLayoutWidgetPlacementGraph } from '../widgetPlacementGraph'
import {
    type LayoutTemplateKey,
    type LayoutZoneWidgetRow,
    type DbRow,
    type ZoneSortOrderRow,
    type ZoneWidgetConfigRow,
    type LayoutScopeRow,
    type LayoutWidgetOverrideDbRow,
    type ResolvedLayoutWidgetState,
    isRecord,
    resolveWidgetPlacementOverridePolicy,
    LAYOUT_ZONES_BY_TEMPLATE,
    decodeLayoutForStorage,
    decodeWidgetForStorage,
    withIndependentLayoutComposition
} from './layoutServiceContracts'
import { MetahubLayoutServiceBase } from './layoutServiceBase'

/** Provides the placement support operations used by the public layout service. */
export class MetahubLayoutPlacementSupport extends MetahubLayoutServiceBase {
    protected resolveScopedWidgetActiveOverride(isActive: boolean, baseIsActive: boolean | null): boolean | null {
        if (baseIsActive === null) {
            return isActive
        }

        return isActive === baseIsActive ? null : isActive
    }

    protected async softDeleteLayoutWidgetOverride(
        db: SqlQueryable,
        schemaName: string,
        overrideId: string,
        userId?: string | null,
        expectedVersion?: number
    ): Promise<void> {
        const ot = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
        const now = new Date()

        const removedRows = await db.query<{ id: string }>(
            `UPDATE ${ot} SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                _upl_updated_at = $1, _upl_updated_by = $2, _upl_version = _upl_version + 1
             WHERE id = $3 AND _upl_deleted = false AND _mhb_deleted = false
               AND ($4::int IS NULL OR COALESCE(_upl_version, 1) = $4)
             RETURNING id`,
            [now, userId ?? null, overrideId, expectedVersion ?? null]
        )
        if (!removedRows[0]) {
            throw this.createConflictError('Layout widget override was modified by another request')
        }
    }

    protected async normalizeZoneSortOrders(
        db: SqlQueryable,
        schemaName: string,
        layoutId: string,
        zone: ApplicationLayoutZone,
        userId?: string | null
    ): Promise<void> {
        const qt = qSchemaTable(schemaName, '_mhb_widgets')
        const rows = await queryMany<ZoneSortOrderRow>(
            db,
            `SELECT id, sort_order FROM ${qt}
             WHERE layout_id = $1 AND zone = $2 AND _upl_deleted = false AND _mhb_deleted = false
             ORDER BY sort_order ASC, _upl_created_at ASC`,
            [layoutId, zone]
        )

        const needsNormalization = rows.some((row, index) => row.sort_order !== index + 1)
        if (!needsNormalization) return

        // The active widget index includes sort_order. Move the whole zone out
        // of the destination range first; updating rows one-by-one from 0, 1,
        // ... would otherwise transiently collide with the unique index.
        const temporaryOffset = rows.length + 1
        await db.query(
            `UPDATE ${qt}
                SET sort_order = sort_order + $1,
                    _upl_updated_at = $2,
                    _upl_updated_by = $3,
                    _upl_version = _upl_version + 1
              WHERE layout_id = $4
                AND zone = $5
                AND _upl_deleted = false
                AND _mhb_deleted = false`,
            [temporaryOffset, new Date(), userId ?? null, layoutId, zone]
        )

        const now = new Date()
        for (let i = 0; i < rows.length; i += 1) {
            const nextOrder = i + 1
            await db.query(
                `UPDATE ${qt} SET sort_order = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                 WHERE id = $4`,
                [nextOrder, now, userId ?? null, rows[i].id]
            )
        }
    }

    protected async persistGlobalLayoutWidgetOrder(
        db: SqlQueryable,
        schemaName: string,
        layoutId: string,
        orderedWidgets: Array<{ id: string; zone: ApplicationLayoutZone; sortOrder: number }>,
        affectedZones: readonly ApplicationLayoutZone[],
        userId?: string | null,
        expectedPlacement?: { widgetId: string; expectedVersion: number }
    ): Promise<void> {
        if (orderedWidgets.length === 0 || affectedZones.length === 0) return

        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const uniqueZones = [...new Set(affectedZones)]
        const temporaryOffset = orderedWidgets.length + 1
        const now = new Date()

        // Move every affected row outside the destination range first. Updating
        // the moved row alone can leave a same-order tie; the subsequent
        // normalizer would then use creation time and silently restore the old
        // order. The two-phase write makes the requested sequence authoritative.
        await db.query(
            `UPDATE ${wt}
                SET sort_order = sort_order + $1
              WHERE layout_id = $2
                AND zone = ANY($3::text[])
                AND _upl_deleted = false
                AND _mhb_deleted = false`,
            [temporaryOffset, layoutId, uniqueZones]
        )

        const updatedRows = await db.query<{ id: string }>(
            `WITH incoming AS (
                SELECT *
                FROM unnest($2::uuid[], $3::text[], $4::int[]) AS input_values(id, zone, sort_order)
             )
             UPDATE ${wt} AS widget
                SET zone = incoming.zone,
                    sort_order = incoming.sort_order,
                    _upl_updated_at = $5,
                    _upl_updated_by = $6,
                    _upl_version = COALESCE(widget._upl_version, 1) + 1
               FROM incoming
              WHERE widget.id = incoming.id
                AND widget.layout_id = $1
                AND widget._upl_deleted = false
                AND widget._mhb_deleted = false
                AND ($7::uuid IS NULL OR widget.id <> $7::uuid OR COALESCE(widget._upl_version, 1) = $8)
             RETURNING widget.id`,
            [
                layoutId,
                orderedWidgets.map((widget) => widget.id),
                orderedWidgets.map((widget) => widget.zone),
                orderedWidgets.map((widget) => widget.sortOrder),
                now,
                userId ?? null,
                expectedPlacement?.widgetId ?? null,
                expectedPlacement?.expectedVersion ?? null
            ]
        )

        if (updatedRows.length !== orderedWidgets.length) {
            throw this.createConflictError('Layout widget order was modified by another request')
        }
    }

    protected assertLayoutWidgetBindingOwnership(
        scope: LayoutScopeRow | DbRow | null | undefined,
        templateKey: LayoutTemplateKey,
        widgetKey: string,
        config: Record<string, unknown>
    ): void {
        const definition = requireLayoutWidgetOwnership(templateKey, widgetKey, config)
        assertLayoutWidgetBindingAuthority({
            definition,
            lineage: {
                scopeEntityId: typeof scope?.scope_entity_id === 'string' ? scope.scope_entity_id : null,
                baseLayoutId: typeof scope?.base_layout_id === 'string' ? scope.base_layout_id : null
            },
            hasBindings:
                definition.sourcePolicy.sourceMode === 'required' ||
                (definition.bindingSlots?.length ?? 0) > 0 ||
                (definition.bindingSlotFamilies?.length ?? 0) > 0
        })
    }

    protected async listResolvedLayoutWidgetStates(
        db: SqlQueryable,
        schemaName: string,
        layoutScope: LayoutScopeRow
    ): Promise<ResolvedLayoutWidgetState[]> {
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ot = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
        const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'
        const templateKey = this.assertLayoutSupportsWidgets(layoutScope)

        if (!this.isScopedEntityLayout(layoutScope)) {
            const rows = await queryMany<DbRow>(
                db,
                `SELECT * FROM ${wt} WHERE layout_id = $1 AND ${ACTIVE}
                 ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
                [layoutScope.id]
            )

            const instanceKeyById = new Map(rows.map((row) => [String(row.id), this.getPlacementInstanceKey(row.instance_key)]))
            const resolvedRows = rows.map((row) => {
                const widgetKey = applicationLayoutWidgetKeySchema.parse(row.widget_key)
                const zone = applicationLayoutZoneSchema.parse(row.zone)
                this.assertWidgetAllowedInZone(templateKey, widgetKey, zone)
                return {
                    id: String(row.id),
                    layoutId: String(row.layout_id),
                    templateKey,
                    widgetKey,
                    instanceKey: this.getPlacementInstanceKey(row.instance_key),
                    parentWidgetId: typeof row.parent_widget_id === 'string' ? row.parent_widget_id : null,
                    parentInstanceKey: typeof row.parent_widget_id === 'string' ? instanceKeyById.get(row.parent_widget_id) ?? null : null,
                    slotKey: typeof row.slot_key === 'string' ? row.slot_key : null,
                    zone,
                    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 1,
                    config: this.parseWidgetConfig(templateKey, widgetKey, row.config),
                    isActive: row.is_active !== false,
                    createdAt: String(row._upl_created_at),
                    updatedAt: String(row._upl_updated_at),
                    isInherited: false,
                    baseWidgetId: null,
                    baseZone: null,
                    baseSortOrder: null,
                    baseIsActive: null,
                    isOverridden: false,
                    version: typeof row._upl_version === 'number' ? row._upl_version : 1
                } satisfies ResolvedLayoutWidgetState
            })
            this.assertNoDuplicateActiveSingleInstanceWidgets(resolvedRows)
            this.assertUniquePlacementInstanceKeys(resolvedRows)
            this.assertPlacementGraph(templateKey, resolvedRows)
            return resolvedRows
        }

        const baseLayoutId = String(layoutScope.base_layout_id)
        const baseRows = await queryMany<DbRow>(
            db,
            `SELECT * FROM ${wt} WHERE layout_id = $1 AND ${ACTIVE}
             ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
            [baseLayoutId]
        )
        const ownedRows = await queryMany<DbRow>(
            db,
            `SELECT * FROM ${wt} WHERE layout_id = $1 AND ${ACTIVE}
             ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
            [layoutScope.id]
        )
        const overrideRows = await queryMany<LayoutWidgetOverrideDbRow>(
            db,
            `SELECT * FROM ${ot} WHERE layout_id = $1 AND ${ACTIVE}
             ORDER BY _upl_created_at ASC`,
            [layoutScope.id]
        )
        const overrideMap = new Map(overrideRows.map((row) => [String(row.base_widget_id), row]))
        const instanceKeyById = new Map(
            [...baseRows, ...ownedRows].map((row) => [String(row.id), this.getPlacementInstanceKey(row.instance_key)])
        )

        const resolved: ResolvedLayoutWidgetState[] = []

        for (const row of baseRows) {
            const baseWidgetId = String(row.id)
            const baseInstanceKey = this.getPlacementInstanceKey(row.instance_key)
            const override = overrideMap.get(baseWidgetId)
            const widgetKey = applicationLayoutWidgetKeySchema.parse(row.widget_key)
            const baseZone = applicationLayoutZoneSchema.parse(row.zone)
            const baseConfig = this.parseWidgetConfig(templateKey, widgetKey, row.config)
            const overridePolicy = resolveWidgetPlacementOverridePolicy(templateKey, widgetKey, baseConfig)
            if (override?.is_deleted_override === true && overridePolicy.canExclude) {
                continue
            }

            const resolvedZone =
                !overridePolicy.canChangeZone || !override?.zone ? baseZone : applicationLayoutZoneSchema.parse(override.zone)
            this.assertWidgetAllowedInZone(templateKey, widgetKey, resolvedZone)
            const resolvedConfig = isRecord(override?.config)
                ? this.resolveMarketingOverlayWidgetConfig(templateKey, widgetKey, resolvedZone, baseConfig, override.config)
                : baseConfig

            resolved.push({
                id: baseWidgetId,
                layoutId: layoutScope.id,
                templateKey,
                widgetKey,
                instanceKey: baseInstanceKey,
                parentWidgetId: typeof row.parent_widget_id === 'string' ? row.parent_widget_id : null,
                parentInstanceKey: typeof row.parent_widget_id === 'string' ? instanceKeyById.get(row.parent_widget_id) ?? null : null,
                slotKey: typeof row.slot_key === 'string' ? row.slot_key : null,
                zone: resolvedZone,
                sortOrder:
                    overridePolicy.canReorder && typeof override?.sort_order === 'number'
                        ? override.sort_order
                        : typeof row.sort_order === 'number'
                        ? row.sort_order
                        : 1,
                config: resolvedConfig,
                isActive:
                    overridePolicy.canDeactivate && typeof override?.is_active === 'boolean' ? override.is_active : row.is_active !== false,
                createdAt: String(row._upl_created_at),
                updatedAt: String(override?._upl_updated_at ?? row._upl_updated_at),
                isInherited: true,
                baseWidgetId,
                baseZone,
                baseSortOrder: typeof row.sort_order === 'number' ? row.sort_order : 1,
                baseIsActive: row.is_active !== false,
                baseVersion: typeof row._upl_version === 'number' ? row._upl_version : 1,
                isOverridden: Boolean(override),
                version:
                    typeof override?._upl_version === 'number'
                        ? override._upl_version
                        : typeof row._upl_version === 'number'
                        ? row._upl_version
                        : 1
            })
        }

        for (const row of ownedRows) {
            const widgetKey = applicationLayoutWidgetKeySchema.parse(row.widget_key)
            const zone = applicationLayoutZoneSchema.parse(row.zone)
            this.assertWidgetAllowedInZone(templateKey, widgetKey, zone)
            resolved.push({
                id: String(row.id),
                layoutId: String(row.layout_id),
                templateKey,
                widgetKey,
                instanceKey: this.getPlacementInstanceKey(row.instance_key),
                parentWidgetId: typeof row.parent_widget_id === 'string' ? row.parent_widget_id : null,
                parentInstanceKey: typeof row.parent_widget_id === 'string' ? instanceKeyById.get(row.parent_widget_id) ?? null : null,
                slotKey: typeof row.slot_key === 'string' ? row.slot_key : null,
                zone,
                sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 1,
                config: this.parseWidgetConfig(templateKey, widgetKey, row.config),
                isActive: row.is_active !== false,
                createdAt: String(row._upl_created_at),
                updatedAt: String(row._upl_updated_at),
                isInherited: false,
                baseWidgetId: null,
                baseZone: null,
                baseSortOrder: null,
                baseIsActive: null,
                baseVersion: undefined,
                isOverridden: false,
                version: typeof row._upl_version === 'number' ? row._upl_version : 1
            })
        }

        this.assertNoDuplicateActiveSingleInstanceWidgets(resolved)
        this.assertUniquePlacementInstanceKeys(resolved)
        this.assertPlacementGraph(templateKey, resolved)

        return resolved.sort((a, b) => {
            if (a.zone !== b.zone) return a.zone.localeCompare(b.zone)
            if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
            return a.id.localeCompare(b.id)
        })
    }

    protected assertPlacementGraph(
        templateKey: LayoutTemplateKey,
        rows: readonly {
            id: string
            instanceKey: unknown
            parentWidgetId: unknown
            slotKey: unknown
            widgetKey: unknown
            zone: unknown
            config: unknown
        }[]
    ): void {
        try {
            validateLayoutWidgetPlacementGraph(
                templateKey,
                rows.map((row) => ({
                    id: row.id,
                    instanceKey: row.instanceKey,
                    parentWidgetId: row.parentWidgetId,
                    slotKey: row.slotKey,
                    widgetKey: row.widgetKey,
                    zone: row.zone,
                    config: row.config
                }))
            )
        } catch (error) {
            throw new MetahubValidationError('Layout widget placement graph is invalid', {
                reason: error instanceof Error ? error.message : 'Invalid placement graph'
            })
        }
    }

    protected resolvePlacementParent(
        templateKey: LayoutTemplateKey,
        rows: readonly ResolvedLayoutWidgetState[],
        childWidgetKey: string,
        childConfig: Record<string, unknown>,
        zone: ApplicationLayoutZone,
        parentInstanceKey?: string,
        slotKey?: string
    ): string | null {
        if (!parentInstanceKey || !slotKey) return null
        const parent = rows.find((row) => row.instanceKey === parentInstanceKey)
        if (!parent) throw new MetahubNotFoundError('Layout widget parent', parentInstanceKey)
        if (parent.zone !== zone) throw new MetahubValidationError('Nested placements must remain in the parent zone')
        const parentDefinition = requireLayoutWidgetOwnership(templateKey, parent.widgetKey, parent.config)
        const childDefinition = requireLayoutWidgetOwnership(templateKey, childWidgetKey, childConfig)
        if (
            parent.isInherited &&
            !layoutWidgetOwnsComposition(parentDefinition, {
                scopeEntityId: null,
                baseLayoutId: parent.layoutId,
                sourceBaseWidgetId: parent.baseWidgetId
            })
        ) {
            throw new MetahubValidationError('Inherited placement does not own child composition')
        }
        assertAllowedLayoutWidgetChild(parentDefinition, childDefinition, slotKey)
        return parent.id
    }

    protected resolvePlacementSubtree<T extends { id: string; parentWidgetId: string | null }>(rows: readonly T[], rootId: string): T[] {
        const byId = new Map(rows.map((row) => [row.id, row]))
        if (!byId.has(rootId)) throw this.createNotFoundError('Zone widget not found')
        const descendants = new Set<string>([rootId])
        let changed = true
        while (changed) {
            changed = false
            for (const row of rows) {
                if (row.parentWidgetId && descendants.has(row.parentWidgetId) && !descendants.has(row.id)) {
                    descendants.add(row.id)
                    changed = true
                }
            }
        }
        return rows.filter((row) => descendants.has(row.id))
    }

    protected projectScopedWidgetConfigOverride(
        templateKey: LayoutTemplateKey,
        widgetKey: ApplicationLayoutWidgetKey,
        zone: ApplicationLayoutZone,
        config: Record<string, unknown>
    ): Record<string, unknown> {
        const decoded = decodeWidgetConfigEnvelope(config, { templateKey, widgetKey, zone })
        const definition = requireLayoutWidgetOwnership(templateKey, widgetKey, decoded.rendererConfig)
        const neutral = { ...decoded.neutral }
        if (definition.sourcePolicy.inheritBindings) delete neutral.bindings
        return encodeWidgetConfigEnvelope({ rendererConfig: decoded.rendererConfig, neutral }, { templateKey, widgetKey, zone })
    }

    protected async upsertLayoutWidgetOverride(
        db: SqlQueryable,
        schemaName: string,
        args: {
            layoutId: string
            baseWidgetId: string
            templateKey: LayoutTemplateKey
            widgetKey: ApplicationLayoutWidgetKey
            baseConfig?: Record<string, unknown>
            patch: {
                zone?: ApplicationLayoutZone | null
                sortOrder?: number | null
                config?: Record<string, unknown> | null
                isActive?: boolean | null
                isDeletedOverride?: boolean
            }
            userId?: string | null
            expectedVersion?: number
        }
    ): Promise<void> {
        const { layoutId, baseWidgetId, templateKey, widgetKey, baseConfig, patch, userId, expectedVersion } = args
        const ot = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const now = new Date()

        const baseWidget =
            expectedVersion === undefined
                ? null
                : await queryOne<DbRow>(
                      db,
                      `SELECT id, _upl_version
                         FROM ${wt}
                        WHERE id = $1
                          AND _upl_deleted = false
                          AND _mhb_deleted = false
                        FOR UPDATE`,
                      [baseWidgetId]
                  )
        if (expectedVersion !== undefined && !baseWidget) {
            throw this.createNotFoundError('Base layout widget not found')
        }

        const existing = await queryOne<LayoutWidgetOverrideDbRow>(
            db,
            `SELECT * FROM ${ot}
             WHERE layout_id = $1 AND base_widget_id = $2 AND _upl_deleted = false AND _mhb_deleted = false`,
            [layoutId, baseWidgetId]
        )

        const existingZone = typeof existing?.zone === 'string' ? applicationLayoutZoneSchema.parse(existing.zone) : null
        const existingSortOrder = typeof existing?.sort_order === 'number' ? existing.sort_order : null
        const existingConfig = isRecord(existing?.config) ? existing.config : null
        const existingIsActive = typeof existing?.is_active === 'boolean' ? existing.is_active : null
        const nextZone = patch.zone !== undefined ? patch.zone : existingZone
        const nextSortOrder = patch.sortOrder !== undefined ? patch.sortOrder : existingSortOrder
        let nextConfig = patch.config !== undefined ? patch.config : existingConfig
        if (nextConfig !== null) {
            if (!baseConfig) {
                throw new MetahubValidationError('Layout widget override requires its base widget configuration')
            }
            const configZone = nextZone ?? this.resolveWidgetZone(templateKey, widgetKey, baseConfig)
            nextConfig = this.encodeMarketingOverlayWidgetOverrideConfig(templateKey, widgetKey, configZone, baseConfig, nextConfig)
        }
        const nextIsActive = patch.isActive !== undefined ? patch.isActive : existingIsActive
        const nextIsDeletedOverride = patch.isDeletedOverride === true

        if (!nextIsDeletedOverride && nextZone === null && nextSortOrder === null && nextConfig === null && nextIsActive === null) {
            if (existing?.id) {
                await this.softDeleteLayoutWidgetOverride(db, schemaName, existing.id, userId, expectedVersion)
            }
            return
        }

        if (existing) {
            this.assertExpectedWidgetVersion(existing, expectedVersion)
            const updatedRows = await db.query<{ id: string }>(
                `UPDATE ${ot}
                 SET zone = $1,
                     sort_order = $2,
                     config = $3,
                     is_active = $4,
                     is_deleted_override = $5,
                     _upl_updated_at = $6,
                     _upl_updated_by = $7,
                     _upl_version = _upl_version + 1
                 WHERE id = $8 AND _upl_deleted = false AND _mhb_deleted = false
                   AND ($9::int IS NULL OR COALESCE(_upl_version, 1) = $9)
                 RETURNING id`,
                [
                    nextZone,
                    nextSortOrder,
                    nextConfig === null ? null : JSON.stringify(nextConfig),
                    nextIsActive,
                    nextIsDeletedOverride,
                    now,
                    userId ?? null,
                    existing.id,
                    expectedVersion ?? null
                ]
            )
            if (!updatedRows[0]) {
                throw this.createConflictError('Layout widget override was modified by another request')
            }
            return
        }

        if (baseWidget) {
            this.assertExpectedWidgetVersion(baseWidget, expectedVersion)
        }

        await db.query<{ id: string }>(
            `INSERT INTO ${ot} (
                layout_id, base_widget_id, zone, sort_order, config, is_active, is_deleted_override,
                _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                _mhb_published, _mhb_archived, _mhb_deleted
             ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $8, $9,
                1, false, false, false,
                true, false, false
             )
             RETURNING id`,
            [
                layoutId,
                baseWidgetId,
                nextZone,
                nextSortOrder,
                nextConfig === null ? null : JSON.stringify(nextConfig),
                nextIsActive,
                nextIsDeletedOverride,
                now,
                userId ?? null
            ]
        )
    }

    protected async normalizeResolvedScopedLayoutSortOrders(
        db: SqlQueryable,
        schemaName: string,
        layoutScope: LayoutScopeRow,
        widgets: ResolvedLayoutWidgetState[],
        userId?: string | null
    ): Promise<void> {
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const now = new Date()
        const templateKey = this.assertLayoutSupportsWidgets(layoutScope)

        for (const zone of LAYOUT_ZONES_BY_TEMPLATE[templateKey]) {
            const zoneItems = widgets
                .filter((item) => item.zone === zone)
                .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))

            const ownedZoneItems = zoneItems.filter((item) => !item.isInherited)
            if (ownedZoneItems.length > 0) {
                // Owned rows are protected by the same active unique index as
                // global widgets. Shift them before assigning compact orders
                // so a reorder/delete cannot fail on a transient collision.
                await db.query(
                    `UPDATE ${wt}
                        SET sort_order = sort_order + $1,
                            _upl_updated_at = $2,
                            _upl_updated_by = $3,
                            _upl_version = _upl_version + 1
                      WHERE layout_id = $4
                        AND zone = $5
                        AND _upl_deleted = false
                        AND _mhb_deleted = false`,
                    [zoneItems.length + 1, new Date(), userId ?? null, layoutScope.id, zone]
                )
            }

            for (let index = 0; index < zoneItems.length; index += 1) {
                const item = zoneItems[index]
                const nextSortOrder = index + 1
                if (item.isInherited && item.baseWidgetId) {
                    const overridePolicy = resolveWidgetPlacementOverridePolicy(item.templateKey, item.widgetKey, item.config)
                    await this.upsertLayoutWidgetOverride(db, schemaName, {
                        layoutId: layoutScope.id,
                        baseWidgetId: item.baseWidgetId,
                        templateKey,
                        widgetKey: item.widgetKey,
                        baseConfig: item.config,
                        patch: {
                            zone: overridePolicy.canChangeZone && item.baseZone !== null && item.zone !== item.baseZone ? item.zone : null,
                            sortOrder:
                                overridePolicy.canReorder && item.baseSortOrder !== null && nextSortOrder !== item.baseSortOrder
                                    ? nextSortOrder
                                    : null,
                            isActive:
                                overridePolicy.canDeactivate && item.baseIsActive !== null && item.isActive !== item.baseIsActive
                                    ? item.isActive
                                    : null,
                            isDeletedOverride: false
                        },
                        userId
                    })
                } else {
                    await db.query(
                        `UPDATE ${wt} SET zone = $1, sort_order = $2,
                            _upl_updated_at = $3, _upl_updated_by = $4, _upl_version = _upl_version + 1
                         WHERE id = $5 AND _upl_deleted = false AND _mhb_deleted = false`,
                        [item.zone, nextSortOrder, now, userId ?? null, item.id]
                    )
                }
            }
        }
    }

    protected mapResolvedLayoutWidgetState(row: ResolvedLayoutWidgetState): LayoutZoneWidgetRow {
        const presentation = this.mapWidgetPresentation(row.templateKey, row.widgetKey, row.zone, row.config)
        const instanceKey = this.getPlacementInstanceKey(row.instanceKey)
        this.assertSemanticPlacementPair(row.id, row.parentInstanceKey, row.slotKey)
        return {
            id: row.id,
            layoutId: row.layoutId,
            zone: row.zone,
            widgetKey: row.widgetKey,
            instanceKey,
            parentInstanceKey: row.parentInstanceKey,
            slotKey: row.slotKey,
            placementPolicy: resolveWidgetPlacementOverridePolicy(row.templateKey, row.widgetKey, row.config),
            sortOrder: row.sortOrder,
            config: presentation.config,
            ...(presentation.placement === undefined ? {} : { placement: presentation.placement }),
            isActive: row.isActive,
            isInherited: row.isInherited,
            isOverridden: row.isOverridden,
            version: row.version,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }
    }

    protected async syncLayoutConfigFromZoneWidgets(
        db: SqlQueryable,
        schemaName: string,
        layoutId: string,
        userId?: string | null
    ): Promise<void> {
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const layoutRow = await this.lockLayoutScopeRow(db, schemaName, layoutId)
        if (!layoutRow) {
            return
        }

        const templateKey = applicationTemplateKeySchema.parse(layoutRow.template_key)

        const currentEnvelope = decodeLayoutForStorage(templateKey, layoutRow.config ?? {})
        const currentVersion = typeof layoutRow.version === 'number' ? layoutRow.version : 1
        const nextRendererConfig = currentEnvelope.rendererConfig

        if (templateKey === 'dashboard' && !this.isScopedEntityLayout(layoutRow)) {
            const widgetRows = await queryMany<ZoneWidgetConfigRow>(
                db,
                `SELECT widget_key, zone, is_active FROM ${wt}
                 WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
                 FOR UPDATE`,
                [layoutId]
            )
            this.assertNoDuplicateActiveSingleInstanceWidgets(widgetRows)
        }

        let nextConfig = encodeLayoutConfigEnvelope(
            { rendererConfig: nextRendererConfig, neutral: currentEnvelope.neutral },
            { templateKey }
        )
        if (templateKey === 'marketing-page' && !this.isScopedEntityLayout(layoutRow)) {
            nextConfig = withIndependentLayoutComposition(templateKey, nextConfig)
        }

        const updatedRows = await db.query<{ id: string }>(
            `UPDATE ${lt} SET config = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
             WHERE id = $4 AND _upl_deleted = false AND _mhb_deleted = false
               AND COALESCE(_upl_version, 1) = $5
             RETURNING id`,
            [JSON.stringify(nextConfig), new Date(), userId ?? null, layoutId, currentVersion]
        )
        if (!updatedRows[0]) throw this.createConflictError('Layout was modified by another request')
    }

    protected async ensureDefaultZoneWidgets(
        db: SqlQueryable,
        schemaName: string,
        layoutId: string,
        userId?: string | null
    ): Promise<void> {
        const wt = qSchemaTable(schemaName, '_mhb_widgets')

        // The layout row is the serialization point for both the empty check
        // and the seed inserts. A row-level lock makes two read requests that
        // initialize the same layout observe one committed seed only.
        const layoutRow = await this.lockLayoutScopeRow(db, schemaName, layoutId)

        if (!layoutRow) {
            return
        }

        const templateKey = applicationTemplateKeySchema.parse(layoutRow.template_key)
        if (templateKey !== 'dashboard') {
            return
        }

        // Scoped layouts either inherit placements from their base or start as
        // independent compositions. The default widget preset belongs only to
        // the global layout and must not mutate a scoped layout's version as a
        // side effect of its first explicit widget assignment.
        if (typeof layoutRow.scope_entity_id === 'string') {
            return
        }

        if (this.shouldSkipDefaultZoneWidgetSeed(layoutRow.config)) {
            return
        }

        const existingRows = await db.query<DbRow>(
            `SELECT id, widget_key, zone, is_active FROM ${wt}
             WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
             FOR UPDATE`,
            [layoutId]
        )
        this.assertNoDuplicateActiveSingleInstanceWidgets(existingRows)
        if (existingRows.length > 0) {
            return
        }

        this.assertNoDuplicateActiveSingleInstanceWidgets(DEFAULT_DASHBOARD_ZONE_WIDGETS)
        const now = new Date()
        for (const item of DEFAULT_DASHBOARD_ZONE_WIDGETS) {
            const widgetKey = applicationLayoutWidgetKeySchema.parse(item.widgetKey)
            const zone = applicationLayoutZoneSchema.parse(item.zone)
            const ownership = requireLayoutWidgetOwnership(templateKey, widgetKey, item.config ?? {})
            if (ownership.sourcePolicy.sourceMode === 'required' || ownership.sourcePolicy.sourceMode === 'specialized') {
                continue
            }
            const widgetEnvelope = decodeWidgetForStorage('dashboard', widgetKey, zone, item.config ?? {})
            const widgetConfig = encodeWidgetConfigEnvelope(
                { rendererConfig: widgetEnvelope.rendererConfig, neutral: widgetEnvelope.neutral },
                { templateKey: 'dashboard', widgetKey, zone }
            )
            const id = generateUuidV7()
            const instanceKey = generateUuidV7()
            const insertedRows = await db.query<{ id: string; instance_key: string }>(
                `INSERT INTO ${wt} (id, layout_id, instance_key, parent_widget_id, slot_key, zone, widget_key, sort_order, config, is_active,
                    _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                    _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                    _mhb_published, _mhb_archived, _mhb_deleted)
                 VALUES ($1, $2, $3, NULL, NULL, $4, $5, $6, $7, $8, $9, $10, $9, $10, 1, false, false, false, true, false, false)
                 RETURNING id, instance_key`,
                [
                    id,
                    layoutId,
                    instanceKey,
                    item.zone,
                    item.widgetKey,
                    item.sortOrder,
                    JSON.stringify(widgetConfig),
                    item.isActive !== false,
                    now,
                    userId ?? null
                ]
            )
            if (insertedRows.length !== 1 || insertedRows[0].id !== id || insertedRows[0].instance_key !== instanceKey) {
                throw this.createConflictError('Default layout widgets could not be initialized')
            }
        }
        await this.syncLayoutConfigFromZoneWidgets(db, schemaName, layoutId, userId)
    }
}
