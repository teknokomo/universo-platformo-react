import type { ObjectSystemFieldKey, ObjectSystemFieldState, PlatformSystemComponentsPolicy } from '@universo/types'
import { DEFAULT_PLATFORM_SYSTEM_COMPONENTS_POLICY, PLATFORM_SYSTEM_COMPONENT_ADMIN_KEYS } from '@universo/types'
import { activeAppRowCondition, getObjectSystemComponent, getObjectSystemComponents } from '@universo/utils'

type Queryable = {
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
}

type AdminSettingRow = {
    key: string
    value?: Record<string, unknown> | null
}

export interface ObjectSystemComponentSeedPlan {
    states?: ObjectSystemFieldState[]
    allowedKeys: Set<ObjectSystemFieldKey>
    forceStateKeys: ObjectSystemFieldKey[]
}

const PLATFORM_POLICY_KEYS = Object.values(PLATFORM_SYSTEM_COMPONENT_ADMIN_KEYS)

const LEGACY_PLATFORM_SYSTEM_COMPONENTS_POLICY: PlatformSystemComponentsPolicy = {
    allowConfiguration: true,
    forceCreate: true,
    ignoreMetahubSettings: false
}

const extractBooleanValue = (row: AdminSettingRow | undefined, fallback: boolean): boolean => {
    const value = row?.value?._value
    return typeof value === 'boolean' ? value : fallback
}

export function resolvePlatformSystemComponentsPolicyRows(
    rows: Iterable<AdminSettingRow> | null | undefined
): PlatformSystemComponentsPolicy {
    const rowMap = new Map(Array.from(rows ?? []).map((row) => [row.key, row]))

    return {
        allowConfiguration: extractBooleanValue(
            rowMap.get(PLATFORM_SYSTEM_COMPONENT_ADMIN_KEYS.allowConfiguration),
            DEFAULT_PLATFORM_SYSTEM_COMPONENTS_POLICY.allowConfiguration
        ),
        forceCreate: extractBooleanValue(
            rowMap.get(PLATFORM_SYSTEM_COMPONENT_ADMIN_KEYS.forceCreate),
            DEFAULT_PLATFORM_SYSTEM_COMPONENTS_POLICY.forceCreate
        ),
        ignoreMetahubSettings: extractBooleanValue(
            rowMap.get(PLATFORM_SYSTEM_COMPONENT_ADMIN_KEYS.ignoreMetahubSettings),
            DEFAULT_PLATFORM_SYSTEM_COMPONENTS_POLICY.ignoreMetahubSettings
        )
    }
}

export const isPlatformSystemFieldKey = (key: ObjectSystemFieldKey | null | undefined): boolean => {
    if (!key) return false
    return getObjectSystemComponent(key)?.layer === 'upl'
}

export const shouldExposeObjectSystemComponent = (
    key: ObjectSystemFieldKey | null | undefined,
    policy: PlatformSystemComponentsPolicy
): boolean => {
    if (!isPlatformSystemFieldKey(key)) {
        return true
    }
    return policy.allowConfiguration
}

export const getPlatformSystemComponentMutationBlockReason = (
    key: ObjectSystemFieldKey | null | undefined,
    policy: PlatformSystemComponentsPolicy
): string | null => {
    if (!isPlatformSystemFieldKey(key)) {
        return null
    }

    if (!policy.allowConfiguration) {
        return `Platform system component ${key} cannot be changed while platform system component configuration is disabled`
    }

    return null
}

export async function readPlatformSystemComponentsPolicy(exec: Queryable): Promise<PlatformSystemComponentsPolicy> {
    const rows = await exec.query<AdminSettingRow>(
        `SELECT key, value
         FROM admin.cfg_settings
         WHERE category = $1
           AND key = ANY($2::text[])
           AND ${activeAppRowCondition()}`,
        ['metahubs', PLATFORM_POLICY_KEYS]
    )

    return resolvePlatformSystemComponentsPolicyRows(rows)
}

export function resolveObjectSystemComponentSeedPlan(
    states?: ObjectSystemFieldState[],
    policy: PlatformSystemComponentsPolicy = LEGACY_PLATFORM_SYSTEM_COMPONENTS_POLICY,
    existingKeys: Iterable<ObjectSystemFieldKey | string> = []
): ObjectSystemComponentSeedPlan {
    const incomingStateMap = new Map<ObjectSystemFieldKey, boolean>((states ?? []).map((state) => [state.key, Boolean(state.enabled)]))
    const existingKeySet = new Set(Array.from(existingKeys).filter((key): key is string => typeof key === 'string'))
    const allowedKeys = new Set<ObjectSystemFieldKey>()
    const forceStateKeys: ObjectSystemFieldKey[] = []
    const resolvedStates: ObjectSystemFieldState[] = []

    for (const definition of getObjectSystemComponents()) {
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
