import type { DbExecutor, SqlQueryable } from '@universo-react/utils/database'
import { queryOne, acquireAdvisoryXactLock } from '@universo-react/utils/database'
import { qSchemaTable } from '@universo-react/database'
import {
    getLayoutWidgetAllowedZones,
    getLayoutWidgetDefaultPlacement,
    encodeWidgetConfigEnvelope,
    applicationLayoutWidgetKeySchema,
    applicationLayoutZoneSchema,
    isEnabledCapabilityConfig,
    parseApplicationLayoutWidgetConfig,
    layoutInstanceKeySchema,
    type ApplicationLayoutWidgetKey,
    type ApplicationLayoutZone,
    type LayoutLogicalPlacement,
    applicationTemplateKeySchema,
    type LayoutWidgetDefinition,
    type VersionedLocalizedContent
} from '@universo-react/types'
import type { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubNotFoundError, MetahubConflictError, MetahubValidationError } from '../../shared/domainErrors'
import { findDuplicateActiveSingleInstanceWidgetKey } from '../widgetInvariants'
import { acquireMetahubLayoutGraphLock } from '../layoutGraphLocks'
import { assertNoWidgetSharedBehaviorConfig } from '../widgetOwnership'
import {
    encodeMarketingOverlayWidgetOverrideConfig as encodeMarketingOverlayWidgetOverride,
    resolveMarketingOverlayWidgetConfig as resolveMarketingOverlayWidget
} from './marketingOverlayWidgetConfig'
import {
    type LayoutTemplateKey,
    type MetahubLayoutRow,
    type LayoutZoneWidgetRow,
    type DbRow,
    type LayoutScopeRow,
    type ScopeEntityComponentRow,
    type ResolvedLayoutWidgetState,
    isRecord,
    resolveWidgetPlacementOverridePolicy,
    getWidgetDefinition,
    widgetRendererConfigInputSchema,
    decodeLayoutForStorage,
    decodeWidgetForStorage
} from './layoutServiceContracts'

/** Provides the service base operations used by the public layout service. */
export class MetahubLayoutServiceBase {
    protected readonly exec: DbExecutor
    protected readonly schemaService: MetahubSchemaService

    constructor(exec: DbExecutor, schemaService: MetahubSchemaService) {
        this.exec = exec
        this.schemaService = schemaService
    }

    protected createConflictError(message: string): MetahubConflictError {
        return new MetahubConflictError(message)
    }

    protected createNotFoundError(message: string): MetahubNotFoundError {
        return new MetahubNotFoundError(message, '')
    }

    protected shouldSkipDefaultZoneWidgetSeed(layoutConfig: unknown): boolean {
        if (!layoutConfig || typeof layoutConfig !== 'object') {
            return false
        }

        return decodeLayoutForStorage('dashboard', layoutConfig).neutral.skipDefaultZoneWidgetSeed === true
    }

    protected buildAutoScopedLayoutName(presentation: unknown, codename: unknown): VersionedLocalizedContent<string> {
        const now = new Date().toISOString()
        const createLocaleEntry = (content: string) => ({
            content,
            version: 1,
            isActive: true,
            createdAt: now,
            updatedAt: now
        })
        const presentationRecord = isRecord(presentation) ? presentation : {}
        const sourceName = presentationRecord.name
        if (isRecord(sourceName) && isRecord(sourceName.locales)) {
            const locales: VersionedLocalizedContent<string>['locales'] = {}
            for (const [locale, value] of Object.entries(sourceName.locales)) {
                const content = isRecord(value) && typeof value.content === 'string' ? value.content.trim() : ''
                if (!content) continue
                locales[locale] = createLocaleEntry(content)
            }
            if (Object.keys(locales).length > 0) {
                const primary =
                    typeof sourceName._primary === 'string' && locales[sourceName._primary] ? sourceName._primary : Object.keys(locales)[0]
                return {
                    _schema: '1',
                    _primary: primary,
                    locales
                }
            }
        }

        const fallback = typeof codename === 'string' && codename.trim() ? codename.trim() : 'Scoped layout'
        return {
            _schema: '1',
            _primary: 'en',
            locales: {
                en: createLocaleEntry(fallback),
                ru: createLocaleEntry(fallback)
            }
        }
    }

    protected mapRow(row: DbRow): MetahubLayoutRow {
        const templateKey = applicationTemplateKeySchema.parse(row.template_key)
        const decoded = decodeLayoutForStorage(templateKey, row.config ?? {})
        return {
            id: String(row.id),
            scopeEntityId: typeof row.scope_entity_id === 'string' ? row.scope_entity_id : null,
            baseLayoutId: typeof row.base_layout_id === 'string' ? row.base_layout_id : null,
            templateKey,
            name: row.name as VersionedLocalizedContent<string>,
            description: (row.description as VersionedLocalizedContent<string> | null) ?? null,
            config: decoded.rendererConfig,
            neutral: decoded.neutral,
            isActive: Boolean(row.is_active),
            isDefault: Boolean(row.is_default),
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
            version: typeof row._upl_version === 'number' ? row._upl_version : 1,
            createdAt: String(row._upl_created_at),
            updatedAt: String(row._upl_updated_at)
        }
    }

    protected parseWidgetConfig(
        templateKey: LayoutTemplateKey,
        widgetKey: ApplicationLayoutWidgetKey,
        config: unknown
    ): Record<string, unknown> {
        const codecZone = this.resolveWidgetZone(templateKey, widgetKey, config)
        let decoded: ReturnType<typeof decodeWidgetForStorage>
        try {
            decoded = decodeWidgetForStorage(templateKey, widgetKey, codecZone, config)
        } catch (error) {
            throw new MetahubValidationError('Layout widget configuration is invalid', {
                widgetKey,
                reason: error instanceof Error ? error.message : 'Invalid reserved metadata'
            })
        }
        const rawConfig = decoded.rendererConfig

        try {
            assertNoWidgetSharedBehaviorConfig(rawConfig)
            const definition = getWidgetDefinition(widgetKey)
            if (!definition?.supportedTemplates.includes(templateKey)) {
                throw new Error('Widget is not supported by the selected layout template')
            }
            const parsed = parseApplicationLayoutWidgetConfig(widgetKey, rawConfig)
            return Object.keys(decoded.neutral).length === 0
                ? parsed
                : encodeWidgetConfigEnvelope(
                      { rendererConfig: parsed, neutral: decoded.neutral },
                      { templateKey, widgetKey, zone: codecZone }
                  )
        } catch (error) {
            throw new MetahubValidationError('Layout widget configuration is invalid', {
                widgetKey,
                reason: error instanceof Error ? error.message : 'Invalid configuration'
            })
        }
    }

    protected resolveMarketingOverlayWidgetConfig(
        templateKey: LayoutTemplateKey,
        widgetKey: ApplicationLayoutWidgetKey,
        zone: ApplicationLayoutZone,
        baseConfig: Record<string, unknown>,
        overrideConfig: Record<string, unknown>
    ): Record<string, unknown> {
        return resolveMarketingOverlayWidget(templateKey, widgetKey, zone, baseConfig, overrideConfig, {
            parseWidgetConfig: (templateKey, configWidgetKey, config) => this.parseWidgetConfig(templateKey, configWidgetKey, config),
            resolveWidgetZone: (templateKey, configWidgetKey, config) => this.resolveWidgetZone(templateKey, configWidgetKey, config)
        })
    }

    protected encodeMarketingOverlayWidgetOverrideConfig(
        templateKey: LayoutTemplateKey,
        widgetKey: ApplicationLayoutWidgetKey,
        zone: ApplicationLayoutZone,
        baseConfig: Record<string, unknown>,
        overrideConfig: Record<string, unknown>
    ): Record<string, unknown> {
        return encodeMarketingOverlayWidgetOverride(templateKey, widgetKey, zone, baseConfig, overrideConfig, {
            parseWidgetConfig: (templateKey, configWidgetKey, config) => this.parseWidgetConfig(templateKey, configWidgetKey, config),
            resolveWidgetZone: (templateKey, configWidgetKey, config) => this.resolveWidgetZone(templateKey, configWidgetKey, config)
        })
    }

    protected resolveWidgetZone(
        templateKey: LayoutTemplateKey,
        widgetKey: ApplicationLayoutWidgetKey,
        config: unknown
    ): ApplicationLayoutZone {
        if (isRecord(config) && typeof config.zone === 'string') {
            const parsed = applicationLayoutZoneSchema.safeParse(config.zone)
            if (parsed.success && getLayoutWidgetAllowedZones(widgetKey, templateKey)?.includes(parsed.data)) return parsed.data
        }

        const definition = getWidgetDefinition(widgetKey)
        const zones = definition?.allowedZonesByTemplate[templateKey] ?? definition?.allowedZones ?? []
        return zones[0] ?? (templateKey === 'marketing-page' ? 'marketing-main' : 'top')
    }

    protected getPlacementInstanceKey(value: unknown): string {
        const parsed = layoutInstanceKeySchema.safeParse(value)
        if (!parsed.success) throw new MetahubValidationError('Layout widget instance identity is invalid')
        return parsed.data
    }

    protected assertSemanticPlacementPair(widgetId: string, parentInstanceKey: string | null, slotKey: string | null): void {
        if ((parentInstanceKey === null) !== (slotKey === null)) {
            throw new MetahubValidationError('Layout widget parent and slot metadata must be provided together', { widgetId })
        }
    }

    protected mapWidgetPresentation(
        templateKey: LayoutTemplateKey,
        widgetKey: ApplicationLayoutWidgetKey,
        zone: ApplicationLayoutZone,
        persistedConfig: unknown
    ): { config: Record<string, unknown>; placement?: LayoutLogicalPlacement } {
        const decoded = decodeWidgetForStorage(templateKey, widgetKey, zone, persistedConfig)
        const defaultPlacement = getLayoutWidgetDefaultPlacement({ templateKey, widgetKey, zone })
        return {
            config: decoded.rendererConfig,
            ...(decoded.neutral.placement ?? defaultPlacement ? { placement: decoded.neutral.placement ?? defaultPlacement } : {})
        }
    }

    protected parseWidgetRendererUpdate(
        templateKey: LayoutTemplateKey,
        widgetKey: ApplicationLayoutWidgetKey,
        zone: ApplicationLayoutZone,
        currentConfig: unknown,
        incomingConfig: Record<string, unknown>
    ): Record<string, unknown> {
        const rendererConfig = widgetRendererConfigInputSchema.parse(incomingConfig)
        const currentEnvelope = decodeWidgetForStorage(templateKey, widgetKey, zone, currentConfig)
        const persistedCandidate = encodeWidgetConfigEnvelope(
            { rendererConfig, neutral: currentEnvelope.neutral },
            { templateKey, widgetKey, zone }
        )
        return this.parseWidgetConfig(templateKey, widgetKey, persistedCandidate)
    }

    protected assertUniquePlacementInstanceKeys(widgets: readonly { instanceKey: unknown }[]): void {
        const instanceKeys = new Set<string>()
        for (const widget of widgets) {
            const instanceKey = this.getPlacementInstanceKey(widget.instanceKey)
            if (instanceKeys.has(instanceKey)) {
                throw new MetahubConflictError('Layout widget instance key must be unique within a layout', {
                    instanceKey
                })
            }
            instanceKeys.add(instanceKey)
        }
    }

    protected assertNoDuplicateActiveSingleInstanceWidgets(
        rows: readonly {
            widgetKey?: unknown
            widget_key?: unknown
            isActive?: unknown
            is_active?: unknown
        }[]
    ): void {
        if (findDuplicateActiveSingleInstanceWidgetKey(rows) !== null) {
            throw new MetahubConflictError('Active single-instance layout widgets must be unique within a layout')
        }
    }

    protected assertExpectedWidgetVersion(row: DbRow | ResolvedLayoutWidgetState, expectedVersion?: number): void {
        if (expectedVersion === undefined) return
        const rowRecord = row as Record<string, unknown>
        const currentVersion =
            typeof rowRecord.version === 'number'
                ? rowRecord.version
                : typeof rowRecord._upl_version === 'number'
                ? rowRecord._upl_version
                : 1
        if (currentVersion !== expectedVersion) {
            throw this.createConflictError('Layout widget was modified by another request')
        }
    }

    protected assertExpectedLayoutVersion(row: LayoutScopeRow | DbRow, expectedVersion: number): void {
        const rowRecord = row as Record<string, unknown>
        const currentVersion =
            typeof rowRecord.version === 'number'
                ? rowRecord.version
                : typeof rowRecord._upl_version === 'number'
                ? rowRecord._upl_version
                : 1
        if (currentVersion !== expectedVersion) {
            throw this.createConflictError('Layout was modified by another request')
        }
    }

    protected mapZoneWidgetRow(row: DbRow, templateKey: LayoutTemplateKey, parentInstanceKey: string | null): LayoutZoneWidgetRow {
        const widgetKey = applicationLayoutWidgetKeySchema.parse(row.widget_key)
        const zone = applicationLayoutZoneSchema.parse(row.zone)
        const parsedConfig = this.parseWidgetConfig(templateKey, widgetKey, row.config)
        const presentation = this.mapWidgetPresentation(templateKey, widgetKey, zone, parsedConfig)
        const instanceKey = this.getPlacementInstanceKey(row.instance_key)
        const slotKey = typeof row.slot_key === 'string' ? row.slot_key : null
        this.assertSemanticPlacementPair(String(row.id), parentInstanceKey, slotKey)
        return {
            id: String(row.id),
            layoutId: String(row.layout_id),
            zone,
            widgetKey,
            instanceKey,
            parentInstanceKey,
            slotKey,
            placementPolicy: resolveWidgetPlacementOverridePolicy(templateKey, widgetKey, parsedConfig),
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 1,
            config: presentation.config,
            ...(presentation.placement === undefined ? {} : { placement: presentation.placement }),
            isActive: row.is_active !== false,
            version: typeof row._upl_version === 'number' ? row._upl_version : 1,
            createdAt: String(row._upl_created_at),
            updatedAt: String(row._upl_updated_at)
        }
    }

    protected mapZoneWidgetRows(rows: readonly DbRow[], templateKey: LayoutTemplateKey): LayoutZoneWidgetRow[] {
        const instanceKeyById = new Map(rows.map((row) => [String(row.id), this.getPlacementInstanceKey(row.instance_key)]))
        return rows.map((row) => {
            const parentWidgetId = typeof row.parent_widget_id === 'string' ? row.parent_widget_id : null
            const parentInstanceKey = parentWidgetId ? instanceKeyById.get(parentWidgetId) : null
            if (parentWidgetId && !parentInstanceKey) {
                throw new MetahubValidationError('Layout widget parent placement could not be resolved', {
                    widgetId: String(row.id),
                    parentWidgetId
                })
            }
            return this.mapZoneWidgetRow(row, templateKey, parentInstanceKey ?? null)
        })
    }

    protected isScopedEntityLayout(scope: LayoutScopeRow | DbRow | null | undefined): boolean {
        return typeof scope?.scope_entity_id === 'string' && typeof scope?.base_layout_id === 'string'
    }

    protected async loadParentInstanceKey(db: SqlQueryable, schemaName: string, row: DbRow): Promise<string | null> {
        if (typeof row.parent_widget_id !== 'string') return null
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const parent = await queryOne<{ instance_key: unknown }>(
            db,
            `SELECT instance_key FROM ${wt} WHERE id = $1 AND layout_id = $2 AND _upl_deleted = false AND _mhb_deleted = false`,
            [row.parent_widget_id, row.layout_id]
        )
        if (!parent) {
            throw new MetahubValidationError('Layout widget parent placement could not be resolved', {
                widgetId: String(row.id),
                parentWidgetId: row.parent_widget_id
            })
        }
        return this.getPlacementInstanceKey(parent.instance_key)
    }

    protected async lockLayoutPlacementRows(db: SqlQueryable, schemaName: string, layoutScope: LayoutScopeRow): Promise<void> {
        const wt = qSchemaTable(schemaName, '_mhb_widgets')
        const layoutIds = [layoutScope.id, ...(this.isScopedEntityLayout(layoutScope) ? [String(layoutScope.base_layout_id)] : [])]
        for (const layoutId of layoutIds) {
            await db.query(
                `SELECT id FROM ${wt}
                  WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
                  ORDER BY id ASC FOR UPDATE`,
                [layoutId]
            )
        }
    }

    protected assertWidgetAllowedInZone(
        templateKey: LayoutTemplateKey,
        widgetKey: ApplicationLayoutWidgetKey,
        zone: ApplicationLayoutZone
    ): LayoutWidgetDefinition {
        const definition = getWidgetDefinition(widgetKey)
        const allowedZones = getLayoutWidgetAllowedZones(widgetKey, templateKey)
        if (!definition || !allowedZones?.includes(zone)) {
            throw new MetahubValidationError(`Widget "${widgetKey}" is not allowed in zone "${zone}"`)
        }
        return definition
    }

    protected buildLayoutScopeWhereSql(
        scopeEntityId: string | null | undefined,
        nextParamIndex: number
    ): { sql: string; params: unknown[] } {
        if (scopeEntityId) {
            return { sql: `scope_entity_id = $${nextParamIndex}`, params: [scopeEntityId] }
        }

        return { sql: 'scope_entity_id IS NULL', params: [] }
    }

    protected buildScopedLayoutIdentityLockKey(schemaName: string, baseLayoutId: string, scopeEntityId: string): string {
        return `mhb-layout-scope:${schemaName}:${baseLayoutId}:${scopeEntityId}`
    }

    protected async acquireLayoutGraphLock(db: SqlQueryable, schemaName: string): Promise<void> {
        await acquireMetahubLayoutGraphLock(db, schemaName)
    }

    /**
     * Serialize resolution of one logical scoped layout until the surrounding
     * transaction commits or rolls back.
     */
    protected async acquireScopedLayoutIdentityLock(
        db: SqlQueryable,
        schemaName: string,
        baseLayoutId: string,
        scopeEntityId: string
    ): Promise<void> {
        await acquireAdvisoryXactLock(db, this.buildScopedLayoutIdentityLockKey(schemaName, baseLayoutId, scopeEntityId))
    }

    protected async getLayoutScopeRow(db: SqlQueryable, schemaName: string, layoutId: string): Promise<LayoutScopeRow | null> {
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        return queryOne<LayoutScopeRow>(
            db,
            `SELECT id, scope_entity_id, base_layout_id, template_key, config, COALESCE(_upl_version, 1)::int AS version
             FROM ${lt}
             WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false`,
            [layoutId]
        )
    }

    protected assertLayoutSupportsWidgets(layout: LayoutScopeRow | DbRow | null | undefined): LayoutTemplateKey {
        const parsed = applicationTemplateKeySchema.safeParse(layout?.template_key)
        if (!parsed.success) {
            throw new MetahubValidationError('Layout template is invalid')
        }
        return parsed.data
    }

    protected async lockLayoutScopeRow(db: SqlQueryable, schemaName: string, layoutId: string): Promise<LayoutScopeRow | null> {
        const lt = qSchemaTable(schemaName, '_mhb_layouts')
        return queryOne<LayoutScopeRow>(
            db,
            `SELECT id, scope_entity_id, base_layout_id, template_key, config, COALESCE(_upl_version, 1)::int AS version
             FROM ${lt}
             WHERE id = $1 AND _upl_deleted = false AND _mhb_deleted = false
             FOR UPDATE`,
            [layoutId]
        )
    }

    protected async assertScopeEntitySupportsLayout(db: SqlQueryable, schemaName: string, scopeEntityId: string): Promise<void> {
        const ot = qSchemaTable(schemaName, '_mhb_objects')
        const tt = qSchemaTable(schemaName, '_mhb_entity_type_definitions')
        const entityRow = await queryOne<ScopeEntityComponentRow>(
            db,
            `SELECT o.id, o.kind, t.capabilities
               FROM ${ot} o
               JOIN ${tt} t
                 ON t.kind_key = o.kind
                AND t._upl_deleted = false
                AND t._mhb_deleted = false
              WHERE o.id = $1
                AND o._upl_deleted = false
                AND o._mhb_deleted = false
              LIMIT 1`,
            [scopeEntityId]
        )

        if (!entityRow) {
            throw new MetahubNotFoundError('Entity', scopeEntityId)
        }

        const capabilities =
            entityRow.capabilities && typeof entityRow.capabilities === 'object' ? (entityRow.capabilities as Record<string, unknown>) : {}
        if (!isEnabledCapabilityConfig(capabilities.layoutConfig as Parameters<typeof isEnabledCapabilityConfig>[0])) {
            throw new MetahubValidationError(`Entity "${entityRow.kind}" does not support custom layouts`)
        }
    }

    protected async resolveCreateBaseLayout(
        db: SqlQueryable,
        schemaName: string,
        scopeEntityId: string | null | undefined,
        requestedBaseLayoutId: string | undefined,
        allowIndependentWhenNoGlobalBase = false
    ): Promise<LayoutScopeRow | null> {
        if (!scopeEntityId) {
            return null
        }

        const lt = qSchemaTable(schemaName, '_mhb_layouts')

        if (requestedBaseLayoutId) {
            const baseLayout = await queryOne<LayoutScopeRow>(
                db,
                `SELECT id, scope_entity_id, base_layout_id, template_key, config, COALESCE(_upl_version, 1)::int AS version FROM ${lt}
                 WHERE id = $1
                   AND scope_entity_id IS NULL
                   AND is_active = true
                   AND _upl_deleted = false
                   AND _mhb_deleted = false`,
                [requestedBaseLayoutId]
            )

            if (!baseLayout) {
                throw this.createConflictError('Base layout must reference an existing global layout')
            }

            return baseLayout
        }

        const fallbackBaseLayout = await queryOne<LayoutScopeRow>(
            db,
            `SELECT id, scope_entity_id, base_layout_id, template_key, config, COALESCE(_upl_version, 1)::int AS version FROM ${lt}
             WHERE scope_entity_id IS NULL
               AND is_active = true
               AND _upl_deleted = false
               AND _mhb_deleted = false
             ORDER BY is_default DESC, sort_order ASC, _upl_created_at ASC
             LIMIT 1`,
            []
        )

        if (!fallbackBaseLayout && allowIndependentWhenNoGlobalBase) {
            return null
        }

        if (!fallbackBaseLayout) {
            throw this.createConflictError('Scoped layouts require an existing global base layout')
        }

        return fallbackBaseLayout
    }
}
