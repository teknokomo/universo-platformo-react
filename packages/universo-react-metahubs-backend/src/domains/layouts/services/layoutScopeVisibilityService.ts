import type { SqlQueryable } from '@universo-react/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo-react/utils/database'
import { qSchemaTable } from '@universo-react/database'
import {
    encodeLayoutConfigEnvelope,
    applicationLayoutWidgetKeySchema,
    applicationLayoutZoneSchema,
    isEnabledCapabilityConfig,
    applicationTemplateKeySchema
} from '@universo-react/types'
import { escapeLikeWildcards, uuidV7Schema } from '@universo-react/utils'
import { MetahubValidationError } from '../../shared/domainErrors'
import {
    type MetahubLayoutRow,
    type LayoutWidgetScopeVisibilityRow,
    type LayoutListOptions,
    type DbRow,
    type LayoutScopeRow,
    type LayoutCapableScopeEntityRow,
    resolveWidgetPlacementOverridePolicy,
    decodeLayoutForStorage
} from './layoutServiceContracts'
import { MetahubLayoutPlacementSupport } from './layoutPlacementSupport'

/** Provides the scope visibility service operations used by the public layout service. */
export class MetahubLayoutScopeVisibilityService extends MetahubLayoutPlacementSupport {
    async listLayouts(metahubId: string, options: LayoutListOptions, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const { limit = 20, offset = 0, sortBy = 'updated', sortOrder = 'desc', search, scopeEntityId, includeDeleted = false } = options

        const conditions: string[] = []
        const params: unknown[] = []
        let idx = 1

        if (!includeDeleted) {
            conditions.push('_upl_deleted = false AND _mhb_deleted = false')
        }
        if (search) {
            const escaped = escapeLikeWildcards(search)
            conditions.push(`(COALESCE(name::text, '') ILIKE $${idx} OR COALESCE(description::text, '') ILIKE $${idx})`)
            params.push(`%${escaped}%`)
            idx++
        }

        const scopeClause = this.buildLayoutScopeWhereSql(scopeEntityId ?? null, idx)
        conditions.push(scopeClause.sql)
        params.push(...scopeClause.params)
        idx += scopeClause.params.length

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

        const [totalRow] = await this.exec.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM ${lt} ${whereClause}`, params)
        const total = totalRow?.count ?? 0

        const orderColumn =
            sortBy === 'name'
                ? "COALESCE(name->'locales'->(name->>'_primary')->>'content', name->'locales'->'en'->>'content', '')"
                : sortBy === 'created'
                ? '_upl_created_at'
                : '_upl_updated_at'
        const dir = sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

        const dataParams = [...params, limit, offset]
        const rows = await queryMany<DbRow>(
            this.exec,
            `SELECT * FROM ${lt} ${whereClause}
             ORDER BY ${orderColumn} ${dir}, sort_order ASC, _upl_created_at ASC
             LIMIT $${idx} OFFSET $${idx + 1}`,
            dataParams
        )

        return {
            items: rows.map((r) => this.mapRow(r)),
            pagination: { total, limit, offset }
        }
    }

    async getLayoutById(metahubId: string, layoutId: string, userId?: string): Promise<MetahubLayoutRow | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const row = await queryOne<DbRow>(
            this.exec,
            `SELECT * FROM ${lt} WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false`,
            [layoutId]
        )
        return row ? this.mapRow(row) : null
    }

    async listLayoutWidgetScopeVisibility(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        userId?: string | null
    ): Promise<LayoutWidgetScopeVisibilityRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const ot = qSchemaTable(schemaName, '_mhb_objects')
        const tt = qSchemaTable(schemaName, '_mhb_entity_type_definitions')
        const overridesTable = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')

        const base = await queryOne<{
            layout_id: string
            widget_id: string
            widget_is_active: boolean
            widget_version?: number
        }>(
            this.exec,
            `SELECT l.id AS layout_id,
                    w.id AS widget_id,
                    w.is_active AS widget_is_active,
                    COALESCE(w._upl_version, 1)::int AS widget_version
               FROM ${lt} l
               JOIN ${wt} w
                 ON w.layout_id = l.id
                AND w.id = $2
                AND w._upl_deleted = false
                AND w._mhb_deleted = false
              WHERE l.id = $1
                AND l.scope_entity_id IS NULL
                AND l._upl_deleted = false
                AND l._mhb_deleted = false
              LIMIT 1`,
            [layoutId, widgetId]
        )

        if (!base) {
            throw this.createNotFoundError('Global layout widget not found')
        }

        const scopeRows = await queryMany<LayoutCapableScopeEntityRow>(
            this.exec,
            `SELECT o.id, o.kind, o.codename, o.presentation, o.config, t.capabilities
               FROM ${ot} o
               JOIN ${tt} t
                 ON t.kind_key = o.kind
                AND t._upl_deleted = false
                AND t._mhb_deleted = false
              WHERE o._upl_deleted = false
                AND o._mhb_deleted = false
              ORDER BY o.kind ASC, COALESCE(o.presentation::text, o.codename::text, o.id::text) ASC`,
            []
        )
        const layoutCapableScopes = scopeRows.filter((row) => {
            const capabilities =
                row.capabilities && typeof row.capabilities === 'object' ? (row.capabilities as Record<string, unknown>) : {}
            return isEnabledCapabilityConfig(capabilities.layoutConfig as Parameters<typeof isEnabledCapabilityConfig>[0])
        })

        if (layoutCapableScopes.length === 0) {
            return []
        }

        const scopeIds = layoutCapableScopes.map((row) => row.id)
        const scopedLayoutRows = await queryMany<{
            id: string
            scope_entity_id: string
            name?: unknown
            is_default?: boolean
            is_active?: boolean
            sort_order?: number
            _upl_created_at?: string
        }>(
            this.exec,
            `SELECT id, scope_entity_id, name, is_default, is_active, sort_order, _upl_created_at
               FROM ${lt}
              WHERE base_layout_id = $1
                AND scope_entity_id = ANY($2::uuid[])
                AND _upl_deleted = false
                AND _mhb_deleted = false
              ORDER BY scope_entity_id ASC,
                       is_default DESC,
                       is_active DESC,
                       sort_order ASC,
                       _upl_created_at ASC`,
            [layoutId, scopeIds]
        )

        const scopedLayoutByScope = new Map<string, (typeof scopedLayoutRows)[number]>()
        for (const row of scopedLayoutRows) {
            if (!scopedLayoutByScope.has(row.scope_entity_id)) {
                scopedLayoutByScope.set(row.scope_entity_id, row)
            }
        }

        const scopedLayoutIds = Array.from(scopedLayoutByScope.values()).map((row) => row.id)
        const overrideRows =
            scopedLayoutIds.length > 0
                ? await queryMany<{
                      layout_id: string
                      is_active?: boolean | null
                      is_deleted_override?: boolean
                      version?: number
                  }>(
                      this.exec,
                      `SELECT layout_id, is_active, is_deleted_override,
                                      COALESCE(_upl_version, 1)::int AS version
                         FROM ${overridesTable}
                        WHERE base_widget_id = $1
                          AND layout_id = ANY($2::uuid[])
                          AND _upl_deleted = false
                          AND _mhb_deleted = false`,
                      [widgetId, scopedLayoutIds]
                  )
                : []

        const overrideByLayoutId = new Map(overrideRows.map((row) => [row.layout_id, row]))
        const baseVisible = base.widget_is_active !== false

        return layoutCapableScopes.map((scope) => {
            const scopedLayout = scopedLayoutByScope.get(scope.id) ?? null
            const override = scopedLayout ? overrideByLayoutId.get(scopedLayout.id) ?? null : null
            const isVisible =
                override?.is_deleted_override === true ? false : typeof override?.is_active === 'boolean' ? override.is_active : baseVisible
            const presentation =
                scope.presentation && typeof scope.presentation === 'object' ? (scope.presentation as Record<string, unknown>) : {}

            return {
                scopeEntityId: scope.id,
                kind: scope.kind,
                codename: scope.codename ?? null,
                name: presentation.name ?? null,
                layoutId: scopedLayout?.id ?? null,
                layoutName: scopedLayout?.name ?? null,
                version:
                    typeof override?.version === 'number'
                        ? override.version
                        : typeof base.widget_version === 'number'
                        ? base.widget_version
                        : 1,
                isVisible,
                isOverridden: Boolean(override)
            }
        })
    }

    async findOrCreateScopedLayout(
        tx: SqlQueryable,
        schemaName: string,
        params: {
            baseLayout: LayoutScopeRow
            baseLayoutId: string
            scopeEntityId: string
            userId?: string | null
        }
    ): Promise<LayoutScopeRow> {
        const { baseLayout, baseLayoutId, scopeEntityId, userId } = params
        this.assertLayoutSupportsWidgets(baseLayout)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const ot = qSchemaTable(schemaName, '_mhb_objects')

        await this.acquireScopedLayoutIdentityLock(tx, schemaName, baseLayoutId, scopeEntityId)

        const scopedLayout = await queryOne<LayoutScopeRow>(
            tx,
            `SELECT id, scope_entity_id, base_layout_id, template_key, config, COALESCE(_upl_version, 1)::int AS version
               FROM ${lt}
              WHERE scope_entity_id = $1
                AND base_layout_id = $2
                AND _upl_deleted = false
                AND _mhb_deleted = false
              ORDER BY is_default DESC,
                       is_active DESC,
                       sort_order ASC,
                       _upl_created_at ASC
              LIMIT 1
              FOR UPDATE`,
            [scopeEntityId, baseLayoutId]
        )

        if (scopedLayout) {
            return scopedLayout
        }

        const scopeEntity = await queryOne<{ presentation?: unknown; codename?: unknown }>(
            tx,
            `SELECT presentation, codename
               FROM ${ot}
              WHERE id = $1
                AND _upl_deleted = false
                AND _mhb_deleted = false
              LIMIT 1`,
            [scopeEntityId]
        )
        const now = new Date()
        const scopedName = this.buildAutoScopedLayoutName(scopeEntity?.presentation, scopeEntity?.codename)
        const baseTemplateKey = applicationTemplateKeySchema.parse(baseLayout.template_key)
        const baseEnvelope = decodeLayoutForStorage(baseTemplateKey, baseLayout.config ?? {})
        const baseRendererConfig = baseEnvelope.rendererConfig
        if (!uuidV7Schema.safeParse(baseLayoutId).success) throw new Error('APPLICATION_LAYOUT_COMPOSITION_INVALID')
        const baseConfig = encodeLayoutConfigEnvelope(
            {
                rendererConfig: baseRendererConfig,
                neutral: { composition: { mode: 'overlay' as const, baseLayoutId } }
            },
            { templateKey: baseTemplateKey }
        )
        const created = await queryOneOrThrow<DbRow>(
            tx,
            `INSERT INTO ${lt} (scope_entity_id, base_layout_id, template_key, name, description, config, is_active, is_default, sort_order, owner_id,
                _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                _mhb_published, _mhb_archived, _mhb_deleted)
             VALUES ($1, $2, $3, $4, NULL, $5, true, true, 0, NULL,
                $6, $7, $6, $7,
                1, false, false, false,
                true, false, false)
             RETURNING id, scope_entity_id, base_layout_id, template_key, config, COALESCE(_upl_version, 1)::int AS version`,
            [scopeEntityId, baseLayoutId, baseTemplateKey, JSON.stringify(scopedName), JSON.stringify(baseConfig), now, userId ?? null]
        )

        return {
            id: String(created.id),
            scope_entity_id: typeof created.scope_entity_id === 'string' ? created.scope_entity_id : scopeEntityId,
            base_layout_id: typeof created.base_layout_id === 'string' ? created.base_layout_id : baseLayoutId,
            template_key: applicationTemplateKeySchema.parse(created.template_key),
            config: created.config
        }
    }

    async setLayoutWidgetScopeVisibility(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        scopeEntityId: string,
        isVisible: boolean,
        userId: string | null | undefined,
        expectedVersion: number
    ): Promise<LayoutWidgetScopeVisibilityRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId ?? undefined)
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        const wt = qSchemaTable(schemaName, '_mhb_widgets')

        await this.exec.transaction(async (tx: SqlQueryable) => {
            await this.acquireLayoutGraphLock(tx, schemaName)
            await this.assertScopeEntitySupportsLayout(tx, schemaName, scopeEntityId)

            const baseLayout = await queryOne<LayoutScopeRow>(
                tx,
                `SELECT id, scope_entity_id, base_layout_id, template_key, config, COALESCE(_upl_version, 1)::int AS version
                   FROM ${lt}
                  WHERE id = $1
                    AND scope_entity_id IS NULL
                    AND _upl_deleted = false
                    AND _mhb_deleted = false
                  FOR UPDATE`,
                [layoutId]
            )
            if (!baseLayout) {
                throw this.createNotFoundError('Global layout not found')
            }
            const templateKey = this.assertLayoutSupportsWidgets(baseLayout)

            const baseWidget = await queryOne<DbRow>(
                tx,
                `SELECT *
                   FROM ${wt}
                  WHERE id = $1
                    AND layout_id = $2
                    AND _upl_deleted = false
                    AND _mhb_deleted = false
                  FOR UPDATE`,
                [widgetId, layoutId]
            )
            if (!baseWidget) {
                throw this.createNotFoundError('Global layout widget not found')
            }

            const widgetKey = applicationLayoutWidgetKeySchema.parse(baseWidget.widget_key)
            const zone = applicationLayoutZoneSchema.parse(baseWidget.zone)
            this.assertWidgetAllowedInZone(templateKey, widgetKey, zone)
            const baseConfig = this.parseWidgetConfig(templateKey, widgetKey, baseWidget.config)

            const baseIsActive = baseWidget.is_active !== false
            const overridePolicy = resolveWidgetPlacementOverridePolicy(templateKey, widgetKey, baseConfig)
            if (isVisible !== baseIsActive && !overridePolicy.canDeactivate) {
                throw new MetahubValidationError('Inherited widget activation is locked by the base layout and cannot be changed.', {
                    widgetId,
                    layoutId,
                    scopeEntityId
                })
            }

            const scopedLayout = await this.findOrCreateScopedLayout(tx, schemaName, {
                baseLayout,
                baseLayoutId: layoutId,
                scopeEntityId,
                userId
            })

            await this.upsertLayoutWidgetOverride(tx, schemaName, {
                layoutId: scopedLayout.id,
                baseWidgetId: widgetId,
                templateKey,
                widgetKey,
                baseConfig,
                patch: {
                    isActive: this.resolveScopedWidgetActiveOverride(isVisible, baseIsActive),
                    isDeletedOverride: false
                },
                userId,
                expectedVersion
            })

            await this.syncLayoutConfigFromZoneWidgets(tx, schemaName, scopedLayout.id, userId ?? null)
        })

        return this.listLayoutWidgetScopeVisibility(metahubId, layoutId, widgetId, userId)
    }
}
