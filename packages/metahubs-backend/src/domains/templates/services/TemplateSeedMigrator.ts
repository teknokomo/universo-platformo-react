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
import { toJsonbValue } from '../../shared/jsonb'
import { codenamePrimaryTextSql, ensureCodenameValue } from '../../shared/codename'
import { resolveWidgetTableName } from './widgetTableResolver'
import { ensureObjectSystemComponentsSeed, readPlatformSystemComponentsPolicyWithKnex } from './systemComponentSeed'
import { buildTemplateSeedEntityCodenameValue, resolveTemplateSeedCodenameConfig } from './TemplateSeedExecutor'

const buildEntityMapKey = (kind: string, codename: string): string => `${kind}:${codename}`
const buildFixedValueMapKey = (setCodename: string, fixedValueCodename: string): string => `${setCodename}:${fixedValueCodename}`

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
    fixedValuesAdded: number
    componentsAdded: number
    enumValuesAdded: number
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
            fixedValuesAdded: 0,
            componentsAdded: 0,
            enumValuesAdded: 0,
            elementsAdded: 0,
            skipped: []
        }

        await this.knex.transaction(async (trx) => {
            const codenameConfig = resolveTemplateSeedCodenameConfig(newSeed.settings)

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

            // 3. Migrate entities + components
            if (newSeed.entities?.length) {
                const entityIdMap = await this.migrateEntities(trx, newSeed.entities, codenameConfig, result, dryRun)

                if (newSeed.optionValues) {
                    result.enumValuesAdded = await this.migrateEnumerationValues(trx, newSeed.optionValues, entityIdMap, result, dryRun)
                }

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
                    // When no peer exists, respect the seed manifest's isActive value
                    // (e.g. new widgets added with isActive: false should stay inactive).
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
                    const seedIsActive = w.isActive !== false
                    const isActive: boolean = peer != null ? Boolean(peer.is_active) : seedIsActive

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

    // ─── Entities + Components ────────────────────────────────────────────

    private async migrateEntities(
        trx: Knex,
        entities: NonNullable<MetahubTemplateSeed['entities']>,
        codenameConfig: ReturnType<typeof resolveTemplateSeedCodenameConfig>,
        result: SeedMigrationResult,
        dryRun: boolean
    ): Promise<Map<string, string>> {
        const entityIdMap = new Map<string, string>()
        const now = new Date()
        const platformSystemComponentsPolicy =
            !dryRun && entities.some((entity) => entity.kind === 'object')
                ? await readPlatformSystemComponentsPolicyWithKnex(trx)
                : undefined

        // ── Pass 1: Insert/resolve all entities, build complete codename→id map ──
        for (const entity of entities) {
            // Check if entity already exists by codename + kind
            const existing = await trx
                .withSchema(this.schemaName)
                .from('_mhb_objects')
                .where({ kind: entity.kind, _upl_deleted: false, _mhb_deleted: false })
                .whereRaw(`${codenamePrimaryTextSql('codename')} = ?`, [entity.codename])
                .first()

            if (existing) {
                entityIdMap.set(buildEntityMapKey(entity.kind, entity.codename), existing.id)
                if (!dryRun && entity.kind === 'object') {
                    await ensureObjectSystemComponentsSeed(trx, this.schemaName, existing.id, null, {
                        policy: platformSystemComponentsPolicy
                    })
                }
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
                        codename: buildTemplateSeedEntityCodenameValue(
                            entity.codename,
                            entity.localizeCodenameFromName === false ? undefined : entity.name,
                            codenameConfig
                        ),
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

                if (entity.kind === 'object') {
                    const systemResult = await ensureObjectSystemComponentsSeed(trx, this.schemaName, inserted.id, null, {
                        policy: platformSystemComponentsPolicy
                    })
                    result.componentsAdded += systemResult.inserted
                }
            }
            result.entitiesAdded++
        }

        const fixedValueIdMap = new Map<string, string>()

        // ── Pass 2: Insert/resolve constants for sets ──
        for (const entity of entities) {
            if (entity.kind !== 'set' || !entity.fixedValues?.length) continue

            const valueGroupId = entityIdMap.get(buildEntityMapKey(entity.kind, entity.codename))
            if (!valueGroupId) continue

            for (let fixedValueIndex = 0; fixedValueIndex < entity.fixedValues.length; fixedValueIndex++) {
                const fixedValue = entity.fixedValues[fixedValueIndex]

                if (dryRun && valueGroupId.startsWith('dry-run:')) {
                    fixedValueIdMap.set(
                        buildFixedValueMapKey(entity.codename, fixedValue.codename),
                        `dry-run:constant:${entity.codename}:${fixedValue.codename}`
                    )
                    result.fixedValuesAdded++
                    continue
                }

                const existing = await trx
                    .withSchema(this.schemaName)
                    .from('_mhb_constants')
                    .where({
                        object_id: valueGroupId,
                        _upl_deleted: false,
                        _mhb_deleted: false
                    })
                    .whereRaw(`${codenamePrimaryTextSql('codename')} = ?`, [fixedValue.codename])
                    .first()

                if (existing) {
                    fixedValueIdMap.set(buildFixedValueMapKey(entity.codename, fixedValue.codename), existing.id)
                    result.skipped.push(`constant:${entity.codename}.${fixedValue.codename} (already exists)`)
                    continue
                }

                if (dryRun) {
                    fixedValueIdMap.set(
                        buildFixedValueMapKey(entity.codename, fixedValue.codename),
                        `dry-run:constant:${entity.codename}:${fixedValue.codename}`
                    )
                } else {
                    const [inserted] = await trx
                        .withSchema(this.schemaName)
                        .into('_mhb_constants')
                        .insert({
                            object_id: valueGroupId,
                            codename: ensureCodenameValue(fixedValue.codename),
                            data_type: fixedValue.dataType,
                            presentation: {
                                codename: null,
                                name: fixedValue.name,
                                description: fixedValue.description ?? null
                            },
                            validation_rules: fixedValue.validationRules ?? {},
                            ui_config: fixedValue.uiConfig ?? {},
                            value_json: toJsonbValue(fixedValue.value),
                            sort_order: fixedValue.sortOrder ?? fixedValueIndex + 1,
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

                    fixedValueIdMap.set(buildFixedValueMapKey(entity.codename, fixedValue.codename), inserted.id)
                }

                result.fixedValuesAdded++
            }
        }

        const resolveTargetFixedValueId = (
            targetEntityKind: string | null | undefined,
            targetEntityCodename: string | undefined,
            targetConstantCodename: string | undefined
        ): string | null => {
            if (targetEntityKind !== 'set' || !targetEntityCodename || !targetConstantCodename) return null
            return fixedValueIdMap.get(buildFixedValueMapKey(targetEntityCodename, targetConstantCodename)) ?? null
        }

        // ── Pass 3: Insert components using the complete entity+constants maps ──
        for (const entity of entities) {
            const entityId = entityIdMap.get(buildEntityMapKey(entity.kind, entity.codename))
            if (!entityId || !entity.components?.length) continue

            for (let i = 0; i < entity.components.length; i++) {
                const cmp = entity.components[i]
                const childComponents = (cmp as unknown as Record<string, unknown>).childComponents as
                    | Array<Record<string, unknown>>
                    | undefined

                if (dryRun && entityId.startsWith('dry-run:')) {
                    result.componentsAdded++
                    if (cmp.dataType === 'TABLE' && childComponents?.length) {
                        result.componentsAdded += childComponents.length
                    }
                    continue
                }

                const attrExists = await trx
                    .withSchema(this.schemaName)
                    .from('_mhb_components')
                    .where({
                        object_id: entityId,
                        _upl_deleted: false,
                        _mhb_deleted: false
                    })
                    .whereRaw(`${codenamePrimaryTextSql('codename')} = ?`, [cmp.codename])
                    .first()

                let parentComponentId: string | null = attrExists?.id ?? null
                let parentInserted = false
                if (attrExists) {
                    result.skipped.push(`component:${entity.codename}.${cmp.codename} (already exists)`)
                    if (cmp.dataType !== 'TABLE') {
                        continue
                    }
                }

                if (!attrExists) {
                    parentInserted = true
                    if (!dryRun) {
                        const [inserted] = await trx
                            .withSchema(this.schemaName)
                            .into('_mhb_components')
                            .insert({
                                object_id: entityId,
                                codename: ensureCodenameValue(cmp.codename),
                                data_type: cmp.dataType,
                                presentation: { name: cmp.name, description: cmp.description },
                                validation_rules: cmp.validationRules ?? {},
                                ui_config: cmp.uiConfig ?? {},
                                sort_order: cmp.sortOrder ?? i,
                                is_required: cmp.isRequired ?? false,
                                is_display_component: cmp.isDisplayComponent ?? false,
                                target_object_id: cmp.targetEntityCodename
                                    ? resolveEntityIdByCodename(entityIdMap, cmp.targetEntityCodename, cmp.targetEntityKind)
                                    : null,
                                target_object_kind: cmp.targetEntityKind ?? null,
                                target_constant_id: resolveTargetFixedValueId(
                                    cmp.targetEntityKind,
                                    cmp.targetEntityCodename,
                                    cmp.targetConstantCodename
                                ),
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
                        parentComponentId = inserted?.id ?? null
                    }
                }

                if (!dryRun) {
                    if (cmp.dataType === 'TABLE' && childComponents?.length && parentComponentId) {
                        for (let ci = 0; ci < childComponents.length; ci++) {
                            const child = childComponents[ci]
                            const childExists = await trx
                                .withSchema(this.schemaName)
                                .from('_mhb_components')
                                .where({
                                    parent_component_id: parentComponentId,
                                    _upl_deleted: false,
                                    _mhb_deleted: false
                                })
                                .whereRaw(`${codenamePrimaryTextSql('codename')} = ?`, [child.codename as string])
                                .first()

                            if (childExists) {
                                result.skipped.push(
                                    `child-component:${entity.codename}.${cmp.codename}.${child.codename as string} (already exists)`
                                )
                                continue
                            }

                            await trx
                                .withSchema(this.schemaName)
                                .into('_mhb_components')
                                .insert({
                                    object_id: entityId,
                                    parent_component_id: parentComponentId,
                                    codename: ensureCodenameValue(child.codename as string),
                                    data_type: child.dataType as string,
                                    presentation: {
                                        name: child.name,
                                        description: child.description ?? null
                                    },
                                    validation_rules: (child.validationRules as Record<string, unknown>) ?? {},
                                    ui_config: (child.uiConfig as Record<string, unknown>) ?? {},
                                    sort_order: (child.sortOrder as number) ?? ci,
                                    is_required: (child.isRequired as boolean) ?? false,
                                    is_display_component: false,
                                    target_object_id:
                                        typeof child.targetEntityCodename === 'string'
                                            ? resolveEntityIdByCodename(
                                                  entityIdMap,
                                                  child.targetEntityCodename,
                                                  (child.targetEntityKind as string | undefined) ?? undefined
                                              )
                                            : null,
                                    target_object_kind: (child.targetEntityKind as string | null | undefined) ?? null,
                                    target_constant_id: resolveTargetFixedValueId(
                                        (child.targetEntityKind as string | null | undefined) ?? null,
                                        (child.targetEntityCodename as string | undefined) ?? undefined,
                                        (child.targetConstantCodename as string | undefined) ?? undefined
                                    ),
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
                            result.componentsAdded++
                        }
                    }
                }
                if (parentInserted) {
                    result.componentsAdded++
                }
            }
        }

        return entityIdMap
    }

    // ─── Enumeration values ─────────────────────────────────────────────

    private async migrateEnumerationValues(
        trx: Knex,
        valuesByEnumeration: Record<
            string,
            Array<{ codename: string; name: unknown; description?: unknown; sortOrder?: number; isDefault?: boolean }>
        >,
        entityIdMap: Map<string, string>,
        result: SeedMigrationResult,
        dryRun: boolean
    ): Promise<number> {
        const now = new Date()
        let added = 0

        for (const [enumerationCodename, values] of Object.entries(valuesByEnumeration)) {
            const objectId = resolveEntityIdByCodename(entityIdMap, enumerationCodename, 'enumeration')
            if (!objectId) {
                result.skipped.push(`optionValues:${enumerationCodename} (entity not found or ambiguous)`)
                continue
            }

            for (let index = 0; index < values.length; index++) {
                const value = values[index]

                if (dryRun && objectId.startsWith('dry-run:')) {
                    added++
                    continue
                }

                const exists = await trx
                    .withSchema(this.schemaName)
                    .from('_mhb_values')
                    .where({
                        object_id: objectId,
                        _upl_deleted: false,
                        _mhb_deleted: false
                    })
                    .whereRaw(`${codenamePrimaryTextSql('codename')} = ?`, [value.codename])
                    .first()

                if (exists) {
                    result.skipped.push(`enumerationValue:${enumerationCodename}.${value.codename} (already exists)`)
                    continue
                }

                if (!dryRun) {
                    if (value.isDefault) {
                        await trx
                            .withSchema(this.schemaName)
                            .from('_mhb_values')
                            .where({
                                object_id: objectId,
                                _upl_deleted: false,
                                _mhb_deleted: false
                            })
                            .update({
                                is_default: false,
                                _upl_updated_at: now,
                                _upl_updated_by: null
                            })
                    }

                    await trx
                        .withSchema(this.schemaName)
                        .into('_mhb_values')
                        .insert({
                            object_id: objectId,
                            codename: ensureCodenameValue(value.codename),
                            presentation: { name: value.name, description: value.description },
                            sort_order: value.sortOrder ?? index,
                            is_default: value.isDefault ?? false,
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
