import type { Knex } from 'knex'
import type {
  CatalogSystemFieldsSnapshot,
  EnumerationValueDefinition
} from '@universo/types'
import type {
  MetahubSnapshot,
  MetaEntitySnapshot,
  MetaFieldSnapshot,
  MetaElementSnapshot,
  MetaConstantSnapshot,
  MetahubLayoutSnapshot,
  MetahubLayoutZoneWidgetSnapshot
} from '../../publications/services/SnapshotSerializer'
import { ensureCodenameValue } from '../../shared/codename'
import { toJsonbValue } from '../../shared/jsonb'
import {
  ensureCatalogSystemAttributesSeed,
  readPlatformSystemAttributesPolicyWithKnex
} from '../../templates/services/systemAttributeSeed'
import { resolveWidgetTableName } from '../../templates/services/widgetTableResolver'
import { createLogger } from '../../../utils/logger'

const log = createLogger('SnapshotRestoreService')

/**
 * Restores metahub branch schema entities from a MetahubSnapshot.
 *
 * Follows the TemplateSeedExecutor 3-pass creation order to satisfy FK constraints:
 *   Pass 1 — Entities (hubs, catalogs, sets, enumerations) + system attributes
 *   Pass 2 — Constants (for sets)
 *   Pass 3 — Attributes + children → enum values → elements
 *   Final  — Layouts + zone widgets
 *
 * All operations run within a single Knex transaction for atomicity.
 */
export class SnapshotRestoreService {
  constructor(
    private readonly knex: Knex,
    private readonly schemaName: string
  ) {}

  async restoreFromSnapshot(
    metahubId: string,
    snapshot: MetahubSnapshot,
    userId: string
  ): Promise<void> {
    await this.knex.transaction(async (trx) => {
      // oldEntityId → newEntityId
      const entityIdMap = await this.restoreEntities(trx, snapshot, userId)

      // oldConstantId → newConstantId
      const constantIdMap = await this.restoreConstants(trx, snapshot, entityIdMap, userId)

      await this.restoreAttributes(trx, snapshot, entityIdMap, constantIdMap, userId)
      await this.restoreEnumerationValues(trx, snapshot, entityIdMap, userId)
      await this.restoreElements(trx, snapshot, entityIdMap, userId)
      await this.restoreLayouts(trx, snapshot, userId)
    })
  }

  // ── Pass 1: Entities + system attributes ──────────────────────────────

  private async restoreEntities(
    qb: Knex.Transaction,
    snapshot: MetahubSnapshot,
    userId: string
  ): Promise<Map<string, string>> {
    const entityIdMap = new Map<string, string>()
    const now = new Date()
    const entities = snapshot.entities ?? {}

    // Check if we need platform system attributes policy (for catalogs)
    const hasCatalogs = Object.values(entities).some((e) => e.kind === 'catalog')
    const platformPolicy = hasCatalogs
      ? await readPlatformSystemAttributesPolicyWithKnex(qb)
      : undefined

    // Sort: hubs first (they may be referenced by catalogs/sets/enumerations via config.hubs)
    const sortedEntries = Object.entries(entities).sort(([, a], [, b]) => {
      const kindOrder: Record<string, number> = { hub: 0, catalog: 1, set: 2, enumeration: 3 }
      return (kindOrder[a.kind] ?? 99) - (kindOrder[b.kind] ?? 99)
    })

    for (const [oldId, entity] of sortedEntries) {
      const config = this.buildEntityConfig(entity, entityIdMap)

      const [inserted] = await qb
        .withSchema(this.schemaName)
        .into('_mhb_objects')
        .insert({
          kind: entity.kind,
          codename: ensureCodenameValue(entity.codename),
          table_name: null,
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

      // Seed system attributes for catalogs
      if (entity.kind === 'catalog') {
        const systemFieldsSnap = snapshot.systemFields?.[oldId]
        await ensureCatalogSystemAttributesSeed(qb, this.schemaName, inserted.id, userId, {
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
    entityIdMap: Map<string, string>
  ): Record<string, unknown> {
    const config: Record<string, unknown> = { ...(entity.config ?? {}) }

    // Remap hub references
    if (Array.isArray(entity.hubs) && entity.hubs.length > 0) {
      const mappedHubs: string[] = []
      for (const oldHubId of entity.hubs) {
        const newHubId = entityIdMap.get(oldHubId)
        if (newHubId) {
          mappedHubs.push(newHubId)
        } else {
          log.warn(`Hub reference ${oldHubId} not found in entityIdMap for entity codename=${entity.codename}, dropping reference`)
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
    const constants = snapshot.constants ?? {}
    const now = new Date()

    for (const [oldEntityId, entityConstants] of Object.entries(constants)) {
      const newEntityId = entityIdMap.get(oldEntityId)
      if (!newEntityId) {
        log.warn(`Entity ${oldEntityId} not found in entityIdMap, skipping constants`)
        continue
      }

      for (const constant of entityConstants) {
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

  // ── Pass 3a: Attributes + children ────────────────────────────────────

  private async restoreAttributes(
    qb: Knex.Transaction,
    snapshot: MetahubSnapshot,
    entityIdMap: Map<string, string>,
    constantIdMap: Map<string, string>,
    userId: string
  ): Promise<void> {
    const entities = snapshot.entities ?? {}
    const now = new Date()

    for (const [oldEntityId, entity] of Object.entries(entities)) {
      const newEntityId = entityIdMap.get(oldEntityId)
      if (!newEntityId || !entity.fields?.length) continue

      for (const field of entity.fields) {
        const parentId = await this.insertAttribute(
          qb, newEntityId, null, field, entityIdMap, constantIdMap, userId, now
        )

        // Insert child attributes for TABLE data type
        if (field.dataType === 'TABLE' && field.childFields?.length && parentId) {
          for (const child of field.childFields) {
            await this.insertAttribute(
              qb, newEntityId, parentId, child as MetaFieldSnapshot, entityIdMap, constantIdMap, userId, now
            )
          }
        }
      }
    }
  }

  private async insertAttribute(
    qb: Knex.Transaction,
    objectId: string,
    parentAttributeId: string | null,
    field: MetaFieldSnapshot,
    entityIdMap: Map<string, string>,
    constantIdMap: Map<string, string>,
    userId: string,
    now: Date
  ): Promise<string | null> {
    const targetObjectId = field.targetEntityId
      ? (entityIdMap.get(field.targetEntityId) ?? null)
      : null

    if (field.targetEntityId && !targetObjectId) {
      log.warn(`Cross-reference target entity ${field.targetEntityId} not found in entityIdMap for field codename=${field.codename}, nullifying reference`)
    }

    const targetConstantId = field.targetConstantId
      ? (constantIdMap.get(field.targetConstantId) ?? null)
      : null

    if (field.targetConstantId && !targetConstantId) {
      log.warn(`Cross-reference target constant ${field.targetConstantId} not found in constantIdMap for field codename=${field.codename}, nullifying reference`)
    }

    const [inserted] = await qb
      .withSchema(this.schemaName)
      .into('_mhb_attributes')
      .insert({
        object_id: objectId,
        parent_attribute_id: parentAttributeId,
        codename: ensureCodenameValue(field.codename),
        data_type: field.dataType,
        presentation: field.presentation ?? { name: {}, description: {} },
        validation_rules: field.validationRules ?? {},
        ui_config: field.uiConfig ?? {},
        sort_order: field.sortOrder ?? 0,
        is_required: field.isRequired ?? false,
        is_display_attribute: field.isDisplayAttribute ?? false,
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

    return inserted?.id ?? null
  }

  // ── Pass 3b: Enumeration values ───────────────────────────────────────

  private async restoreEnumerationValues(
    qb: Knex.Transaction,
    snapshot: MetahubSnapshot,
    entityIdMap: Map<string, string>,
    userId: string
  ): Promise<void> {
    const enumerationValues = snapshot.enumerationValues ?? {}
    const now = new Date()

    for (const [oldEntityId, values] of Object.entries(enumerationValues)) {
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

  // ── Final pass: Layouts + zone widgets ────────────────────────────────

  private async restoreLayouts(
    qb: Knex.Transaction,
    snapshot: MetahubSnapshot,
    userId: string
  ): Promise<void> {
    const layouts = snapshot.layouts ?? []
    const widgetTableName = await resolveWidgetTableName(qb, this.schemaName)

    // Fresh branch initialization seeds a default dashboard layout. Snapshot import
    // must replace that template seed with the snapshot's canonical layout set.
    await qb.withSchema(this.schemaName).from(widgetTableName).del()
    await qb.withSchema(this.schemaName).from('_mhb_layouts').del()

    if (!layouts.length) return

    const now = new Date()
    const layoutIdMap = new Map<string, string>() // old layout id → new layout id

    for (const layout of layouts) {
      const [inserted] = await qb
        .withSchema(this.schemaName)
        .into('_mhb_layouts')
        .insert({
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

      await qb
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
    }
  }
}
