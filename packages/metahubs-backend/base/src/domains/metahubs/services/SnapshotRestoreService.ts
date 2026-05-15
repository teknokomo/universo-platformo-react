import type { Knex } from 'knex'
import { createLocalizedContent, getCodenamePrimary } from '@universo/utils'
import {
    SHARED_ENTITY_KIND_TO_POOL_KIND,
    SHARED_POOL_TO_ENTITY_KIND,
    SHARED_POOL_TO_TARGET_KIND,
    isEnabledCapabilityConfig,
    normalizeLedgerConfigFromConfig,
    normalizePageBlockContentForStorage,
    supportsLedgerSchema,
    validateLedgerConfigReferences,
    type BlockContentCapabilityConfig,
    type PageBlockContentValidationOptions,
    type SharedEntityKind,
    type SharedObjectKind
} from '@universo/types'
import type {
    MetahubEntityTypeDefinitionSnapshot,
    MetahubSnapshot,
    MetahubSettingSnapshot,
    MetaEntitySnapshot,
    MetaFieldSnapshot
} from '../../publications/services/SnapshotSerializer'
import { ensureCodenameValue } from '../../shared/codename'
import { MetahubValidationError } from '../../shared/domainErrors'
import { toJsonbValue } from '../../shared/jsonb'
import { SHARED_CONTAINER_DESCRIPTORS } from '../../shared/services/SharedContainerService'
import { ensureObjectSystemComponentsSeed, readPlatformSystemComponentsPolicyWithKnex } from '../../templates/services/systemComponentSeed'
import { resolveWidgetTableName } from '../../templates/services/widgetTableResolver'
import { createLogger } from '../../../utils/logger'

const log = createLogger('SnapshotRestoreService')

type SnapshotScript = NonNullable<MetahubSnapshot['scripts']>[number] & {
    sourceCode?: string
}

type SharedEntityIdMaps = Record<SharedEntityKind, Map<string, string>>

const getScriptCodenameText = (codename: SnapshotScript['codename']): string => getCodenamePrimary(codename) ?? '[unknown]'

const getEntityCodenameText = (codename: MetaEntitySnapshot['codename']): string => {
    if (typeof codename === 'string') return codename
    return getCodenamePrimary(codename) ?? '[unknown]'
}

const getFieldCodenameText = (codename: MetaFieldSnapshot['codename']): string => {
    if (typeof codename === 'string') return codename
    return getCodenamePrimary(codename) ?? '[unknown]'
}

const buildPageBlockContentValidationOptions = (component: Partial<BlockContentCapabilityConfig>): PageBlockContentValidationOptions => ({
    allowedBlockTypes: component.allowedBlockTypes,
    maxBlocks: component.maxBlocks
})

/**
 * Restores metahub branch schema entities from a MetahubSnapshot.
 *
 * Follows the TemplateSeedExecutor 3-pass creation order to satisfy FK constraints:
 *   Pass 1 — Entities (hubs, objects, sets, enumerations) + system components
 *   Pass 2 — Constants (for sets)
 *   Pass 3 — Components + children → enum values → elements
 *   Final  — Layouts + zone widgets
 *
 * All operations run within a single Knex transaction for atomicity.
 */
export class SnapshotRestoreService {
    constructor(private readonly knex: Knex, private readonly schemaName: string) {}

    async restoreFromSnapshot(metahubId: string, snapshot: MetahubSnapshot, userId: string): Promise<void> {
        await this.knex.transaction(async (trx) => {
            await this.restoreEntityTypeDefinitions(trx, snapshot, userId)

            // oldEntityId → newEntityId
            const entityIdMap = await this.restoreEntities(trx, snapshot, userId)

            // oldConstantId → newConstantId
            const constantIdMap = await this.restoreConstants(trx, snapshot, entityIdMap, userId)

            const componentIdMap = await this.restoreComponents(trx, snapshot, entityIdMap, constantIdMap, userId)
            await this.restoreEnumerationValues(trx, snapshot, entityIdMap, userId)
            const sharedEntityIdMaps = await this.restoreSharedEntities(trx, snapshot, entityIdMap, constantIdMap, userId)
            await this.restoreSharedEntityOverrides(trx, snapshot, entityIdMap, sharedEntityIdMaps, userId)
            await this.restoreElements(trx, snapshot, entityIdMap, userId)
            const scriptIdMap = await this.restoreScripts(trx, metahubId, snapshot, entityIdMap, componentIdMap, userId)
            const actionIdMap = await this.restoreActions(trx, snapshot, entityIdMap, scriptIdMap, userId)
            await this.restoreEventBindings(trx, snapshot, entityIdMap, actionIdMap, userId)
            await this.restoreLayouts(trx, snapshot, entityIdMap, userId)
            await this.restoreSettings(trx, snapshot, userId)
        })
    }

    private async restoreSettings(qb: Knex.Transaction, snapshot: MetahubSnapshot, userId: string): Promise<void> {
        const settings = (snapshot.settings ?? []).filter(
            (setting): setting is MetahubSettingSnapshot =>
                typeof setting?.key === 'string' &&
                setting.key.trim().length > 0 &&
                Boolean(setting.value) &&
                typeof setting.value === 'object' &&
                !Array.isArray(setting.value)
        )
        if (settings.length === 0) {
            return
        }

        const now = new Date()
        for (const setting of settings) {
            const row = {
                key: setting.key.trim(),
                value: toJsonbValue(setting.value),
                _upl_updated_at: now,
                _upl_updated_by: userId,
                _mhb_deleted: false,
                _mhb_deleted_at: null,
                _mhb_deleted_by: null,
                _upl_deleted: false,
                _upl_deleted_at: null,
                _upl_deleted_by: null
            }
            const existing = await qb.withSchema(this.schemaName).from('_mhb_settings').where({ key: row.key }).first<{ id: string }>()

            if (existing?.id) {
                await qb
                    .withSchema(this.schemaName)
                    .from('_mhb_settings')
                    .where({ id: existing.id })
                    .update({
                        ...row,
                        _upl_version: qb.raw('COALESCE(_upl_version, 1) + 1')
                    })
                continue
            }

            await qb
                .withSchema(this.schemaName)
                .from('_mhb_settings')
                .insert({
                    ...row,
                    _upl_created_at: now,
                    _upl_created_by: userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false
                })
        }
    }

    private async restoreEntityTypeDefinitions(qb: Knex.Transaction, snapshot: MetahubSnapshot, userId: string): Promise<void> {
        const definitions = Object.values(snapshot.entityTypeDefinitions ?? {})
        if (!definitions.length) {
            return
        }

        const now = new Date()

        for (const definition of definitions) {
            const row = {
                kind_key: definition.kindKey,
                codename: ensureCodenameValue(definition.codename),
                presentation: definition.presentation ?? {},
                capabilities: definition.capabilities ?? {},
                ui_config: definition.ui ?? {},
                config: definition.config ?? {},
                _upl_updated_at: now,
                _upl_updated_by: userId,
                _mhb_published: definition.published === true,
                _mhb_archived: false,
                _mhb_deleted: false
            }
            const existing = await qb
                .withSchema(this.schemaName)
                .from('_mhb_entity_type_definitions')
                .where({ kind_key: definition.kindKey, _upl_deleted: false, _mhb_deleted: false })
                .first<{ id: string }>()

            if (existing?.id) {
                await qb
                    .withSchema(this.schemaName)
                    .from('_mhb_entity_type_definitions')
                    .where({ id: existing.id })
                    .update({
                        ...row,
                        _upl_version: qb.raw('_upl_version + 1')
                    })
                continue
            }

            await qb
                .withSchema(this.schemaName)
                .into('_mhb_entity_type_definitions')
                .insert({
                    ...row,
                    _upl_created_at: now,
                    _upl_created_by: userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false
                })
        }
    }

    private createSharedEntityIdMaps(): SharedEntityIdMaps {
        return {
            component: new Map<string, string>(),
            constant: new Map<string, string>(),
            value: new Map<string, string>()
        }
    }

    private async createSharedContainer(qb: Knex.Transaction, sharedKind: SharedObjectKind, userId: string, now: Date): Promise<string> {
        const descriptor = SHARED_CONTAINER_DESCRIPTORS[sharedKind]

        const [inserted] = await qb
            .withSchema(this.schemaName)
            .into('_mhb_objects')
            .insert({
                kind: sharedKind,
                codename: ensureCodenameValue(descriptor.codename),
                table_name: null,
                presentation: {
                    name: createLocalizedContent('en', descriptor.title),
                    description: createLocalizedContent('en', descriptor.description)
                },
                config: {
                    isVirtualContainer: true,
                    sortOrder: 0,
                    sharedEntityKind: SHARED_POOL_TO_ENTITY_KIND[sharedKind],
                    targetObjectKind: SHARED_POOL_TO_TARGET_KIND[sharedKind]
                },
                _upl_created_at: now,
                _upl_created_by: userId,
                _upl_updated_at: now,
                _upl_updated_by: userId,
                _upl_version: 1,
                _upl_archived: false,
                _upl_deleted: false,
                _upl_locked: false,
                _mhb_published: false,
                _mhb_archived: false,
                _mhb_deleted: false
            })
            .returning('id')

        return inserted.id
    }

    private async restoreSharedEntities(
        qb: Knex.Transaction,
        snapshot: MetahubSnapshot,
        entityIdMap: Map<string, string>,
        constantIdMap: Map<string, string>,
        userId: string
    ): Promise<SharedEntityIdMaps> {
        const sharedEntityIdMaps = this.createSharedEntityIdMaps()
        const now = new Date()

        const sharedComponents = snapshot.sharedComponents ?? snapshot.sharedComponents ?? []
        const sharedFixedValues = snapshot.sharedFixedValues ?? []
        const sharedEnumerationValues = snapshot.sharedOptionValues ?? snapshot.sharedEnumerationValues ?? []

        const sharedContainerIds: Partial<Record<SharedEntityKind, string>> = {}

        if (sharedComponents.length > 0) {
            sharedContainerIds.component = await this.createSharedContainer(qb, SHARED_ENTITY_KIND_TO_POOL_KIND.component, userId, now)
        }

        if (sharedFixedValues.length > 0) {
            sharedContainerIds.constant = await this.createSharedContainer(qb, SHARED_ENTITY_KIND_TO_POOL_KIND.constant, userId, now)
        }

        if (sharedEnumerationValues.length > 0) {
            sharedContainerIds.value = await this.createSharedContainer(qb, SHARED_ENTITY_KIND_TO_POOL_KIND.value, userId, now)
        }

        if (sharedContainerIds.component) {
            for (const field of sharedComponents) {
                const parentId = await this.insertComponent(
                    qb,
                    sharedContainerIds.component,
                    null,
                    field,
                    entityIdMap,
                    constantIdMap,
                    sharedEntityIdMaps.component,
                    userId,
                    now
                )

                if (field.dataType === 'TABLE' && field.childFields?.length && parentId) {
                    for (const child of field.childFields) {
                        await this.insertComponent(
                            qb,
                            sharedContainerIds.component,
                            parentId,
                            child as MetaFieldSnapshot,
                            entityIdMap,
                            constantIdMap,
                            sharedEntityIdMaps.component,
                            userId,
                            now
                        )
                    }
                }
            }
        }

        if (sharedContainerIds.constant) {
            for (const constant of sharedFixedValues) {
                const [inserted] = await qb
                    .withSchema(this.schemaName)
                    .into('_mhb_constants')
                    .insert({
                        object_id: sharedContainerIds.constant,
                        codename: ensureCodenameValue(constant.codename),
                        data_type: constant.dataType,
                        presentation: constant.presentation ?? { name: {} },
                        validation_rules: constant.validationRules ?? {},
                        ui_config: constant.uiConfig ?? {},
                        value_json: toJsonbValue(constant.value),
                        sort_order: constant.sortOrder ?? 0,
                        _upl_created_at: now,
                        _upl_created_by: userId,
                        _upl_updated_at: now,
                        _upl_updated_by: userId,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _mhb_published: false,
                        _mhb_archived: false,
                        _mhb_deleted: false
                    })
                    .returning('id')

                sharedEntityIdMaps.constant.set(constant.id, inserted.id)
            }
        }

        if (sharedContainerIds.value) {
            for (const value of sharedEnumerationValues) {
                const [inserted] = await qb
                    .withSchema(this.schemaName)
                    .into('_mhb_values')
                    .insert({
                        object_id: sharedContainerIds.value,
                        codename: ensureCodenameValue(value.codename),
                        presentation: value.presentation ?? { name: {}, description: {} },
                        sort_order: value.sortOrder ?? 0,
                        is_default: value.isDefault ?? false,
                        _upl_created_at: now,
                        _upl_created_by: userId,
                        _upl_updated_at: now,
                        _upl_updated_by: userId,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _mhb_published: false,
                        _mhb_archived: false,
                        _mhb_deleted: false
                    })
                    .returning('id')

                sharedEntityIdMaps.value.set(value.id, inserted.id)
            }
        }

        return sharedEntityIdMaps
    }

    private async restoreSharedEntityOverrides(
        qb: Knex.Transaction,
        snapshot: MetahubSnapshot,
        entityIdMap: Map<string, string>,
        sharedEntityIdMaps: SharedEntityIdMaps,
        userId: string
    ): Promise<void> {
        const overrides = snapshot.sharedEntityOverrides ?? []
        if (!overrides.length) {
            return
        }

        const now = new Date()

        for (const override of overrides) {
            const newTargetObjectId = entityIdMap.get(override.targetObjectId) ?? null
            const newSharedEntityId = sharedEntityIdMaps[override.entityKind].get(override.sharedEntityId) ?? null

            if (!newTargetObjectId || !newSharedEntityId) {
                log.warn(`Shared override ${override.id} has unresolved references, skipping restore (entityKind=${override.entityKind})`)
                continue
            }

            await qb
                .withSchema(this.schemaName)
                .into('_mhb_shared_entity_overrides')
                .insert({
                    entity_kind: override.entityKind,
                    shared_entity_id: newSharedEntityId,
                    target_object_id: newTargetObjectId,
                    is_excluded: override.isExcluded === true,
                    is_active: typeof override.isActive === 'boolean' ? override.isActive : null,
                    sort_order: typeof override.sortOrder === 'number' ? override.sortOrder : null,
                    _upl_created_at: now,
                    _upl_created_by: userId,
                    _upl_updated_at: now,
                    _upl_updated_by: userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: false,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
        }
    }

    // ── Pass 1: Entities + system components ──────────────────────────────

    private async restoreEntities(qb: Knex.Transaction, snapshot: MetahubSnapshot, userId: string): Promise<Map<string, string>> {
        const entityIdMap = new Map<string, string>()
        const now = new Date()
        const entities = snapshot.entities ?? {}

        const needsSystemComponentSeed = Object.entries(entities).some(
            ([oldId, entity]) => entity.kind === 'object' || Boolean(snapshot.systemFields?.[oldId])
        )
        const platformPolicy = needsSystemComponentSeed ? await readPlatformSystemComponentsPolicyWithKnex(qb) : undefined

        // Sort: hubs first (they may be referenced by objects/sets/enumerations via config.hubs)
        const sortedEntries = Object.entries(entities).sort(([, a], [, b]) => {
            const kindOrder: Record<string, number> = { hub: 0, object: 1, set: 2, enumeration: 3 }
            return (kindOrder[a.kind] ?? 99) - (kindOrder[b.kind] ?? 99)
        })

        for (const [oldId, entity] of sortedEntries) {
            const config = this.buildEntityConfig(entity, entityIdMap, snapshot.entityTypeDefinitions)

            const [inserted] = await qb
                .withSchema(this.schemaName)
                .into('_mhb_objects')
                .insert({
                    kind: entity.kind,
                    codename: ensureCodenameValue(entity.codename),
                    table_name: entity.tableName ?? entity.physicalTableName ?? null,
                    presentation: entity.presentation ?? { name: {}, description: {} },
                    config,
                    _upl_created_at: now,
                    _upl_created_by: userId,
                    _upl_updated_at: now,
                    _upl_updated_by: userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: false,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
                .returning('id')

            entityIdMap.set(oldId, inserted.id)

            const systemFieldsSnap = snapshot.systemFields?.[oldId]
            const shouldSeedSystemComponents = entity.kind === 'object' || Boolean(systemFieldsSnap)
            if (shouldSeedSystemComponents) {
                await ensureObjectSystemComponentsSeed(qb, this.schemaName, inserted.id, userId, {
                    states: systemFieldsSnap?.fields,
                    policy: platformPolicy
                })
            }
        }

        return entityIdMap
    }

    /**
     * Build entity config JSONB, remapping hub references (old ID → new ID).
     */
    private buildEntityConfig(
        entity: MetaEntitySnapshot,
        entityIdMap: Map<string, string>,
        entityTypeDefinitions?: Record<string, MetahubEntityTypeDefinitionSnapshot>
    ): Record<string, unknown> {
        const config: Record<string, unknown> = { ...(entity.config ?? {}) }
        const entityCodenameText = getEntityCodenameText(entity.codename)

        if (Object.prototype.hasOwnProperty.call(config, 'blockContent')) {
            const definition = entityTypeDefinitions?.[entity.kind]
            const blockContentComponent = definition?.capabilities?.blockContent

            if (!isEnabledCapabilityConfig(blockContentComponent)) {
                throw new MetahubValidationError('Block content is not enabled for imported entity type', {
                    kind: entity.kind,
                    codename: entityCodenameText,
                    field: 'config.blockContent'
                })
            }

            try {
                config.blockContent = normalizePageBlockContentForStorage(
                    config.blockContent,
                    buildPageBlockContentValidationOptions(blockContentComponent)
                )
            } catch (error) {
                throw new MetahubValidationError('Invalid imported page block content', {
                    kind: entity.kind,
                    codename: entityCodenameText,
                    field: 'config.blockContent',
                    issues: error instanceof Error ? error.message : error
                })
            }
        }

        if (Object.prototype.hasOwnProperty.call(config, 'ledger')) {
            const definition = entityTypeDefinitions?.[entity.kind]
            if (!definition || !supportsLedgerSchema(definition.capabilities)) {
                throw new MetahubValidationError('Ledger schema config is not enabled for imported entity type', {
                    kind: entity.kind,
                    codename: entityCodenameText,
                    field: 'config.ledger'
                })
            }

            const referenceErrors = validateLedgerConfigReferences({
                config: normalizeLedgerConfigFromConfig(config),
                fields: (entity.fields ?? []).map((field) => ({
                    codename: getFieldCodenameText(field.codename),
                    dataType: field.dataType
                }))
            })

            if (referenceErrors.length > 0) {
                throw new MetahubValidationError('Ledger schema config contains invalid field references', {
                    kind: entity.kind,
                    codename: entityCodenameText,
                    field: 'config.ledger',
                    errors: referenceErrors
                })
            }
        }

        // Remap hub references
        if (Array.isArray(entity.hubs) && entity.hubs.length > 0) {
            const mappedHubs: string[] = []
            for (const oldTreeEntityId of entity.hubs) {
                const newTreeEntityId = entityIdMap.get(oldTreeEntityId)
                if (newTreeEntityId) {
                    mappedHubs.push(newTreeEntityId)
                } else {
                    log.warn(
                        `Hub reference ${oldTreeEntityId} not found in entityIdMap for entity codename=${entityCodenameText}, dropping reference`
                    )
                }
            }
            config.hubs = mappedHubs
        }

        return config
    }

    // ── Pass 2: Constants ─────────────────────────────────────────────────

    private async restoreConstants(
        qb: Knex.Transaction,
        snapshot: MetahubSnapshot,
        entityIdMap: Map<string, string>,
        userId: string
    ): Promise<Map<string, string>> {
        const constantIdMap = new Map<string, string>()
        const constants = snapshot.fixedValues ?? {}
        const now = new Date()

        for (const [oldEntityId, entityFixedValues] of Object.entries(constants)) {
            const newEntityId = entityIdMap.get(oldEntityId)
            if (!newEntityId) {
                log.warn(`Entity ${oldEntityId} not found in entityIdMap, skipping constants`)
                continue
            }

            for (const constant of entityFixedValues) {
                const [inserted] = await qb
                    .withSchema(this.schemaName)
                    .into('_mhb_constants')
                    .insert({
                        object_id: newEntityId,
                        codename: ensureCodenameValue(constant.codename),
                        data_type: constant.dataType,
                        presentation: constant.presentation ?? { name: {} },
                        validation_rules: constant.validationRules ?? {},
                        ui_config: constant.uiConfig ?? {},
                        value_json: toJsonbValue(constant.value),
                        sort_order: constant.sortOrder ?? 0,
                        _upl_created_at: now,
                        _upl_created_by: userId,
                        _upl_updated_at: now,
                        _upl_updated_by: userId,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _mhb_published: false,
                        _mhb_archived: false,
                        _mhb_deleted: false
                    })
                    .returning('id')

                constantIdMap.set(constant.id, inserted.id)
            }
        }

        return constantIdMap
    }

    // ── Pass 3a: Components + children ────────────────────────────────────

    private async restoreComponents(
        qb: Knex.Transaction,
        snapshot: MetahubSnapshot,
        entityIdMap: Map<string, string>,
        constantIdMap: Map<string, string>,
        userId: string
    ): Promise<Map<string, string>> {
        const entities = snapshot.entities ?? {}
        const now = new Date()
        const componentIdMap = new Map<string, string>()

        for (const [oldEntityId, entity] of Object.entries(entities)) {
            const newEntityId = entityIdMap.get(oldEntityId)
            if (!newEntityId || !entity.fields?.length) continue

            for (const field of entity.fields) {
                const parentId = await this.insertComponent(
                    qb,
                    newEntityId,
                    null,
                    field,
                    entityIdMap,
                    constantIdMap,
                    componentIdMap,
                    userId,
                    now
                )

                // Insert child components for TABLE data type
                if (field.dataType === 'TABLE' && field.childFields?.length && parentId) {
                    for (const child of field.childFields) {
                        await this.insertComponent(
                            qb,
                            newEntityId,
                            parentId,
                            child as MetaFieldSnapshot,
                            entityIdMap,
                            constantIdMap,
                            componentIdMap,
                            userId,
                            now
                        )
                    }
                }
            }
        }

        return componentIdMap
    }

    private async insertComponent(
        qb: Knex.Transaction,
        objectId: string,
        parentComponentId: string | null,
        field: MetaFieldSnapshot,
        entityIdMap: Map<string, string>,
        constantIdMap: Map<string, string>,
        componentIdMap: Map<string, string>,
        userId: string,
        now: Date
    ): Promise<string | null> {
        const targetObjectId = field.targetEntityId ? entityIdMap.get(field.targetEntityId) ?? null : null

        if (field.targetEntityId && !targetObjectId) {
            log.warn(
                `Cross-reference target entity ${field.targetEntityId} not found in entityIdMap for field codename=${field.codename}, nullifying reference`
            )
        }

        const targetConstantId = field.targetConstantId ? constantIdMap.get(field.targetConstantId) ?? null : null

        if (field.targetConstantId && !targetConstantId) {
            log.warn(
                `Cross-reference target constant ${field.targetConstantId} not found in constantIdMap for field codename=${field.codename}, nullifying reference`
            )
        }

        const [inserted] = await qb
            .withSchema(this.schemaName)
            .into('_mhb_components')
            .insert({
                object_id: objectId,
                parent_component_id: parentComponentId,
                codename: ensureCodenameValue(field.codename),
                data_type: field.dataType,
                presentation: field.presentation ?? { name: {}, description: {} },
                validation_rules: field.validationRules ?? {},
                ui_config: field.uiConfig ?? {},
                sort_order: field.sortOrder ?? 0,
                is_required: field.isRequired ?? false,
                is_display_component: field.isDisplayComponent ?? false,
                target_object_id: targetObjectId,
                target_object_kind: field.targetEntityKind ?? null,
                target_constant_id: targetConstantId,
                _upl_created_at: now,
                _upl_created_by: userId,
                _upl_updated_at: now,
                _upl_updated_by: userId,
                _upl_version: 1,
                _upl_archived: false,
                _upl_deleted: false,
                _upl_locked: false,
                _mhb_published: false,
                _mhb_archived: false,
                _mhb_deleted: false
            })
            .returning('id')

        const insertedId = inserted?.id ?? null
        if (insertedId && typeof field.id === 'string' && field.id.length > 0) {
            componentIdMap.set(field.id, insertedId)
        }

        return insertedId
    }

    // ── Pass 3b: Enumeration values ───────────────────────────────────────

    private async restoreEnumerationValues(
        qb: Knex.Transaction,
        snapshot: MetahubSnapshot,
        entityIdMap: Map<string, string>,
        userId: string
    ): Promise<void> {
        const optionValues = snapshot.optionValues ?? {}
        const now = new Date()

        for (const [oldEntityId, values] of Object.entries(optionValues)) {
            const newEntityId = entityIdMap.get(oldEntityId)
            if (!newEntityId) {
                log.warn(`Entity ${oldEntityId} not found in entityIdMap, skipping enum values`)
                continue
            }

            for (const value of values) {
                await qb
                    .withSchema(this.schemaName)
                    .into('_mhb_values')
                    .insert({
                        id: typeof value.id === 'string' && value.id.length > 0 ? value.id : undefined,
                        object_id: newEntityId,
                        codename: ensureCodenameValue(value.codename),
                        presentation: value.presentation ?? { name: {}, description: {} },
                        sort_order: value.sortOrder ?? 0,
                        is_default: value.isDefault ?? false,
                        _upl_created_at: now,
                        _upl_created_by: userId,
                        _upl_updated_at: now,
                        _upl_updated_by: userId,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _mhb_published: false,
                        _mhb_archived: false,
                        _mhb_deleted: false
                    })
            }
        }
    }

    // ── Pass 3c: Elements ─────────────────────────────────────────────────

    private async restoreElements(
        qb: Knex.Transaction,
        snapshot: MetahubSnapshot,
        entityIdMap: Map<string, string>,
        userId: string
    ): Promise<void> {
        const elements = snapshot.elements ?? {}
        const now = new Date()

        for (const [oldEntityId, entityElements] of Object.entries(elements)) {
            const newEntityId = entityIdMap.get(oldEntityId)
            if (!newEntityId) {
                log.warn(`Entity ${oldEntityId} not found in entityIdMap, skipping elements`)
                continue
            }

            for (const element of entityElements) {
                await qb
                    .withSchema(this.schemaName)
                    .into('_mhb_elements')
                    .insert({
                        id: typeof element.id === 'string' && element.id.length > 0 ? element.id : undefined,
                        object_id: newEntityId,
                        data: element.data ?? {},
                        sort_order: element.sortOrder ?? 0,
                        owner_id: null,
                        _upl_created_at: now,
                        _upl_created_by: userId,
                        _upl_updated_at: now,
                        _upl_updated_by: userId,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _mhb_published: false,
                        _mhb_archived: false,
                        _mhb_deleted: false
                    })
            }
        }
    }

    // ── Pass 3d: Scripts ──────────────────────────────────────────────────

    private async restoreScripts(
        qb: Knex.Transaction,
        metahubId: string,
        snapshot: MetahubSnapshot,
        entityIdMap: Map<string, string>,
        componentIdMap: Map<string, string>,
        userId: string
    ): Promise<Map<string, string>> {
        const scripts = (snapshot.scripts ?? []) as SnapshotScript[]
        const now = new Date()
        const scriptIdMap = new Map<string, string>()

        await qb.withSchema(this.schemaName).from('_mhb_scripts').del()

        if (!scripts.length) return scriptIdMap

        for (const script of scripts) {
            const attachedToId = this.resolveScriptAttachmentId(script, metahubId, entityIdMap, componentIdMap)
            const scriptCodenameText = getScriptCodenameText(script.codename)

            if (script.attachedToKind !== 'metahub' && !attachedToId) {
                log.warn(
                    `Script attachment ${script.attachedToKind}:${
                        script.attachedToId ?? '[null]'
                    } not found during snapshot restore, skipping script ${scriptCodenameText}`
                )
                continue
            }

            const [inserted] = await qb
                .withSchema(this.schemaName)
                .into('_mhb_scripts')
                .insert({
                    codename: ensureCodenameValue(script.codename),
                    presentation: script.presentation ?? { name: {} },
                    attached_to_kind: script.attachedToKind,
                    attached_to_id: attachedToId,
                    module_role: script.moduleRole,
                    source_kind: script.sourceKind,
                    sdk_api_version: script.sdkApiVersion,
                    source_code: this.resolveScriptSourceCode(script),
                    manifest: script.manifest ?? {},
                    server_bundle: script.serverBundle ?? null,
                    client_bundle: script.clientBundle ?? null,
                    checksum: script.checksum,
                    is_active: script.isActive !== false,
                    config: script.config ?? {},
                    _upl_created_at: now,
                    _upl_created_by: userId,
                    _upl_updated_at: now,
                    _upl_updated_by: userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: true,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
                .returning('id')

            if (typeof script.id === 'string' && inserted?.id) {
                scriptIdMap.set(script.id, inserted.id)
            }
        }

        return scriptIdMap
    }

    private async restoreActions(
        qb: Knex.Transaction,
        snapshot: MetahubSnapshot,
        entityIdMap: Map<string, string>,
        scriptIdMap: Map<string, string>,
        userId: string
    ): Promise<Map<string, string>> {
        const actionIdMap = new Map<string, string>()
        const now = new Date()

        for (const [oldEntityId, entity] of Object.entries(snapshot.entities ?? {})) {
            const actions = entity.actions ?? []
            if (!actions.length) {
                continue
            }

            const newEntityId = entityIdMap.get(oldEntityId)
            if (!newEntityId) {
                log.warn(`Entity ${oldEntityId} not found in entityIdMap, skipping actions`)
                continue
            }

            for (const action of actions) {
                const scriptId = action.scriptId ? scriptIdMap.get(action.scriptId) ?? null : null
                if (action.actionType === 'script' && action.scriptId && !scriptId) {
                    log.warn(`Action ${action.id} references missing script ${action.scriptId}, skipping restore`)
                    continue
                }

                const [inserted] = await qb
                    .withSchema(this.schemaName)
                    .into('_mhb_actions')
                    .insert({
                        object_id: newEntityId,
                        codename: ensureCodenameValue(action.codename),
                        presentation: action.presentation ?? {},
                        action_type: action.actionType,
                        script_id: scriptId,
                        config: action.config ?? {},
                        sort_order: action.sortOrder ?? 0,
                        _upl_created_at: now,
                        _upl_created_by: userId,
                        _upl_updated_at: now,
                        _upl_updated_by: userId,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _mhb_published: false,
                        _mhb_archived: false,
                        _mhb_deleted: false
                    })
                    .returning('id')

                if (inserted?.id) {
                    actionIdMap.set(action.id, inserted.id)
                }
            }
        }

        return actionIdMap
    }

    private async restoreEventBindings(
        qb: Knex.Transaction,
        snapshot: MetahubSnapshot,
        entityIdMap: Map<string, string>,
        actionIdMap: Map<string, string>,
        userId: string
    ): Promise<void> {
        const now = new Date()

        for (const [oldEntityId, entity] of Object.entries(snapshot.entities ?? {})) {
            const eventBindings = entity.eventBindings ?? []
            if (!eventBindings.length) {
                continue
            }

            const newEntityId = entityIdMap.get(oldEntityId)
            if (!newEntityId) {
                log.warn(`Entity ${oldEntityId} not found in entityIdMap, skipping event bindings`)
                continue
            }

            for (const binding of eventBindings) {
                const newActionId = actionIdMap.get(binding.actionId)
                if (!newActionId) {
                    log.warn(`Event binding ${binding.id} references missing action ${binding.actionId}, skipping restore`)
                    continue
                }

                await qb
                    .withSchema(this.schemaName)
                    .into('_mhb_event_bindings')
                    .insert({
                        object_id: newEntityId,
                        event_name: binding.eventName,
                        action_id: newActionId,
                        priority: binding.priority ?? 0,
                        is_active: binding.isActive !== false,
                        config: binding.config ?? {},
                        _upl_created_at: now,
                        _upl_created_by: userId,
                        _upl_updated_at: now,
                        _upl_updated_by: userId,
                        _upl_version: 1,
                        _upl_archived: false,
                        _upl_deleted: false,
                        _upl_locked: false,
                        _mhb_published: false,
                        _mhb_archived: false,
                        _mhb_deleted: false
                    })
            }
        }
    }

    private resolveScriptAttachmentId(
        script: SnapshotScript,
        metahubId: string,
        entityIdMap: Map<string, string>,
        componentIdMap: Map<string, string>
    ): string | null {
        if (script.attachedToKind === 'metahub') {
            return null
        }

        if (typeof script.attachedToId !== 'string' || script.attachedToId.length === 0) {
            return null
        }

        if (script.attachedToKind === 'component') {
            return componentIdMap.get(script.attachedToId) ?? null
        }

        if (script.attachedToId === metahubId) {
            return null
        }

        return entityIdMap.get(script.attachedToId) ?? null
    }

    private resolveScriptSourceCode(script: SnapshotScript): string {
        if (typeof script.sourceCode === 'string' && script.sourceCode.trim().length > 0) {
            return script.sourceCode
        }

        const normalizedCodename = getScriptCodenameText(script.codename).replace(/[^a-zA-Z0-9]/g, '_') || 'ImportedSnapshotScript'

        return [
            '// Imported from metahub snapshot.',
            '// Original authoring source was not embedded in this snapshot export.',
            "import { ExtensionScript } from '@universo/extension-sdk'",
            '',
            `export default class ${normalizedCodename}ImportedSnapshot extends ExtensionScript {}`
        ].join('\n')
    }

    // ── Final pass: Layouts + zone widgets ────────────────────────────────

    private async restoreLayouts(
        qb: Knex.Transaction,
        snapshot: MetahubSnapshot,
        entityIdMap: Map<string, string>,
        userId: string
    ): Promise<void> {
        const layouts = snapshot.layouts ?? []
        const scopedLayouts = snapshot.scopedLayouts ?? []
        const overrides = snapshot.layoutWidgetOverrides ?? []
        const widgetTableName = await resolveWidgetTableName(qb, this.schemaName)

        // Fresh branch initialization seeds a default dashboard layout. Snapshot import
        // must replace that template seed with the snapshot's canonical layout set.
        await qb.withSchema(this.schemaName).from(widgetTableName).del()
        await qb.withSchema(this.schemaName).from('_mhb_layout_widget_overrides').del()
        await qb.withSchema(this.schemaName).from('_mhb_layouts').del()

        if (!layouts.length && !scopedLayouts.length) return

        const now = new Date()
        const layoutIdMap = new Map<string, string>() // old layout id → new layout id
        const widgetIdMap = new Map<string, string>() // old widget id → new widget id

        for (const layout of layouts) {
            const [inserted] = await qb
                .withSchema(this.schemaName)
                .into('_mhb_layouts')
                .insert({
                    scope_entity_id: null,
                    base_layout_id: null,
                    template_key: layout.templateKey ?? 'dashboard',
                    name: layout.name ?? {},
                    description: layout.description ?? null,
                    config: layout.config ?? {},
                    is_active: layout.isActive !== false,
                    is_default: layout.isDefault ?? false,
                    sort_order: layout.sortOrder ?? 0,
                    owner_id: null,
                    _upl_created_at: now,
                    _upl_created_by: userId,
                    _upl_updated_at: now,
                    _upl_updated_by: userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: false,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
                .returning('id')

            layoutIdMap.set(layout.id, inserted.id)
        }

        for (const layout of scopedLayouts) {
            const newScopeEntityId = entityIdMap.get(layout.scopeEntityId)
            const newBaseLayoutId = layoutIdMap.get(layout.baseLayoutId)

            if (!newScopeEntityId || !newBaseLayoutId) {
                log.warn(`Scoped layout ${layout.id} has unresolved references, skipping restore`)
                continue
            }

            const [inserted] = await qb
                .withSchema(this.schemaName)
                .into('_mhb_layouts')
                .insert({
                    scope_entity_id: newScopeEntityId,
                    base_layout_id: newBaseLayoutId,
                    template_key: layout.templateKey ?? 'dashboard',
                    name: layout.name ?? {},
                    description: layout.description ?? null,
                    config: layout.config ?? {},
                    is_active: layout.isActive !== false,
                    is_default: layout.isDefault ?? false,
                    sort_order: layout.sortOrder ?? 0,
                    owner_id: null,
                    _upl_created_at: now,
                    _upl_created_by: userId,
                    _upl_updated_at: now,
                    _upl_updated_by: userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: false,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
                .returning('id')

            layoutIdMap.set(layout.id, inserted.id)
        }

        const widgets = snapshot.layoutZoneWidgets
        if (!widgets?.length) return

        for (const widget of widgets) {
            const newLayoutId = layoutIdMap.get(widget.layoutId)
            if (!newLayoutId) {
                log.warn(`Layout ${widget.layoutId} not found in layoutIdMap, skipping widget`)
                continue
            }

            const [inserted] = await qb
                .withSchema(this.schemaName)
                .into(widgetTableName)
                .insert({
                    layout_id: newLayoutId,
                    zone: widget.zone,
                    widget_key: widget.widgetKey,
                    sort_order: widget.sortOrder ?? 0,
                    config: widget.config ?? {},
                    is_active: widget.isActive !== false,
                    _upl_created_at: now,
                    _upl_created_by: userId,
                    _upl_updated_at: now,
                    _upl_updated_by: userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: false,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
                .returning('id')

            widgetIdMap.set(widget.id, inserted.id)
        }

        if (!overrides.length) return

        for (const override of overrides) {
            const newScopedLayoutId = layoutIdMap.get(override.layoutId)
            const newBaseWidgetId = widgetIdMap.get(override.baseWidgetId)

            if (!newScopedLayoutId || !newBaseWidgetId) {
                log.warn(`Layout widget override ${override.id} has unresolved references, skipping restore`)
                continue
            }

            await qb
                .withSchema(this.schemaName)
                .into('_mhb_layout_widget_overrides')
                .insert({
                    layout_id: newScopedLayoutId,
                    base_widget_id: newBaseWidgetId,
                    zone: override.zone ?? null,
                    sort_order: override.sortOrder ?? null,
                    config: override.config ?? null,
                    is_active: typeof override.isActive === 'boolean' ? override.isActive : null,
                    is_deleted_override: override.isDeletedOverride === true,
                    _upl_created_at: now,
                    _upl_created_by: userId,
                    _upl_updated_at: now,
                    _upl_updated_by: userId,
                    _upl_version: 1,
                    _upl_archived: false,
                    _upl_deleted: false,
                    _upl_locked: false,
                    _mhb_published: false,
                    _mhb_archived: false,
                    _mhb_deleted: false
                })
        }
    }
}
