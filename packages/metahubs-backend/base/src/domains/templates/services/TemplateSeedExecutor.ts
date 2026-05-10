import type { Knex } from 'knex'
import type {
    MetahubTemplateSeed,
    TemplateSeedLayout,
    TemplateSeedZoneWidget,
    TemplateSeedElement,
    TemplateSeedScript,
    DashboardLayoutWidgetKey,
    DashboardLayoutZone,
    CodenameAlphabet,
    CodenameStyle,
    VersionedLocalizedContent
} from '@universo/types'
import { compileScriptSource } from '@universo/scripting-engine'
import { normalizeCodenameForStyle } from '@universo/utils/validation/codename'
import { buildDashboardLayoutConfig } from '../../shared'
import { toJsonbValue } from '../../shared/jsonb'
import { codenamePrimaryTextSql, ensureCodenameValue } from '../../shared/codename'
import { resolveWidgetTableName } from './widgetTableResolver'
import { ensureCatalogSystemFieldDefinitionsSeed, readPlatformSystemFieldDefinitionsPolicyWithKnex } from './systemFieldDefinitionSeed'
import { createLogger } from '../../../utils/logger'

const log = createLogger('TemplateSeedExecutor')

const buildEntityMapKey = (kind: string, codename: string): string => `${kind}:${codename}`
const buildFixedValueMapKey = (setCodename: string, fixedValueCodename: string): string => `${setCodename}:${fixedValueCodename}`

type TemplateSeedCodenameConfig = {
    style: CodenameStyle
    alphabet: CodenameAlphabet
    localizedEnabled: boolean
}

const DEFAULT_TEMPLATE_SEED_CODENAME_CONFIG: TemplateSeedCodenameConfig = {
    style: 'pascal-case',
    alphabet: 'en-ru',
    localizedEnabled: true
}

const normalizeLocaleCode = (value: string): string => value.split('-')[0].split('_')[0].toLowerCase()

const readTemplateSeedSettingValue = (settings: MetahubTemplateSeed['settings'], key: string): unknown => {
    const setting = settings?.find((entry) => entry.key === key)
    return setting && setting.value && typeof setting.value === 'object' ? setting.value._value : undefined
}

export const resolveTemplateSeedCodenameConfig = (settings: MetahubTemplateSeed['settings']): TemplateSeedCodenameConfig => {
    const rawStyle = readTemplateSeedSettingValue(settings, 'general.codenameStyle')
    const rawAlphabet = readTemplateSeedSettingValue(settings, 'general.codenameAlphabet')
    const rawLocalizedEnabled = readTemplateSeedSettingValue(settings, 'general.codenameLocalizedEnabled')

    return {
        style: rawStyle === 'kebab-case' || rawStyle === 'pascal-case' ? rawStyle : DEFAULT_TEMPLATE_SEED_CODENAME_CONFIG.style,
        alphabet:
            rawAlphabet === 'en' || rawAlphabet === 'ru' || rawAlphabet === 'en-ru'
                ? rawAlphabet
                : DEFAULT_TEMPLATE_SEED_CODENAME_CONFIG.alphabet,
        localizedEnabled: rawLocalizedEnabled !== false
    }
}

export const buildTemplateSeedEntityCodenameValue = (
    codename: string,
    name: VersionedLocalizedContent<string> | null | undefined,
    config: TemplateSeedCodenameConfig = DEFAULT_TEMPLATE_SEED_CODENAME_CONFIG
): ReturnType<typeof ensureCodenameValue> => {
    const baseCodename = ensureCodenameValue(codename)

    if (!config.localizedEnabled || !name?.locales || typeof name.locales !== 'object') {
        return baseCodename
    }

    const primaryLocale = typeof baseCodename._primary === 'string' ? normalizeLocaleCode(baseCodename._primary) : 'en'
    const nextCodename = {
        ...baseCodename,
        locales: {
            ...(baseCodename.locales ?? {})
        }
    }

    for (const [locale, entry] of Object.entries(name.locales)) {
        const normalizedLocale = normalizeLocaleCode(locale)
        const localizedName = typeof entry?.content === 'string' ? entry.content.trim() : ''
        if (!localizedName) {
            continue
        }

        nextCodename.locales[normalizedLocale] = {
            content: normalizeCodenameForStyle(localizedName, config.style, config.alphabet),
            version:
                typeof nextCodename.locales?.[normalizedLocale]?.version === 'number' ? nextCodename.locales[normalizedLocale].version : 1,
            isActive: nextCodename.locales?.[normalizedLocale]?.isActive !== false,
            createdAt: nextCodename.locales?.[normalizedLocale]?.createdAt ?? nextCodename.locales?.[primaryLocale]?.createdAt,
            updatedAt: nextCodename.locales?.[normalizedLocale]?.updatedAt ?? nextCodename.locales?.[primaryLocale]?.updatedAt
        }
    }

    return nextCodename
}

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

const normalizeStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []

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
            const codenameConfig = resolveTemplateSeedCodenameConfig(seed.settings)
            let entityIdMap = new Map<string, string>()

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
                entityIdMap = await this.createEntities(trx, seed.entities, codenameConfig)

                if (seed.optionValues) {
                    await this.createOptionValues(trx, seed.optionValues, entityIdMap)
                }

                // 5. Create elements if any
                if (seed.elements) {
                    await this.createElements(trx, seed.elements, entityIdMap)
                }
            }

            if (seed.scripts?.length) {
                await this.createScripts(trx, seed.scripts, entityIdMap)
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
                log.warn(`Layout codename "${layoutCodename}" not found in layoutIdMap, skipping widgets`)
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
                        is_active: w.isActive !== false,
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
                .where({ layout_id: layoutId, is_active: true, _upl_deleted: false, _mhb_deleted: false })
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

    private async createEntities(
        qb: Knex,
        entities: NonNullable<MetahubTemplateSeed['entities']>,
        codenameConfig: TemplateSeedCodenameConfig
    ): Promise<Map<string, string>> {
        const entityIdMap = new Map<string, string>()
        const fixedValueIdMap = new Map<string, string>()
        const now = new Date()
        const platformSystemFieldDefinitionsPolicy = entities.some((entity) => entity.kind === 'catalog')
            ? await readPlatformSystemFieldDefinitionsPolicyWithKnex(qb)
            : undefined

        // Track per-kind sort order counters (1-based)
        const kindSortCounters = new Map<string, number>()

        // ── Pass 1: Insert all entities and build complete codename→id map ──
        for (const entity of entities) {
            // Check if entity already exists by codename + kind
            const existing = await qb
                .withSchema(this.schemaName)
                .from('_mhb_objects')
                .where({ kind: entity.kind, _upl_deleted: false, _mhb_deleted: false })
                .whereRaw(`${codenamePrimaryTextSql('codename')} = ?`, [entity.codename])
                .first()

            if (existing) {
                entityIdMap.set(buildEntityMapKey(entity.kind, entity.codename), existing.id)
                if (entity.kind === 'catalog') {
                    await ensureCatalogSystemFieldDefinitionsSeed(qb, this.schemaName, existing.id, null, {
                        policy: platformSystemFieldDefinitionsPolicy
                    })
                }
                continue
            }

            // Compute the next sortOrder for this kind (1-based), stored in config JSONB
            const nextSortOrder = (kindSortCounters.get(entity.kind) ?? 0) + 1
            kindSortCounters.set(entity.kind, nextSortOrder)

            const entityConfig = entity.config && typeof entity.config === 'object' ? { ...entity.config } : {}
            entityConfig.sortOrder = nextSortOrder

            const [inserted] = await qb
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
                    config: entityConfig,
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

            if (entity.kind === 'catalog') {
                await ensureCatalogSystemFieldDefinitionsSeed(qb, this.schemaName, inserted.id, null, {
                    policy: platformSystemFieldDefinitionsPolicy
                })
            }
        }

        await this.applyEntityHubAssignments(qb, entities, entityIdMap)

        // ── Pass 2: Insert set constants and build complete set+constant codename→id map ──
        for (const entity of entities) {
            if (entity.kind !== 'set' || !entity.fixedValues?.length) continue

            const valueGroupId = entityIdMap.get(buildEntityMapKey(entity.kind, entity.codename))
            if (!valueGroupId) continue

            for (let fixedValueIndex = 0; fixedValueIndex < entity.fixedValues.length; fixedValueIndex++) {
                const fixedValue = entity.fixedValues[fixedValueIndex]
                const existing = await qb
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
                    continue
                }

                const [inserted] = await qb
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
        }

        const resolveTargetFixedValueId = (
            targetEntityKind: string | null | undefined,
            targetEntityCodename: string | undefined,
            targetConstantCodename: string | undefined
        ): string | null => {
            if (targetEntityKind !== 'set' || !targetEntityCodename || !targetConstantCodename) return null
            return fixedValueIdMap.get(buildFixedValueMapKey(targetEntityCodename, targetConstantCodename)) ?? null
        }

        // ── Pass 3: Insert attributes using the complete entity + constants maps ──
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
                        _upl_deleted: false,
                        _mhb_deleted: false
                    })
                    .whereRaw(`${codenamePrimaryTextSql('codename')} = ?`, [attr.codename])
                    .first()

                let parentAttributeId: string | null = attrExists?.id ?? null
                if (!attrExists) {
                    const [inserted] = await qb
                        .withSchema(this.schemaName)
                        .into('_mhb_attributes')
                        .insert({
                            object_id: entityId,
                            codename: ensureCodenameValue(attr.codename),
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
                            target_constant_id: resolveTargetFixedValueId(
                                attr.targetEntityKind,
                                attr.targetEntityCodename,
                                attr.targetConstantCodename
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
                    parentAttributeId = inserted?.id ?? null
                }

                // Insert child attributes for TABLE data type
                const childAttributes = (attr as unknown as Record<string, unknown>).childAttributes as
                    | Array<Record<string, unknown>>
                    | undefined
                if (attr.dataType === 'TABLE' && childAttributes?.length && parentAttributeId) {
                    for (let ci = 0; ci < childAttributes.length; ci++) {
                        const child = childAttributes[ci]
                        const childExists = await qb
                            .withSchema(this.schemaName)
                            .from('_mhb_attributes')
                            .where({
                                parent_attribute_id: parentAttributeId,
                                _upl_deleted: false,
                                _mhb_deleted: false
                            })
                            .whereRaw(`${codenamePrimaryTextSql('codename')} = ?`, [child.codename as string])
                            .first()

                        if (childExists) continue

                        await qb
                            .withSchema(this.schemaName)
                            .into('_mhb_attributes')
                            .insert({
                                object_id: entityId,
                                parent_attribute_id: parentAttributeId,
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
                                is_display_attribute: false,
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
                    }
                }
            }
        }

        return entityIdMap
    }

    private resolveSeedEntityTreeEntityIds(
        entity: NonNullable<MetahubTemplateSeed['entities']>[number],
        entityIdMap: Map<string, string>
    ): string[] {
        const mappedTreeEntityIds: string[] = []

        for (const hubCodename of entity.hubs ?? []) {
            const treeEntityId =
                resolveEntityIdByCodename(entityIdMap, hubCodename, 'hub') ?? resolveEntityIdByCodename(entityIdMap, hubCodename)

            if (!treeEntityId) {
                log.warn(
                    `Hub codename "${hubCodename}" not found or ambiguous while seeding entity kind=${entity.kind} codename=${entity.codename}`
                )
                continue
            }

            if (!mappedTreeEntityIds.includes(treeEntityId)) {
                mappedTreeEntityIds.push(treeEntityId)
            }
        }

        return mappedTreeEntityIds
    }

    private async applyEntityHubAssignments(
        qb: Knex,
        entities: NonNullable<MetahubTemplateSeed['entities']>,
        entityIdMap: Map<string, string>
    ): Promise<void> {
        const now = new Date()

        for (const entity of entities) {
            if (!entity.hubs?.length) continue

            const entityId = entityIdMap.get(buildEntityMapKey(entity.kind, entity.codename))
            if (!entityId) continue

            const existing = await qb
                .withSchema(this.schemaName)
                .from('_mhb_objects')
                .where({
                    id: entityId,
                    _upl_deleted: false,
                    _mhb_deleted: false
                })
                .first<{ config?: unknown }>()

            const currentConfig = hasNonEmptyConfigObject(existing?.config) ? { ...existing.config } : {}
            const nextTreeEntityIds = this.resolveSeedEntityTreeEntityIds(entity, entityIdMap)
            const currentTreeEntityIds = normalizeStringArray(currentConfig.hubs)

            if (JSON.stringify(currentTreeEntityIds) === JSON.stringify(nextTreeEntityIds)) {
                continue
            }

            if (nextTreeEntityIds.length > 0) {
                currentConfig.hubs = nextTreeEntityIds
            } else {
                delete currentConfig.hubs
            }

            await qb
                .withSchema(this.schemaName)
                .from('_mhb_objects')
                .where({
                    id: entityId,
                    _upl_deleted: false,
                    _mhb_deleted: false
                })
                .update({
                    config: currentConfig,
                    _upl_updated_at: now,
                    _upl_updated_by: null
                })
        }
    }

    private async createOptionValues(
        qb: Knex,
        valuesByEnumeration: Record<
            string,
            Array<{ codename: string; name: unknown; description?: unknown; sortOrder?: number; isDefault?: boolean }>
        >,
        entityIdMap: Map<string, string>
    ): Promise<void> {
        const now = new Date()

        for (const [enumerationCodename, values] of Object.entries(valuesByEnumeration)) {
            const objectId = resolveEntityIdByCodename(entityIdMap, enumerationCodename, 'enumeration')
            if (!objectId) {
                log.warn(`Enumeration codename "${enumerationCodename}" not found or ambiguous, skipping enumeration values`)
                continue
            }

            for (let index = 0; index < values.length; index++) {
                const value = values[index]
                const exists = await qb
                    .withSchema(this.schemaName)
                    .from('_mhb_values')
                    .where({
                        object_id: objectId,
                        _upl_deleted: false,
                        _mhb_deleted: false
                    })
                    .whereRaw(`${codenamePrimaryTextSql('codename')} = ?`, [value.codename])
                    .first()

                if (exists) continue

                if (value.isDefault) {
                    await qb
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

                await qb
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
        }
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
                log.warn(`Entity codename "${entityCodename}" not found or ambiguous, skipping elements`)
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

    private async createScripts(qb: Knex, scripts: TemplateSeedScript[], entityIdMap: Map<string, string>): Promise<void> {
        const now = new Date()

        for (const script of scripts) {
            const attachedToId =
                script.attachedToKind === 'metahub' || script.attachedToKind === 'general'
                    ? null
                    : script.attachedToEntityCodename
                    ? resolveEntityIdByCodename(entityIdMap, script.attachedToEntityCodename, script.attachedToKind)
                    : null

            if (script.attachedToKind !== 'metahub' && script.attachedToKind !== 'general' && !attachedToId) {
                log.warn(
                    `Script target ${script.attachedToKind}:${script.attachedToEntityCodename ?? '[missing]'} not found, skipping ${
                        script.codename
                    }`
                )
                continue
            }

            const existing = await qb
                .withSchema(this.schemaName)
                .from('_mhb_scripts')
                .where({
                    attached_to_kind: script.attachedToKind,
                    attached_to_id: attachedToId,
                    module_role: script.moduleRole,
                    _upl_deleted: false,
                    _mhb_deleted: false
                })
                .whereRaw(`${codenamePrimaryTextSql('codename')} = ?`, [script.codename])
                .first()

            if (existing) {
                continue
            }

            const artifact = await compileScriptSource({
                codename: script.codename,
                sourceCode: script.sourceCode,
                sdkApiVersion: script.sdkApiVersion,
                moduleRole: script.moduleRole,
                sourceKind: script.sourceKind,
                capabilities: script.capabilities
            })

            await qb
                .withSchema(this.schemaName)
                .into('_mhb_scripts')
                .insert({
                    codename: ensureCodenameValue(script.codename),
                    presentation: {
                        name: script.name,
                        description: script.description ?? null
                    },
                    attached_to_kind: script.attachedToKind,
                    attached_to_id: attachedToId,
                    module_role: artifact.manifest.moduleRole,
                    source_kind: artifact.manifest.sourceKind,
                    sdk_api_version: artifact.manifest.sdkApiVersion,
                    source_code: script.sourceCode,
                    manifest: artifact.manifest,
                    server_bundle: artifact.serverBundle,
                    client_bundle: artifact.clientBundle,
                    checksum: artifact.checksum,
                    is_active: script.isActive !== false,
                    config: script.config ?? {},
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
