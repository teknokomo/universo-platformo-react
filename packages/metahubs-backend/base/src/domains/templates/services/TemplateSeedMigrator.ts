import type { Knex } from 'knex'
import type { MetahubTemplateSeed, TemplateSeedElement, TemplateSeedLayout, TemplateSeedZoneWidget } from '@universo/types'
import { buildDashboardLayoutConfig } from '../../shared'

/**
 * Result of an incremental seed data migration.
 */
export interface SeedMigrationResult {
    layoutsAdded: number
    zoneWidgetsAdded: number
    settingsAdded: number
    entitiesAdded: number
    attributesAdded: number
    elementsAdded: number
    skipped: string[]
}

/**
 * TemplateSeedMigrator — applies incremental seed data changes
 * to existing branch schemas during structure version migration.
 *
 * Unlike TemplateSeedExecutor (which runs on fresh schemas),
 * this migrator respects existing user data and only adds
 * NEW seed items that don't conflict with current state.
 *
 * Safe: never overwrites or deletes existing data.
 */
export class TemplateSeedMigrator {
    constructor(private readonly knex: Knex, private readonly schemaName: string) {}

    /**
     * Compare current schema state with new seed and apply missing items.
     * All operations run within a single transaction.
     */
    async migrateSeed(newSeed: MetahubTemplateSeed): Promise<SeedMigrationResult> {
        const result: SeedMigrationResult = {
            layoutsAdded: 0,
            zoneWidgetsAdded: 0,
            settingsAdded: 0,
            entitiesAdded: 0,
            attributesAdded: 0,
            elementsAdded: 0,
            skipped: []
        }

        await this.knex.transaction(async (trx) => {
            // 1. Migrate layouts → zone widgets (order matters: widgets reference layouts)
            if (newSeed.layouts?.length) {
                const layoutIdMap = await this.migrateLayouts(trx, newSeed.layouts, result)

                if (newSeed.layoutZoneWidgets && Object.keys(newSeed.layoutZoneWidgets).length > 0) {
                    await this.migrateZoneWidgets(trx, newSeed.layoutZoneWidgets, layoutIdMap, result)
                }
            }

            // 2. Migrate settings
            if (newSeed.settings?.length) {
                result.settingsAdded = await this.migrateSettings(trx, newSeed.settings)
            }

            // 3. Migrate entities + attributes
            if (newSeed.entities?.length) {
                const entityIdMap = await this.migrateEntities(trx, newSeed.entities, result)

                // 4. Migrate elements (requires entity ID map)
                if (newSeed.elements) {
                    result.elementsAdded = await this.migrateElements(trx, newSeed.elements, entityIdMap, result)
                }
            }
        })

        return result
    }

    // ─── Layouts ───────────────────────────────────────────────────────

    private async migrateLayouts(
        trx: Knex,
        layouts: TemplateSeedLayout[],
        result: SeedMigrationResult
    ): Promise<Map<string, string>> {
        const layoutIdMap = new Map<string, string>()
        const now = new Date()

        for (const layout of layouts) {
            // Check if layout already exists by template_key
            const existing = await trx
                .withSchema(this.schemaName)
                .from('_mhb_layouts')
                .where({ template_key: layout.templateKey, _upl_deleted: false, _mhb_deleted: false })
                .first()

            if (existing) {
                layoutIdMap.set(layout.codename, existing.id)
                result.skipped.push(`layout:${layout.codename} (already exists)`)
                continue
            }

            // If the new layout wants to be default, check for existing default
            let isDefault = layout.isDefault
            if (isDefault) {
                const existingDefault = await trx
                    .withSchema(this.schemaName)
                    .from('_mhb_layouts')
                    .where({ is_default: true, _upl_deleted: false, _mhb_deleted: false })
                    .first()

                if (existingDefault) {
                    // Don't override the user's chosen default
                    isDefault = false
                }
            }

            const config = layout.config ?? {}

            const [inserted] = await trx
                .withSchema(this.schemaName)
                .into('_mhb_layouts')
                .insert({
                    template_key: layout.templateKey,
                    name: layout.name,
                    description: layout.description ?? null,
                    config,
                    is_active: layout.isActive,
                    is_default: isDefault,
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
            result.layoutsAdded++
        }

        return layoutIdMap
    }

    // ─── Zone Widgets ─────────────────────────────────────────────────

    private async migrateZoneWidgets(
        trx: Knex,
        widgetsByLayout: Record<string, TemplateSeedZoneWidget[]>,
        layoutIdMap: Map<string, string>,
        result: SeedMigrationResult
    ): Promise<void> {
        const now = new Date()

        for (const [layoutCodename, widgets] of Object.entries(widgetsByLayout)) {
            const layoutId = layoutIdMap.get(layoutCodename)
            if (!layoutId) {
                result.skipped.push(`zoneWidgets:${layoutCodename} (layout not found)`)
                continue
            }

            // Check if widgets already exist for this layout
            const existingCount = await trx
                .withSchema(this.schemaName)
                .from('_mhb_layout_zone_widgets')
                .where({ layout_id: layoutId, _upl_deleted: false, _mhb_deleted: false })
                .count<{ count: string }[]>('* as count')
                .first()

            if (Number(existingCount?.count ?? 0) > 0) {
                result.skipped.push(`zoneWidgets:${layoutCodename} (${existingCount?.count} already exist)`)
                continue
            }

            // Insert widgets
            await trx
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
            await trx
                .withSchema(this.schemaName)
                .from('_mhb_layouts')
                .where({ id: layoutId })
                .update({ config: layoutConfig })

            result.zoneWidgetsAdded += widgets.length
        }
    }

    // ─── Settings ─────────────────────────────────────────────────────────

    private async migrateSettings(trx: Knex, settings: NonNullable<MetahubTemplateSeed['settings']>): Promise<number> {
        const now = new Date()
        let added = 0

        for (const setting of settings) {
            const exists = await trx.withSchema(this.schemaName).from('_mhb_settings').where({ key: setting.key }).first()

            if (exists) continue

            await trx
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
            added++
        }

        return added
    }

    // ─── Entities + Attributes ────────────────────────────────────────────

    private async migrateEntities(
        trx: Knex,
        entities: NonNullable<MetahubTemplateSeed['entities']>,
        result: SeedMigrationResult
    ): Promise<Map<string, string>> {
        const entityIdMap = new Map<string, string>()
        const now = new Date()

        for (const entity of entities) {
            // Check if entity already exists by codename + kind
            const existing = await trx
                .withSchema(this.schemaName)
                .from('_mhb_objects')
                .where({ codename: entity.codename, kind: entity.kind, _upl_deleted: false, _mhb_deleted: false })
                .first()

            if (existing) {
                entityIdMap.set(entity.codename, existing.id)
                result.skipped.push(`entity:${entity.codename} (already exists)`)
                continue
            }

            const [inserted] = await trx
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
            result.entitiesAdded++

            // Create attributes for this entity
            if (entity.attributes?.length) {
                for (let i = 0; i < entity.attributes.length; i++) {
                    const attr = entity.attributes[i]
                    await trx
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
                            target_object_id: attr.targetEntityCodename ? entityIdMap.get(attr.targetEntityCodename) ?? null : null,
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
                    result.attributesAdded++
                }
            }
        }

        return entityIdMap
    }

    // ─── Elements ─────────────────────────────────────────────────────────

    private async migrateElements(
        trx: Knex,
        elementsByEntity: Record<string, TemplateSeedElement[]>,
        entityIdMap: Map<string, string>,
        result: SeedMigrationResult
    ): Promise<number> {
        const now = new Date()
        let added = 0

        for (const [entityCodename, elements] of Object.entries(elementsByEntity)) {
            const objectId = entityIdMap.get(entityCodename)
            if (!objectId) {
                result.skipped.push(`elements:${entityCodename} (entity not found)`)
                continue
            }

            // Check how many elements already exist for this entity
            const existingCount = await trx
                .withSchema(this.schemaName)
                .from('_mhb_elements')
                .where({ object_id: objectId, _upl_deleted: false, _mhb_deleted: false })
                .count<{ count: string }[]>('* as count')
                .first()

            if (Number(existingCount?.count ?? 0) > 0) {
                result.skipped.push(`elements:${entityCodename} (${existingCount?.count} already exist)`)
                continue
            }

            for (const element of elements) {
                await trx.withSchema(this.schemaName).into('_mhb_elements').insert({
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
                added++
            }
        }

        return added
    }
}
