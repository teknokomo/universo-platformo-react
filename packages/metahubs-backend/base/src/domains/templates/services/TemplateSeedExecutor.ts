import type { Knex } from 'knex'
import type {
    MetahubTemplateSeed,
    TemplateSeedLayout,
    TemplateSeedZoneWidget,
    TemplateSeedElement,
    DashboardLayoutWidgetKey,
    DashboardLayoutZone
} from '@universo/types'
import { buildDashboardLayoutConfig } from '../../shared'
import { resolveWidgetTableName } from './widgetTableResolver'

const buildEntityMapKey = (kind: string, codename: string): string => `${kind}:${codename}`

const resolveEntityIdByCodename = (entityIdMap: Map<string, string>, codename: string, preferredKind?: string): string | null => {
    if (preferredKind) {
        return entityIdMap.get(buildEntityMapKey(preferredKind, codename)) ?? null
    }

    let resolved: string | null = null
    const suffix = `:${codename}`
    for (const [key, id] of entityIdMap.entries()) {
        if (!key.endsWith(suffix)) continue
        if (resolved && resolved !== id) {
            return null
        }
        resolved = id
    }
    return resolved
}

const hasNonEmptyConfigObject = (value: unknown): value is Record<string, unknown> => {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, unknown>).length > 0)
}

/**
 * TemplateSeedExecutor — populates system tables from a template manifest seed.
 *
 * Converts codename-based references to UUID-based rows, generating IDs at runtime.
 * Idempotent: checks for existing data before inserting.
 * All operations run within a single DB transaction to prevent partial seeding.
 */
export class TemplateSeedExecutor {
    constructor(private knex: Knex, private schemaName: string) {}

    /**
     * Apply all seed data from the template manifest to the branch schema.
     * Wrapped in a transaction — partial failure triggers full rollback.
     */
    async apply(seed: MetahubTemplateSeed): Promise<void> {
        await this.knex.transaction(async (trx) => {
            // 1. Create layouts (generate UUID→codename map)
            const layoutIdMap = await this.createLayouts(trx, seed.layouts)

            // 2. Create zone widgets (resolve layout codename → UUID)
            await this.createZoneWidgets(trx, seed.layoutZoneWidgets, layoutIdMap)

            // 3. Create settings
            if (seed.settings?.length) {
                await this.createSettings(trx, seed.settings)
            }

            // 4. Create entities (catalogs, hubs, documents) if any
            if (seed.entities?.length) {
                const entityIdMap = await this.createEntities(trx, seed.entities)

                // 5. Create elements if any
                if (seed.elements) {
                    await this.createElements(trx, seed.elements, entityIdMap)
                }
            }
        })
    }

    private async createLayouts(qb: Knex, layouts: TemplateSeedLayout[]): Promise<Map<string, string>> {
        const layoutIdMap = new Map<string, string>()
        const now = new Date()

        for (const layout of layouts) {
            const existing = await qb
                .withSchema(this.schemaName)
                .from('_mhb_layouts')
                .where({ template_key: layout.templateKey, _upl_deleted: false, _mhb_deleted: false })
                .first()

            if (existing) {
                layoutIdMap.set(layout.codename, existing.id)
                continue
            }

            // Config will be updated after zone widgets are inserted
            const config = layout.config ?? {}

            const [inserted] = await qb
                .withSchema(this.schemaName)
                .into('_mhb_layouts')
                .insert({
                    template_key: layout.templateKey,
                    name: layout.name,
                    description: layout.description ?? null,
                    config,
                    is_active: layout.isActive,
                    is_default: layout.isDefault,
                    sort_order: layout.sortOrder,
                    owner_id: null,
                    _upl_created_at: now,
                    _upl_created_by: null,
                    _upl_updated_at: now,
                    _upl_updated_by: null,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
                .returning('id')

            layoutIdMap.set(layout.codename, inserted.id)
        }

        return layoutIdMap
    }

    private async createZoneWidgets(
        qb: Knex,
        widgetsByLayout: Record<string, TemplateSeedZoneWidget[]>,
        layoutIdMap: Map<string, string>
    ): Promise<void> {
        const now = new Date()
        const widgetTableName = await resolveWidgetTableName(qb, this.schemaName)

        for (const [layoutCodename, widgets] of Object.entries(widgetsByLayout)) {
            const layoutId = layoutIdMap.get(layoutCodename)
            if (!layoutId) {
                console.warn(`[TemplateSeedExecutor] Layout codename "${layoutCodename}" not found in layoutIdMap, skipping widgets`)
                continue
            }

            let insertedAny = false
            for (const w of widgets) {
                const exists = await qb
                    .withSchema(this.schemaName)
                    .from(widgetTableName)
                    .where({
                        layout_id: layoutId,
                        zone: w.zone,
                        widget_key: w.widgetKey,
                        sort_order: w.sortOrder,
                        _upl_deleted: false,
                        _mhb_deleted: false
                    })
                    .first()

                if (exists) continue

                await qb
                    .withSchema(this.schemaName)
                    .into(widgetTableName)
                    .insert({
                        layout_id: layoutId,
                        zone: w.zone,
                        widget_key: w.widgetKey,
                        sort_order: w.sortOrder,
                        config: w.config ?? {},
                        _upl_created_at: now,
                        _upl_created_by: null,
                        _upl_updated_at: now,
                        _upl_updated_by: null,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _mhb_published: true,
                        _mhb_archived: false,
                        _mhb_deleted: false
                    })
                insertedAny = true
            }

            if (!insertedAny) {
                continue
            }

            const layoutRow = await qb.withSchema(this.schemaName).from('_mhb_layouts').where({ id: layoutId }).select('config').first()
            if (hasNonEmptyConfigObject(layoutRow?.config)) {
                continue
            }

            const activeWidgets = await qb
                .withSchema(this.schemaName)
                .from(widgetTableName)
                .where({ layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                .select('widget_key', 'zone')

            const layoutConfig = buildDashboardLayoutConfig(
                activeWidgets.map((row: { widget_key: DashboardLayoutWidgetKey; zone: DashboardLayoutZone }) => ({
                    widgetKey: row.widget_key as DashboardLayoutWidgetKey,
                    zone: row.zone as DashboardLayoutZone
                }))
            )
            await qb.withSchema(this.schemaName).from('_mhb_layouts').where({ id: layoutId }).update({ config: layoutConfig })
        }
    }

    private async createSettings(qb: Knex, settings: MetahubTemplateSeed['settings']): Promise<void> {
        if (!settings?.length) return

        for (const setting of settings) {
            const exists = await qb.withSchema(this.schemaName).from('_mhb_settings').where({ key: setting.key }).first()

            if (!exists) {
                const now = new Date()
                await qb
                    .withSchema(this.schemaName)
                    .into('_mhb_settings')
                    .insert({
                        key: setting.key,
                        value: typeof setting.value === 'object' ? setting.value : { _value: setting.value },
                        _upl_created_at: now,
                        _upl_created_by: null,
                        _upl_updated_at: now,
                        _upl_updated_by: null,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _mhb_published: true,
                        _mhb_archived: false,
                        _mhb_deleted: false
                    })
            }
        }
    }

    private async createEntities(qb: Knex, entities: NonNullable<MetahubTemplateSeed['entities']>): Promise<Map<string, string>> {
        const entityIdMap = new Map<string, string>()
        const now = new Date()

        // ── Pass 1: Insert all entities and build complete codename→id map ──
        for (const entity of entities) {
            // Check if entity already exists by codename + kind
            const existing = await qb
                .withSchema(this.schemaName)
                .from('_mhb_objects')
                .where({ codename: entity.codename, kind: entity.kind, _upl_deleted: false, _mhb_deleted: false })
                .first()

            if (existing) {
                entityIdMap.set(buildEntityMapKey(entity.kind, entity.codename), existing.id)
                continue
            }

            const [inserted] = await qb
                .withSchema(this.schemaName)
                .into('_mhb_objects')
                .insert({
                    kind: entity.kind,
                    codename: entity.codename,
                    table_name: null,
                    presentation: { name: entity.name, description: entity.description },
                    config: entity.config ?? {},
                    _upl_created_at: now,
                    _upl_created_by: null,
                    _upl_updated_at: now,
                    _upl_updated_by: null,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
                .returning('id')

            entityIdMap.set(buildEntityMapKey(entity.kind, entity.codename), inserted.id)
        }

        // ── Pass 2: Insert attributes using the complete entity map ──
        for (const entity of entities) {
            const entityId = entityIdMap.get(buildEntityMapKey(entity.kind, entity.codename))
            if (!entityId || !entity.attributes?.length) continue

            for (let i = 0; i < entity.attributes.length; i++) {
                const attr = entity.attributes[i]
                const attrExists = await qb
                    .withSchema(this.schemaName)
                    .from('_mhb_attributes')
                    .where({
                        object_id: entityId,
                        codename: attr.codename,
                        _upl_deleted: false,
                        _mhb_deleted: false
                    })
                    .first()

                if (attrExists) continue

                await qb
                    .withSchema(this.schemaName)
                    .into('_mhb_attributes')
                    .insert({
                        object_id: entityId,
                        codename: attr.codename,
                        data_type: attr.dataType,
                        presentation: { name: attr.name, description: attr.description },
                        validation_rules: attr.validationRules ?? {},
                        ui_config: attr.uiConfig ?? {},
                        sort_order: attr.sortOrder ?? i,
                        is_required: attr.isRequired ?? false,
                        is_display_attribute: attr.isDisplayAttribute ?? false,
                        target_object_id: attr.targetEntityCodename
                            ? resolveEntityIdByCodename(entityIdMap, attr.targetEntityCodename, attr.targetEntityKind)
                            : null,
                        target_object_kind: attr.targetEntityKind ?? null,
                        _upl_created_at: now,
                        _upl_created_by: null,
                        _upl_updated_at: now,
                        _upl_updated_by: null,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _mhb_published: true,
                        _mhb_archived: false,
                        _mhb_deleted: false
                    })
            }
        }

        return entityIdMap
    }

    private async createElements(
        qb: Knex,
        elementsByEntity: Record<string, TemplateSeedElement[]>,
        entityIdMap: Map<string, string>
    ): Promise<void> {
        const now = new Date()

        for (const [entityCodename, elements] of Object.entries(elementsByEntity)) {
            const objectId = resolveEntityIdByCodename(entityIdMap, entityCodename)
            if (!objectId) {
                console.warn(`[TemplateSeedExecutor] Entity codename "${entityCodename}" not found or ambiguous, skipping elements`)
                continue
            }

            for (const element of elements) {
                const exists = await qb
                    .withSchema(this.schemaName)
                    .from('_mhb_elements')
                    .where({
                        object_id: objectId,
                        sort_order: element.sortOrder,
                        _upl_deleted: false,
                        _mhb_deleted: false
                    })
                    .whereRaw('data = ?::jsonb', [JSON.stringify(element.data ?? {})])
                    .first()

                if (exists) continue

                await qb.withSchema(this.schemaName).into('_mhb_elements').insert({
                    object_id: objectId,
                    data: element.data,
                    sort_order: element.sortOrder,
                    owner_id: null,
                    _upl_created_at: now,
                    _upl_created_by: null,
                    _upl_updated_at: now,
                    _upl_updated_by: null,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
            }
        }
    }
}
