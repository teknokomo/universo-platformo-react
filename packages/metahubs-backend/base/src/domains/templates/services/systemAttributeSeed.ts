import type { Knex } from 'knex'
import type { CatalogSystemFieldState, PlatformSystemAttributesPolicy } from '@universo/types'
import { DEFAULT_PLATFORM_SYSTEM_ATTRIBUTES_POLICY, PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS } from '@universo/types'
import { activeAppRowCondition } from '@universo/utils'
import { getCatalogSystemAttributeSeedRecords } from '@universo/utils/database'
import {
    resolveCatalogSystemAttributeSeedPlan,
    resolvePlatformSystemAttributesPolicyRows
} from '../../shared/platformSystemAttributesPolicy'
import { ensureCodenameValue } from '../../shared/codename'

export interface EnsureCatalogSystemAttributesResult {
    inserted: number
    updated: number
}

export interface EnsureCatalogSystemAttributesSeedOptions {
    states?: CatalogSystemFieldState[]
    policy?: PlatformSystemAttributesPolicy
}

type PlatformPolicyRow = {
    key: string
    value?: Record<string, unknown> | null
}

export async function readPlatformSystemAttributesPolicyWithKnex(qb: Knex): Promise<PlatformSystemAttributesPolicy> {
    const rows = await qb
        .withSchema('admin')
        .from('cfg_settings')
        .where({ category: 'metahubs' })
        .whereIn('key', Object.values(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS))
        .whereRaw(activeAppRowCondition())
        .select<PlatformPolicyRow[]>(['key', 'value'])

    return resolvePlatformSystemAttributesPolicyRows(rows)
}

export async function ensureCatalogSystemAttributesSeed(
    qb: Knex,
    schemaName: string,
    catalogId: string,
    actorId: string | null = null,
    options?: EnsureCatalogSystemAttributesSeedOptions
): Promise<EnsureCatalogSystemAttributesResult> {
    const now = new Date()
    const existingRows = await qb
        .withSchema(schemaName)
        .from('_mhb_attributes')
        .where({ object_id: catalogId, is_system: true, _upl_deleted: false, _mhb_deleted: false })
        .select(['id', 'system_key'])

    const existingByKey = new Map<string, { id: string }>()
    for (const row of existingRows) {
        if (typeof row.system_key === 'string') {
            existingByKey.set(row.system_key, { id: row.id })
        }
    }

    const seedPlan = resolveCatalogSystemAttributeSeedPlan(
        options?.states,
        options?.policy ?? DEFAULT_PLATFORM_SYSTEM_ATTRIBUTES_POLICY,
        existingByKey.keys()
    )
    const forceStateKeySet = new Set(seedPlan.forceStateKeys)

    let inserted = 0
    let updated = 0

    for (const seed of getCatalogSystemAttributeSeedRecords(seedPlan.states).filter((record) => seedPlan.allowedKeys.has(record.key))) {
        const existing = existingByKey.get(seed.key)

        if (existing) {
            await qb
                .withSchema(schemaName)
                .from('_mhb_attributes')
                .where({ id: existing.id })
                .update({
                    codename: ensureCodenameValue(seed.codename),
                    data_type: seed.dataType,
                    presentation: seed.presentation,
                    sort_order: seed.sortOrder,
                    is_system: seed.isSystem,
                    system_key: seed.key,
                    is_system_managed: seed.isSystemManaged,
                    is_system_enabled: forceStateKeySet.has(seed.key)
                        ? seed.isSystemEnabled
                        : qb.raw('COALESCE(is_system_enabled, ?)', [seed.isSystemEnabled]),
                    _upl_updated_at: now,
                    _upl_updated_by: actorId
                })
            updated += 1
            continue
        }

        await qb
            .withSchema(schemaName)
            .into('_mhb_attributes')
            .insert({
                object_id: catalogId,
                codename: ensureCodenameValue(seed.codename),
                data_type: seed.dataType,
                presentation: seed.presentation,
                validation_rules: {},
                ui_config: {},
                sort_order: seed.sortOrder,
                is_required: false,
                is_display_attribute: false,
                target_object_id: null,
                target_object_kind: null,
                target_constant_id: null,
                parent_attribute_id: null,
                is_system: seed.isSystem,
                system_key: seed.key,
                is_system_managed: seed.isSystemManaged,
                is_system_enabled: seed.isSystemEnabled,
                _upl_created_at: now,
                _upl_created_by: actorId,
                _upl_updated_at: now,
                _upl_updated_by: actorId,
                _upl_version: 1,
                _upl_archived: false,
                _upl_deleted: false,
                _upl_locked: false,
                _mhb_published: true,
                _mhb_archived: false,
                _mhb_deleted: false
            })
        inserted += 1
    }

    return { inserted, updated }
}
