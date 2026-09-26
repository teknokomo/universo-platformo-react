import type { DbExecutor, SqlQueryable } from '@universo-react/utils/database'
import { queryMany, queryOne, withTransactionSavepoint } from '@universo-react/utils/database'
import { qSchemaTable } from '@universo-react/database'
import type { MetahubRecordsService } from '../metahubs/services/MetahubRecordsService'
import type { MetahubObjectsService } from '../metahubs/services/MetahubObjectsService'
import type { MetahubComponentsService } from '../metahubs/services/MetahubComponentsService'
import { ComponentDefinitionDataType } from '@universo-react/types'
import {
    applicationLayoutWidgetKeySchema,
    applicationLayoutZoneSchema,
    decodeWidgetConfigEnvelope,
    encodeWidgetConfigEnvelope,
    getMarketingSectionAnchorEntries,
    type ApplicationLayoutZone,
    type ApplicationTemplateKey
} from '@universo-react/types'
import type { MetahubSchemaService } from '../metahubs/services/MetahubSchemaService'
import { MetahubConflictError, MetahubNotFoundError, MetahubValidationError } from '../shared/domainErrors'
import { codenamePrimaryTextSql } from '../shared/codename'
import {
    loadMarketingHeroBindingBySemanticTarget,
    loadMarketingHeroBindingTarget,
    MARKETING_HERO_OBJECT,
    validateMarketingHeroComponents
} from './marketingHeroBindingsStore'
import { resolveEntityRecordPolicy } from '@universo-react/types'
import { isAuthoritativeMarketingHeroRecordPolicy } from '../shared/entityRecordPolicy'
import { acquireWidgetBindingObjectLock } from './widgetBindingPolicyStore'
import { countMarketingHeroBindingUsage } from './marketingHeroActionIntegrityStore'
import { validateMarketingHeroActionTargets } from './marketingHeroActionPolicy'

export { validateMarketingHeroActionTargets } from './marketingHeroActionPolicy'

type DbRow = Record<string, unknown>
const recordOf = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
const objectPresentation = (value: unknown) => recordOf(value)
export const resolveMarketingHeroSourceName = (value: unknown, locale: string): string => {
    const presentation = recordOf(value)
    const rawName = presentation.name
    if (typeof rawName === 'string' && rawName.trim()) return rawName.trim()
    const localized = recordOf(rawName)
    const locales = recordOf(localized.locales)
    const language = locale.split('-')[0]
    const candidates = [locale, language, localized._primary, ...Object.keys(locales)]
    for (const candidate of new Set(candidates)) {
        if (typeof candidate !== 'string') continue
        const content = recordOf(locales[candidate]).content
        if (typeof content === 'string' && content.trim()) return content.trim()
    }
    return locale.toLowerCase().startsWith('ru') ? 'Объект без названия' : 'Unnamed Object'
}
type MarketingSectionWidget = Parameters<typeof getMarketingSectionAnchorEntries>[0][number]

type LayoutScopeRow = {
    id: string
    scope_entity_id?: string | null
    base_layout_id?: string | null
    template_key?: unknown
    config?: unknown
    version?: number
}

export interface UpdateMarketingHeroBindingInput {
    recordId: string
    expectedVersion: number
}

const loadActiveMarketingSectionWidgets = async (
    db: SqlQueryable,
    schemaName: string,
    layoutId: string
): Promise<MarketingSectionWidget[]> => {
    const rows = await queryMany<DbRow>(
        db,
        `SELECT widget_key, zone, config, is_active
           FROM ${qSchemaTable(schemaName, '_mhb_widgets')}
          WHERE layout_id = $1 AND _upl_deleted = false AND _mhb_deleted = false
          ORDER BY zone ASC, sort_order ASC, _upl_created_at ASC`,
        [layoutId]
    )

    return rows.map((row) => {
        const widgetKey = applicationLayoutWidgetKeySchema.parse(row.widget_key)
        const rendererConfig = widgetKey.startsWith('marketing.')
            ? decodeWidgetConfigEnvelope(row.config, {
                  templateKey: 'marketing-page',
                  widgetKey,
                  zone: applicationLayoutZoneSchema.parse(row.zone),
                  requireBindings: true
              }).rendererConfig
            : {}
        return {
            widgetKey,
            instanceKey: typeof rendererConfig.instanceKey === 'string' ? rendererConfig.instanceKey : undefined,
            config: rendererConfig,
            isActive: row.is_active !== false
        }
    })
}

interface MarketingHeroBindingServiceDependencies<TWidgetRow> {
    exec: DbExecutor
    schemaService: Pick<MetahubSchemaService, 'ensureSchema'>
    acquireLayoutGraphLock: (db: SqlQueryable, schemaName: string) => Promise<void>
    getLayoutScopeRow: (db: SqlQueryable, schemaName: string, layoutId: string) => Promise<LayoutScopeRow | null>
    lockLayoutScopeRow: (db: SqlQueryable, schemaName: string, layoutId: string) => Promise<LayoutScopeRow | null>
    assertLayoutSupportsWidgets: (layout: LayoutScopeRow | DbRow | null | undefined) => ApplicationTemplateKey
    assertExpectedWidgetVersion: (row: DbRow, expectedVersion?: number) => void
    syncLayoutConfigFromZoneWidgets: (db: SqlQueryable, schemaName: string, layoutId: string, userId?: string | null) => Promise<void>
    mapZoneWidgetRow: (row: DbRow, templateKey: ApplicationTemplateKey) => TWidgetRow
    recordsService: MetahubRecordsService
    objectsService: MetahubObjectsService
    componentsService: MetahubComponentsService
}

/** Owns the Entity binding workflows for source marketing Hero placements. */
export class MarketingHeroBindingService<TWidgetRow> {
    constructor(private readonly dependencies: MarketingHeroBindingServiceDependencies<TWidgetRow>) {}

    private async assertSourceMarketingLayout(db: SqlQueryable, schemaName: string, layoutId: string): Promise<LayoutScopeRow> {
        await this.dependencies.acquireLayoutGraphLock(db, schemaName)
        const layout = await this.dependencies.getLayoutScopeRow(db, schemaName, layoutId)
        if (!layout) throw new MetahubNotFoundError('Layout not found', '')
        const templateKey = this.dependencies.assertLayoutSupportsWidgets(layout)
        if (templateKey !== 'marketing-page' || layout.scope_entity_id || layout.base_layout_id) {
            throw new MetahubValidationError('Hero binding sources are only available on a source marketing layout')
        }
        return layout
    }

    async listSources(metahubId: string, layoutId: string, locale: string, userId?: string | null, excludeWidgetId?: string) {
        const { exec, schemaService } = this.dependencies
        const schemaName = await schemaService.ensureSchema(metahubId, userId ?? undefined)
        return exec.transaction(async (tx) => {
            await this.assertSourceMarketingLayout(tx, schemaName, layoutId)
            const objects = await queryMany<DbRow>(
                tx,
                `SELECT object.id, ${codenamePrimaryTextSql('object.codename')} AS codename, object.presentation,
                        COUNT(record.id)::int AS records_count,
                        (SELECT COUNT(DISTINCT usage_widget.id)::int
                           FROM ${qSchemaTable(schemaName, '_mhb_widgets')} usage_widget
                           CROSS JOIN LATERAL jsonb_array_elements(
                               CASE
                                   WHEN jsonb_typeof(usage_widget.config #> '{__layout,bindings,slots}') = 'array'
                                   THEN usage_widget.config #> '{__layout,bindings,slots}'
                                   ELSE '[]'::jsonb
                               END
                           ) AS binding_slot(value)
                           CROSS JOIN LATERAL jsonb_array_elements(
                               CASE
                                   WHEN jsonb_typeof(binding_slot.value->'targets') = 'array'
                                   THEN binding_slot.value->'targets'
                                   ELSE '[]'::jsonb
                               END
                           ) AS binding_target(value)
                          WHERE usage_widget.widget_key = 'marketing.hero'
                            AND usage_widget._upl_deleted = false AND usage_widget._mhb_deleted = false
                            AND binding_slot.value->>'slot' = 'content'
                            AND binding_target.value->>'entityCodename' = ${codenamePrimaryTextSql('object.codename')}
                            AND ($1::uuid IS NULL OR usage_widget.id <> $1::uuid)
                        ) AS other_widget_usage_count
                   FROM ${qSchemaTable(schemaName, '_mhb_objects')} object
                   LEFT JOIN ${qSchemaTable(schemaName, '_mhb_elements')} record
                     ON record.object_id = object.id AND record._upl_deleted = false AND record._mhb_deleted = false
                  WHERE object.kind = 'object' AND object._upl_deleted = false AND object._mhb_deleted = false
                  GROUP BY object.id ORDER BY codename ASC`,
                [excludeWidgetId ?? null]
            )
            const sources = []
            for (const row of objects) {
                try {
                    const object = await acquireWidgetBindingObjectLock(tx, schemaName, String(row.id))
                    if (object.kind !== 'object') continue
                    const policy = resolveEntityRecordPolicy(object.config)
                    if (!isAuthoritativeMarketingHeroRecordPolicy(policy)) continue
                    const components = await queryMany<DbRow>(
                        tx,
                        `SELECT ${codenamePrimaryTextSql('codename')} AS codename, data_type, is_required, validation_rules
                           FROM ${qSchemaTable(schemaName, '_mhb_components')}
                          WHERE object_id = $1 AND parent_component_id IS NULL AND _upl_deleted = false AND _mhb_deleted = false`,
                        [object.id]
                    )
                    validateMarketingHeroComponents(components as never)
                    const presentation = objectPresentation(row.presentation)
                    sources.push({
                        entityId: object.id,
                        entityCodename: object.codename,
                        name: resolveMarketingHeroSourceName(presentation, locale),
                        recordsCount: Number(row.records_count ?? 0),
                        otherWidgetUsageCount: Number(row.other_widget_usage_count ?? 0)
                    })
                } catch (error) {
                    if (!(error instanceof MetahubValidationError)) throw error
                }
            }
            return { items: sources }
        })
    }

    async provisionSource(
        metahubId: string,
        layoutId: string,
        input: { codename: string; name: unknown; description?: unknown },
        userId?: string | null
    ) {
        const { exec, schemaService, objectsService, componentsService, recordsService } = this.dependencies
        const schemaName = await schemaService.ensureSchema(metahubId, userId ?? undefined)
        return exec.transaction(async (tx) => {
            await this.assertSourceMarketingLayout(tx, schemaName, layoutId)
            const canonical = await queryOne<DbRow>(
                tx,
                `SELECT object.id AS object_id, object.config, object.presentation, record.data
                   FROM ${qSchemaTable(schemaName, '_mhb_objects')} object
                   JOIN ${qSchemaTable(schemaName, '_mhb_elements')} record ON record.object_id = object.id
                  WHERE object.kind = 'object' AND ${codenamePrimaryTextSql('object.codename')} = $1
                    AND record.data->>'HeroKey' = 'default'
                    AND object._upl_deleted = false AND object._mhb_deleted = false
                    AND record._upl_deleted = false AND record._mhb_deleted = false
                  ORDER BY record.id ASC LIMIT 1 FOR SHARE OF object, record`,
                [MARKETING_HERO_OBJECT]
            )
            if (!canonical) throw new MetahubNotFoundError('Canonical Hero content record', '')
            const canonicalObject = await acquireWidgetBindingObjectLock(tx, schemaName, String(canonical.object_id))
            const canonicalPolicy = resolveEntityRecordPolicy(canonicalObject.config)
            if (!isAuthoritativeMarketingHeroRecordPolicy(canonicalPolicy))
                throw new MetahubValidationError('Canonical Hero record policy is invalid')
            const canonicalComponents = await queryMany<DbRow>(
                tx,
                `SELECT ${codenamePrimaryTextSql('codename')} AS codename, data_type, is_required, is_display_component,
                        presentation, validation_rules, ui_config, target_object_id, target_object_kind, target_constant_id
                   FROM ${qSchemaTable(schemaName, '_mhb_components')}
                  WHERE object_id = $1 AND parent_component_id IS NULL AND _upl_deleted = false AND _mhb_deleted = false
                  ORDER BY sort_order ASC, _upl_created_at ASC`,
                [canonical.object_id]
            )
            validateMarketingHeroComponents(canonicalComponents as never)
            const canonicalConfig = recordOf(canonical.config)
            const config = { ...canonicalConfig, hubs: ['MarketingPage'] }
            const createdObject = await objectsService.createObject(
                metahubId,
                'object',
                { codename: input.codename, name: input.name, description: input.description, config, createdBy: userId ?? null },
                userId ?? undefined,
                tx
            )
            for (const component of canonicalComponents) {
                await componentsService.create(
                    metahubId,
                    {
                        objectCollectionId: createdObject.id,
                        codename: component.codename,
                        dataType: component.data_type as ComponentDefinitionDataType,
                        isRequired: component.is_required === true,
                        isDisplayComponent: component.is_display_component === true,
                        name: objectPresentation(component.presentation).name ?? component.codename,
                        validationRules: recordOf(component.validation_rules),
                        uiConfig: recordOf(component.ui_config),
                        targetEntityId: typeof component.target_object_id === 'string' ? component.target_object_id : null,
                        targetEntityKind: typeof component.target_object_kind === 'string' ? component.target_object_kind : null,
                        targetConstantId: typeof component.target_constant_id === 'string' ? component.target_constant_id : null
                    },
                    userId ?? undefined,
                    tx
                )
            }
            const createdRecord = await recordsService.create(
                metahubId,
                createdObject.id,
                { data: recordOf(canonical.data), createdBy: userId ?? null },
                userId ?? undefined,
                tx
            )
            return {
                source: {
                    entityId: createdObject.id,
                    entityCodename: input.codename,
                    name: input.name,
                    recordsCount: 1,
                    otherWidgetUsageCount: 0
                },
                initialRecord: { recordId: createdRecord.id }
            }
        })
    }

    /** Add the selected Object record's semantic binding to a newly assigned Hero config. */
    async createAssignedHeroConfig(
        tx: SqlQueryable,
        schemaName: string,
        input: {
            templateKey: ApplicationTemplateKey
            scopeEntityId?: string | null
            layoutId: string
            zone: ApplicationLayoutZone
            heroContent: { mode: 'auto'; sourceWidgetId?: string } | { mode: 'existing'; recordId: string }
            metahubId: string
            userId?: string | null
            parsedWidgetConfig: Record<string, unknown>
        }
    ): Promise<Record<string, unknown>> {
        if (input.templateKey !== 'marketing-page' || input.scopeEntityId) {
            throw new MetahubValidationError('Hero Entity bindings can only be authored on a source marketing layout')
        }

        let sourceTarget
        if (input.heroContent.mode === 'existing') {
            sourceTarget = await loadMarketingHeroBindingTarget(tx, schemaName, input.heroContent.recordId, 'en')
        } else if (input.heroContent.sourceWidgetId) {
            const sourceWidget = await queryOne<DbRow>(
                tx,
                `SELECT widget_key, zone, config FROM ${qSchemaTable(schemaName, '_mhb_widgets')}
                  WHERE id = $1 AND layout_id = $2 AND _upl_deleted = false AND _mhb_deleted = false FOR SHARE`,
                [input.heroContent.sourceWidgetId, input.layoutId]
            )
            if (!sourceWidget || sourceWidget.widget_key !== 'marketing.hero') {
                throw new MetahubNotFoundError('Source Hero placement', '')
            }
            const envelope = decodeWidgetConfigEnvelope(sourceWidget.config, {
                templateKey: 'marketing-page',
                widgetKey: 'marketing.hero',
                zone: applicationLayoutZoneSchema.parse(sourceWidget.zone),
                requireBindings: true
            })
            if (!envelope.neutral.bindings) throw new MetahubValidationError('Source Hero placement has no Entity binding')
            sourceTarget = await loadMarketingHeroBindingBySemanticTarget(tx, schemaName, envelope.neutral.bindings, 'en', {
                layoutGraphLockAlreadyHeld: true
            })
        } else {
            const canonical = await queryOne<{ object_id: string; id: string }>(
                tx,
                `SELECT record.object_id, record.id
                   FROM ${qSchemaTable(schemaName, '_mhb_elements')} record
                   JOIN ${qSchemaTable(schemaName, '_mhb_objects')} object ON object.id = record.object_id
                  WHERE object.kind = 'object'
                    AND object._upl_deleted = false AND object._mhb_deleted = false
                    AND record._upl_deleted = false AND record._mhb_deleted = false
                    AND ${codenamePrimaryTextSql('object.codename')} = $1
                    AND record.data->>'HeroKey' = 'default'
                  ORDER BY record.id ASC LIMIT 1 FOR SHARE OF record, object`,
                [MARKETING_HERO_OBJECT]
            )
            if (!canonical) throw new MetahubNotFoundError('Canonical Hero content record', '')
            sourceTarget = await loadMarketingHeroBindingTarget(tx, schemaName, canonical.id, 'en')
        }
        let target = sourceTarget
        if (input.heroContent.mode === 'auto') {
            const cloned = await this.dependencies.recordsService.create(
                input.metahubId,
                sourceTarget.entityId,
                { data: sourceTarget.rawData, createdBy: input.userId ?? null },
                input.userId ?? undefined,
                tx
            )
            target = await loadMarketingHeroBindingTarget(tx, schemaName, cloned.id, 'en')
        }
        const sectionWidgets = await loadActiveMarketingSectionWidgets(tx, schemaName, input.layoutId)
        validateMarketingHeroActionTargets(target.data, sectionWidgets)
        const widgetContext = {
            templateKey: input.templateKey,
            widgetKey: 'marketing.hero',
            zone: input.zone,
            requireBindings: true
        } as const
        return encodeWidgetConfigEnvelope(
            { rendererConfig: input.parsedWidgetConfig, neutral: { bindings: target.binding } },
            widgetContext
        )
    }

    /** Bind or rebind a source-owned Hero placement within the layout transaction. */
    async update(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        input: UpdateMarketingHeroBindingInput,
        userId?: string | null
    ): Promise<TWidgetRow> {
        const { exec, schemaService } = this.dependencies
        const schemaName = await schemaService.ensureSchema(metahubId, userId ?? undefined)
        const widgetsTable = qSchemaTable(schemaName, '_mhb_widgets')
        const active = '_upl_deleted = false AND _mhb_deleted = false'

        return withTransactionSavepoint(exec, async (tx: SqlQueryable) => {
            await this.dependencies.acquireLayoutGraphLock(tx, schemaName)
            const initialLayout = await this.dependencies.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!initialLayout) throw new MetahubNotFoundError('Layout not found', '')
            const initialTemplateKey = this.dependencies.assertLayoutSupportsWidgets(initialLayout)
            if (initialTemplateKey !== 'marketing-page' || initialLayout.scope_entity_id) {
                throw new MetahubValidationError('Hero bindings can only be edited on a source marketing layout')
            }

            const target = await loadMarketingHeroBindingTarget(tx, schemaName, input.recordId, 'en')
            const layout = await this.dependencies.lockLayoutScopeRow(tx, schemaName, layoutId)
            if (!layout) throw new MetahubNotFoundError('Layout not found', '')
            if (layout.template_key !== initialLayout.template_key) {
                throw new MetahubConflictError('Layout template changed during Hero rebinding')
            }

            const current = await queryOne<DbRow>(
                tx,
                `SELECT * FROM ${widgetsTable}
                  WHERE id = $1 AND layout_id = $2 AND ${active}
                  FOR UPDATE`,
                [widgetId, layoutId]
            )
            if (!current) throw new MetahubNotFoundError('Zone widget not found', '')
            this.dependencies.assertExpectedWidgetVersion(current, input.expectedVersion)

            const widgetKey = applicationLayoutWidgetKeySchema.parse(current.widget_key)
            const zone = applicationLayoutZoneSchema.parse(current.zone)
            if (widgetKey !== 'marketing.hero') {
                throw new MetahubValidationError('Only Hero placements have an Entity binding')
            }
            const widgetContext = { templateKey: initialTemplateKey, widgetKey, zone, requireBindings: true } as const
            const envelope = decodeWidgetConfigEnvelope(current.config, widgetContext)
            const sectionWidgets = await loadActiveMarketingSectionWidgets(tx, schemaName, layoutId)
            validateMarketingHeroActionTargets(target.data, sectionWidgets)
            const config = encodeWidgetConfigEnvelope(
                { rendererConfig: envelope.rendererConfig, neutral: { ...envelope.neutral, bindings: target.binding } },
                widgetContext
            )
            const now = new Date()
            const updated = await queryOne<DbRow>(
                tx,
                `UPDATE ${widgetsTable}
                    SET config = $1, _upl_updated_at = $2, _upl_updated_by = $3, _upl_version = _upl_version + 1
                  WHERE id = $4 AND layout_id = $5 AND ${active}
                    AND COALESCE(_upl_version, 1) = $6
                  RETURNING *`,
                [JSON.stringify(config), now, userId ?? null, widgetId, layoutId, input.expectedVersion]
            )
            if (!updated) throw new MetahubConflictError('Layout widget was modified by another request')

            await this.dependencies.syncLayoutConfigFromZoneWidgets(tx, schemaName, layoutId, userId ?? null)
            return this.dependencies.mapZoneWidgetRow(updated, initialTemplateKey)
        })
    }

    /** Resolve only the selected Entity record details used by the authoring picker. */
    async getTarget(
        metahubId: string,
        layoutId: string,
        widgetId: string,
        locale: string,
        userId?: string | null
    ): Promise<{
        recordId: string
        recordVersion: number
        widgetVersion: number
        label: string
        entityId: string
        entityCodename: string
    }> {
        const { exec, schemaService } = this.dependencies
        const schemaName = await schemaService.ensureSchema(metahubId, userId ?? undefined)
        const widgetsTable = qSchemaTable(schemaName, '_mhb_widgets')
        const active = '_upl_deleted = false AND _mhb_deleted = false'

        return exec.transaction(async (tx: SqlQueryable) => {
            await this.dependencies.acquireLayoutGraphLock(tx, schemaName)
            const layout = await this.dependencies.getLayoutScopeRow(tx, schemaName, layoutId)
            if (!layout) throw new MetahubNotFoundError('Layout not found', '')
            const templateKey = this.dependencies.assertLayoutSupportsWidgets(layout)
            if (templateKey !== 'marketing-page' || layout.scope_entity_id) {
                throw new MetahubValidationError('Hero bindings are only available on a source marketing layout')
            }
            const row = await queryOne<DbRow>(
                tx,
                `SELECT id, widget_key, zone, config, COALESCE(_upl_version, 1)::int AS widget_version
                   FROM ${widgetsTable}
                  WHERE id = $1 AND layout_id = $2 AND ${active}`,
                [widgetId, layoutId]
            )
            if (!row) throw new MetahubNotFoundError('Zone widget not found', '')
            const widgetKey = applicationLayoutWidgetKeySchema.parse(row.widget_key)
            const zone = applicationLayoutZoneSchema.parse(row.zone)
            if (widgetKey !== 'marketing.hero') throw new MetahubValidationError('Only Hero placements have an Entity binding')
            const envelope = decodeWidgetConfigEnvelope(row.config, { templateKey, widgetKey, zone, requireBindings: true })
            if (!envelope.neutral.bindings) throw new MetahubValidationError('Hero placement has no Entity binding')
            const target = await loadMarketingHeroBindingBySemanticTarget(tx, schemaName, envelope.neutral.bindings, locale, {
                layoutGraphLockAlreadyHeld: true
            })
            return {
                recordId: target.recordId,
                recordVersion: target.recordVersion,
                widgetVersion: Number(row.widget_version ?? 1),
                label: target.label,
                entityId: target.entityId,
                entityCodename: target.entityCodename
            }
        })
    }

    async getUsage(metahubId: string, recordId: string, excludeWidgetId?: string, userId?: string | null) {
        const { exec, schemaService } = this.dependencies
        const schemaName = await schemaService.ensureSchema(metahubId, userId ?? undefined)
        return exec.transaction(async (tx) => {
            await this.dependencies.acquireLayoutGraphLock(tx, schemaName)
            const target = await loadMarketingHeroBindingTarget(tx, schemaName, recordId, 'en')
            const count = await countMarketingHeroBindingUsage(tx, schemaName, target.binding, excludeWidgetId)
            return { recordId, usageCount: count }
        })
    }
}
