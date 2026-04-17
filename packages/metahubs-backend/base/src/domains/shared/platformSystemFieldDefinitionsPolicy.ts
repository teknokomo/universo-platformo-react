import type { CatalogSystemFieldKey, CatalogSystemFieldState, PlatformSystemFieldDefinitionsPolicy } from '@universo/types'
import { DEFAULT_PLATFORM_SYSTEM_FIELD_DEFINITIONS_POLICY, PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS } from '@universo/types'
import { activeAppRowCondition, getCatalogSystemFieldDefinition, getCatalogSystemFieldDefinitions } from '@universo/utils'

type Queryable = {
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
}

type AdminSettingRow = {
    key: string
    value?: Record<string, unknown> | null
}

export interface CatalogSystemFieldDefinitionSeedPlan {
    states?: CatalogSystemFieldState[]
    allowedKeys: Set<CatalogSystemFieldKey>
    forceStateKeys: CatalogSystemFieldKey[]
}

const PLATFORM_POLICY_KEYS = Object.values(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS)

const LEGACY_PLATFORM_SYSTEM_FIELD_DEFINITIONS_POLICY: PlatformSystemFieldDefinitionsPolicy = {
    allowConfiguration: true,
    forceCreate: true,
    ignoreMetahubSettings: false
}

const extractBooleanValue = (row: AdminSettingRow | undefined, fallback: boolean): boolean => {
    const value = row?.value?._value
    return typeof value === 'boolean' ? value : fallback
}

export function resolvePlatformSystemFieldDefinitionsPolicyRows(
    rows: Iterable<AdminSettingRow> | null | undefined
): PlatformSystemFieldDefinitionsPolicy {
    const rowMap = new Map(Array.from(rows ?? []).map((row) => [row.key, row]))

    return {
        allowConfiguration: extractBooleanValue(
            rowMap.get(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.allowConfiguration),
            DEFAULT_PLATFORM_SYSTEM_FIELD_DEFINITIONS_POLICY.allowConfiguration
        ),
        forceCreate: extractBooleanValue(
            rowMap.get(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.forceCreate),
            DEFAULT_PLATFORM_SYSTEM_FIELD_DEFINITIONS_POLICY.forceCreate
        ),
        ignoreMetahubSettings: extractBooleanValue(
            rowMap.get(PLATFORM_SYSTEM_ATTRIBUTE_ADMIN_KEYS.ignoreMetahubSettings),
            DEFAULT_PLATFORM_SYSTEM_FIELD_DEFINITIONS_POLICY.ignoreMetahubSettings
        )
    }
}

export const isPlatformSystemFieldKey = (key: CatalogSystemFieldKey | null | undefined): boolean => {
    if (!key) return false
    return getCatalogSystemFieldDefinition(key)?.layer === 'upl'
}

export const shouldExposeCatalogSystemField = (
    key: CatalogSystemFieldKey | null | undefined,
    policy: PlatformSystemFieldDefinitionsPolicy
): boolean => {
    if (!isPlatformSystemFieldKey(key)) {
        return true
    }
    return policy.allowConfiguration
}

export const getPlatformSystemFieldDefinitionMutationBlockReason = (
    key: CatalogSystemFieldKey | null | undefined,
    policy: PlatformSystemFieldDefinitionsPolicy
): string | null => {
    if (!isPlatformSystemFieldKey(key)) {
        return null
    }

    if (!policy.allowConfiguration) {
        return `Platform system attribute ${key} cannot be changed while platform system attribute configuration is disabled`
    }

    return null
}

export async function readPlatformSystemFieldDefinitionsPolicy(exec: Queryable): Promise<PlatformSystemFieldDefinitionsPolicy> {
    const rows = await exec.query<AdminSettingRow>(
        `SELECT key, value
         FROM admin.cfg_settings
         WHERE category = $1
           AND key = ANY($2::text[])
           AND ${activeAppRowCondition()}`,
        ['metahubs', PLATFORM_POLICY_KEYS]
    )

    return resolvePlatformSystemFieldDefinitionsPolicyRows(rows)
}

export function resolveCatalogSystemFieldDefinitionSeedPlan(
    states?: CatalogSystemFieldState[],
    policy: PlatformSystemFieldDefinitionsPolicy = LEGACY_PLATFORM_SYSTEM_FIELD_DEFINITIONS_POLICY,
    existingKeys: Iterable<CatalogSystemFieldKey | string> = []
): CatalogSystemFieldDefinitionSeedPlan {
    const incomingStateMap = new Map<CatalogSystemFieldKey, boolean>((states ?? []).map((state) => [state.key, Boolean(state.enabled)]))
    const existingKeySet = new Set(Array.from(existingKeys).filter((key): key is string => typeof key === 'string'))
    const allowedKeys = new Set<CatalogSystemFieldKey>()
    const forceStateKeys: CatalogSystemFieldKey[] = []
    const resolvedStates: CatalogSystemFieldState[] = []

    for (const definition of getCatalogSystemFieldDefinitions()) {
        if (definition.layer === 'app') {
            allowedKeys.add(definition.key)
            if (incomingStateMap.has(definition.key)) {
                resolvedStates.push({ key: definition.key, enabled: incomingStateMap.get(definition.key) === true })
            }
            continue
        }

        const hasIncomingState = incomingStateMap.has(definition.key)
        const hasExistingState = existingKeySet.has(definition.key)

        if (policy.ignoreMetahubSettings) {
            allowedKeys.add(definition.key)
            forceStateKeys.push(definition.key)
            resolvedStates.push({ key: definition.key, enabled: definition.defaultEnabled })
            continue
        }

        if (policy.forceCreate || hasIncomingState || hasExistingState) {
            allowedKeys.add(definition.key)
            if (hasIncomingState) {
                resolvedStates.push({ key: definition.key, enabled: incomingStateMap.get(definition.key) === true })
            }
        }
    }

    return {
        states: resolvedStates.length > 0 ? resolvedStates : undefined,
        allowedKeys,
        forceStateKeys
    }
}
