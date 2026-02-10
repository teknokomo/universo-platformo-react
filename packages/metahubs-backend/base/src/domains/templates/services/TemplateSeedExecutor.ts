import type { Knex } from 'knex'
import type { MetahubTemplateSeed, TemplateSeedLayout, TemplateSeedZoneWidget, TemplateSeedElement } from '@universo/types'
import { buildDashboardLayoutConfig } from '../../shared'

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

        // Check if layouts already exist
        const existingCount = await qb
            .withSchema(this.schemaName)
            .from('_mhb_layouts')
            .where({ _upl_deleted: false, _mhb_deleted: false })
            .count<{ count: string }[]>('* as count')
            .first()

        if (Number(existingCount?.count ?? 0) > 0) {
            // Layouts already seeded — load existing IDs by template_key
            const existing = await qb
                .withSchema(this.schemaName)
                .from('_mhb_layouts')
                .where({ _upl_deleted: false, _mhb_deleted: false })
                .select('id', 'template_key')
            for (const row of existing) {
                // Use template_key as a rough codename proxy for existing layouts
                layoutIdMap.set(row.template_key, row.id)
            }
            return layoutIdMap
        }

        for (const layout of layouts) {
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

        for (const [layoutCodename, widgets] of Object.entries(widgetsByLayout)) {
            const layoutId = layoutIdMap.get(layoutCodename)
            if (!layoutId) {
                console.warn(`[TemplateSeedExecutor] Layout codename "${layoutCodename}" not found in layoutIdMap, skipping widgets`)
                continue
            }

            // Check if widgets already exist for this layout
            const existingCount = await qb
                .withSchema(this.schemaName)
                .from('_mhb_layout_zone_widgets')
                .where({ layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                .count<{ count: string }[]>('* as count')
                .first()

            if (Number(existingCount?.count ?? 0) > 0) continue

            // Insert widgets
            await qb
                .withSchema(this.schemaName)
                .into('_mhb_layout_zone_widgets')
                .insert(
                    widgets.map((w) => ({
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
                    }))
                )

            // Update layout config based on actual widgets inserted
            const layoutConfig = buildDashboardLayoutConfig(
                widgets.map((w) => ({ widgetKey: w.widgetKey, zone: w.zone }))
            )
            await qb
                .withSchema(this.schemaName)
                .from('_mhb_layouts')
                .where({ id: layoutId })
                .update({ config: layoutConfig })
        }
    }

    private async createSettings(qb: Knex, settings: MetahubTemplateSeed['settings']): Promise<void> {
        if (!settings?.length) return

        for (const setting of settings) {
            const exists = await qb
                .withSchema(this.schemaName)
                .from('_mhb_settings')
                .where({ key: setting.key })
                .first()

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

        for (const entity of entities) {
            // Check if entity already exists by codename + kind
            const existing = await qb
                .withSchema(this.schemaName)
                .from('_mhb_objects')
                .where({ codename: entity.codename, kind: entity.kind, _upl_deleted: false, _mhb_deleted: false })
                .first()

            if (existing) {
                entityIdMap.set(entity.codename, existing.id)
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

            entityIdMap.set(entity.codename, inserted.id)

            // Create attributes for this entity
            if (entity.attributes?.length) {
                for (let i = 0; i < entity.attributes.length; i++) {
                    const attr = entity.attributes[i]
                    await qb
                        .withSchema(this.schemaName)
                        .into('_mhb_attributes')
                        .insert({
                            object_id: inserted.id,
                            codename: attr.codename,
                            data_type: attr.dataType,
                            presentation: { name: attr.name, description: attr.description },
                            validation_rules: attr.validationRules ?? {},
                            ui_config: attr.uiConfig ?? {},
                            sort_order: attr.sortOrder ?? i,
                            is_required: attr.isRequired ?? false,
                            is_display_attribute: attr.isDisplayAttribute ?? false,
                            target_object_id: attr.targetEntityCodename
                                ? entityIdMap.get(attr.targetEntityCodename) ?? null
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
            const objectId = entityIdMap.get(entityCodename)
            if (!objectId) {
                console.warn(`[TemplateSeedExecutor] Entity codename "${entityCodename}" not found, skipping elements`)
                continue
            }

            for (const element of elements) {
                await qb
                    .withSchema(this.schemaName)
                    .into('_mhb_elements')
                    .insert({
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
