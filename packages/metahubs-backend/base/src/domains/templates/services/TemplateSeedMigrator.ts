import type { Knex } from 'knex'
import type {
    MetahubTemplateSeed,
    TemplateSeedElement,
    TemplateSeedLayout,
    TemplateSeedZoneWidget,
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

export interface SeedMigrationOptions {
    dryRun?: boolean
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
    async migrateSeed(newSeed: MetahubTemplateSeed, options?: SeedMigrationOptions): Promise<SeedMigrationResult> {
        const dryRun = options?.dryRun === true
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
                const layoutIdMap = await this.migrateLayouts(trx, newSeed.layouts, result, dryRun)

                if (newSeed.layoutZoneWidgets && Object.keys(newSeed.layoutZoneWidgets).length > 0) {
                    await this.migrateZoneWidgets(trx, newSeed.layoutZoneWidgets, layoutIdMap, result, dryRun)
                }
            }

            // 2. Migrate settings
            if (newSeed.settings?.length) {
                result.settingsAdded = await this.migrateSettings(trx, newSeed.settings, dryRun)
            }

            // 3. Migrate entities + attributes
            if (newSeed.entities?.length) {
                const entityIdMap = await this.migrateEntities(trx, newSeed.entities, result, dryRun)

                // 4. Migrate elements (requires entity ID map)
                if (newSeed.elements) {
                    result.elementsAdded = await this.migrateElements(trx, newSeed.elements, entityIdMap, result, dryRun)
                }
            }
        })

        return result
    }

    // ─── Layouts ───────────────────────────────────────────────────────

    private async migrateLayouts(
        trx: Knex,
        layouts: TemplateSeedLayout[],
        result: SeedMigrationResult,
        dryRun: boolean
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

            if (dryRun) {
                layoutIdMap.set(layout.codename, `dry-run:layout:${layout.codename}`)
            } else {
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
            }
            result.layoutsAdded++
        }

        return layoutIdMap
    }

    // ─── Zone Widgets ─────────────────────────────────────────────────

    private async migrateZoneWidgets(
        trx: Knex,
        widgetsByLayout: Record<string, TemplateSeedZoneWidget[]>,
        layoutIdMap: Map<string, string>,
        result: SeedMigrationResult,
        dryRun: boolean
    ): Promise<void> {
        const now = new Date()
        const widgetTableName = await resolveWidgetTableName(trx, this.schemaName)

        for (const [layoutCodename, widgets] of Object.entries(widgetsByLayout)) {
            const layoutId = layoutIdMap.get(layoutCodename)
            if (!layoutId) {
                result.skipped.push(`zoneWidgets:${layoutCodename} (layout not found)`)
                continue
            }

            let insertedAny = false
            for (const w of widgets) {
                if (dryRun && layoutId.startsWith('dry-run:')) {
                    insertedAny = true
                    result.zoneWidgetsAdded++
                    continue
                }

                const exists = await trx
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

                if (exists) {
                    result.skipped.push(`zoneWidget:${layoutCodename}:${w.widgetKey} (already exists)`)
                    continue
                }

                if (!dryRun) {
                    // Inherit is_active from an existing peer with same zone+widget_key
                    // but different sortOrder (handles reordering across template versions).
                    const peer = await trx
                        .withSchema(this.schemaName)
                        .from(widgetTableName)
                        .where({
                            layout_id: layoutId,
                            zone: w.zone,
                            widget_key: w.widgetKey,
                            _upl_deleted: false,
                            _mhb_deleted: false
                        })
                        .select('is_active')
                        .orderBy('_upl_updated_at', 'desc')
                        .first()
                    const isActive: boolean = peer != null ? Boolean(peer.is_active) : true

                    await trx
                        .withSchema(this.schemaName)
                        .into(widgetTableName)
                        .insert({
                            layout_id: layoutId,
                            zone: w.zone,
                            widget_key: w.widgetKey,
                            sort_order: w.sortOrder,
                            config: w.config ?? {},
                            is_active: isActive,
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
                insertedAny = true
                result.zoneWidgetsAdded++
            }

            // Clean up orphan duplicates: system-created widgets with same zone+widget_key
            // but non-target sortOrder (left over from template reordering).
            if (!dryRun) {
                for (const w of widgets) {
                    await trx
                        .withSchema(this.schemaName)
                        .from(widgetTableName)
                        .where({
                            layout_id: layoutId,
                            zone: w.zone,
                            widget_key: w.widgetKey,
                            _upl_deleted: false,
                            _mhb_deleted: false
                        })
                        .whereNot('sort_order', w.sortOrder)
                        .whereNull('_upl_created_by')
                        .whereNull('_upl_updated_by')
                        .update({
                            _mhb_deleted: true,
                            _upl_version: trx.raw('_upl_version + 1'),
                            _upl_updated_at: now
                        })
                }
            }

            if (!insertedAny) {
                continue
            }

            if (dryRun) {
                continue
            }

            const layoutRow = await trx.withSchema(this.schemaName).from('_mhb_layouts').where({ id: layoutId }).select('config').first()
            if (hasNonEmptyConfigObject(layoutRow?.config)) {
                result.skipped.push(`layoutConfig:${layoutCodename} (preserved existing config)`)
                continue
            }

            const activeWidgets = await trx
                .withSchema(this.schemaName)
                .from(widgetTableName)
                .where({ layout_id: layoutId, is_active: true, _upl_deleted: false, _mhb_deleted: false })
                .select('widget_key', 'zone')
            const layoutConfig = buildDashboardLayoutConfig(
                activeWidgets.map((row: { widget_key: DashboardLayoutWidgetKey; zone: DashboardLayoutZone }) => ({
                    widgetKey: row.widget_key as DashboardLayoutWidgetKey,
                    zone: row.zone as DashboardLayoutZone
                }))
            )
            await trx.withSchema(this.schemaName).from('_mhb_layouts').where({ id: layoutId }).update({ config: layoutConfig })
        }
    }

    // ─── Settings ─────────────────────────────────────────────────────────

    private async migrateSettings(trx: Knex, settings: NonNullable<MetahubTemplateSeed['settings']>, dryRun: boolean): Promise<number> {
        const now = new Date()
        let added = 0

        for (const setting of settings) {
            const exists = await trx.withSchema(this.schemaName).from('_mhb_settings').where({ key: setting.key }).first()

            if (exists) continue

            if (!dryRun) {
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
            }
            added++
        }

        return added
    }

    // ─── Entities + Attributes ────────────────────────────────────────────

    private async migrateEntities(
        trx: Knex,
        entities: NonNullable<MetahubTemplateSeed['entities']>,
        result: SeedMigrationResult,
        dryRun: boolean
    ): Promise<Map<string, string>> {
        const entityIdMap = new Map<string, string>()
        const now = new Date()

        // ── Pass 1: Insert/resolve all entities, build complete codename→id map ──
        for (const entity of entities) {
            // Check if entity already exists by codename + kind
            const existing = await trx
                .withSchema(this.schemaName)
                .from('_mhb_objects')
                .where({ codename: entity.codename, kind: entity.kind, _upl_deleted: false, _mhb_deleted: false })
                .first()

            if (existing) {
                entityIdMap.set(buildEntityMapKey(entity.kind, entity.codename), existing.id)
                result.skipped.push(`entity:${entity.codename} (already exists)`)
                continue
            }

            if (dryRun) {
                entityIdMap.set(buildEntityMapKey(entity.kind, entity.codename), `dry-run:entity:${entity.kind}:${entity.codename}`)
            } else {
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

                entityIdMap.set(buildEntityMapKey(entity.kind, entity.codename), inserted.id)
            }
            result.entitiesAdded++
        }

        // ── Pass 2: Insert attributes using the complete entity map ──
        for (const entity of entities) {
            const entityId = entityIdMap.get(buildEntityMapKey(entity.kind, entity.codename))
            if (!entityId || !entity.attributes?.length) continue

            for (let i = 0; i < entity.attributes.length; i++) {
                const attr = entity.attributes[i]
                const attrExists = await trx
                    .withSchema(this.schemaName)
                    .from('_mhb_attributes')
                    .where({
                        object_id: entityId,
                        codename: attr.codename,
                        _upl_deleted: false,
                        _mhb_deleted: false
                    })
                    .first()

                if (attrExists) {
                    result.skipped.push(`attribute:${entity.codename}.${attr.codename} (already exists)`)
                    continue
                }

                if (!dryRun) {
                    await trx
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
                result.attributesAdded++
            }
        }

        return entityIdMap
    }

    // ─── Elements ─────────────────────────────────────────────────────────

    private async migrateElements(
        trx: Knex,
        elementsByEntity: Record<string, TemplateSeedElement[]>,
        entityIdMap: Map<string, string>,
        result: SeedMigrationResult,
        dryRun: boolean
    ): Promise<number> {
        const now = new Date()
        let added = 0

        for (const [entityCodename, elements] of Object.entries(elementsByEntity)) {
            const objectId = resolveEntityIdByCodename(entityIdMap, entityCodename)
            if (!objectId) {
                result.skipped.push(`elements:${entityCodename} (entity not found or ambiguous)`)
                continue
            }

            for (const element of elements) {
                if (dryRun && objectId.startsWith('dry-run:')) {
                    added++
                    continue
                }

                const existingElement = await trx
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

                if (existingElement) {
                    result.skipped.push(`element:${entityCodename}:${element.codename} (already exists)`)
                    continue
                }

                if (!dryRun) {
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
                }
                added++
            }
        }

        return added
    }
}
