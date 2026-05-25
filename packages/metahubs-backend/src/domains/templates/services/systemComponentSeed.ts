import type { Knex } from 'knex'
import type { ObjectSystemFieldState, PlatformSystemComponentsPolicy } from '@universo/types'
import { DEFAULT_PLATFORM_SYSTEM_COMPONENTS_POLICY, PLATFORM_SYSTEM_COMPONENT_ADMIN_KEYS } from '@universo/types'
import { activeAppRowCondition } from '@universo/utils'
import { getObjectSystemComponentSeedRecords } from '@universo/utils/database'
import {
    resolveObjectSystemComponentSeedPlan,
    resolvePlatformSystemComponentsPolicyRows
} from '../../shared/platformSystemComponentsPolicy'
import { ensureCodenameValue } from '../../shared/codename'

export interface EnsureObjectSystemComponentsResult {
    inserted: number
    updated: number
}

export interface EnsureObjectSystemComponentsSeedOptions {
    states?: ObjectSystemFieldState[]
    policy?: PlatformSystemComponentsPolicy
}

type PlatformPolicyRow = {
    key: string
    value?: Record<string, unknown> | null
}

export async function readPlatformSystemComponentsPolicyWithKnex(qb: Knex): Promise<PlatformSystemComponentsPolicy> {
    const rows = await qb
        .withSchema('admin')
        .from('cfg_settings')
        .where({ category: 'metahubs' })
        .whereIn('key', Object.values(PLATFORM_SYSTEM_COMPONENT_ADMIN_KEYS))
        .whereRaw(activeAppRowCondition())
        .select<PlatformPolicyRow[]>(['key', 'value'])

    return resolvePlatformSystemComponentsPolicyRows(rows)
}

export async function ensureObjectSystemComponentsSeed(
    qb: Knex,
    schemaName: string,
    objectCollectionId: string,
    actorId: string | null = null,
    options?: EnsureObjectSystemComponentsSeedOptions
): Promise<EnsureObjectSystemComponentsResult> {
    const now = new Date()
    const existingRows = await qb
        .withSchema(schemaName)
        .from('_mhb_components')
        .where({ object_id: objectCollectionId, is_system: true, _upl_deleted: false, _mhb_deleted: false })
        .select(['id', 'system_key'])

    const existingByKey = new Map<string, { id: string }>()
    for (const row of existingRows) {
        if (typeof row.system_key === 'string') {
            existingByKey.set(row.system_key, { id: row.id })
        }
    }

    const seedPlan = resolveObjectSystemComponentSeedPlan(
        options?.states,
        options?.policy ?? DEFAULT_PLATFORM_SYSTEM_COMPONENTS_POLICY,
        existingByKey.keys()
    )
    const forceStateKeySet = new Set(seedPlan.forceStateKeys)

    let inserted = 0
    let updated = 0

    for (const seed of getObjectSystemComponentSeedRecords(seedPlan.states).filter((record) => seedPlan.allowedKeys.has(record.key))) {
        const existing = existingByKey.get(seed.key)

        if (existing) {
            await qb
                .withSchema(schemaName)
                .from('_mhb_components')
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
            .into('_mhb_components')
            .insert({
                object_id: objectCollectionId,
                codename: ensureCodenameValue(seed.codename),
                data_type: seed.dataType,
                presentation: seed.presentation,
                validation_rules: {},
                ui_config: {},
                sort_order: seed.sortOrder,
                is_required: false,
                is_display_component: false,
                target_object_id: null,
                target_object_kind: null,
                target_constant_id: null,
                parent_component_id: null,
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
