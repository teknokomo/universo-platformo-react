import type { SharedEntityKind } from '@universo/types'
import { listSharedEntityOverridesByEntity, type SharedEntityOverride, upsertSharedEntityOverride } from './api/sharedEntityOverrides'

export const SHARED_EXCLUDED_TARGET_IDS_FIELD = '_sharedExcludedTargetIds'

export const normalizeSharedExcludedTargetIds = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return []
    }

    const seen = new Set<string>()
    const normalized: string[] = []

    for (const item of value) {
        if (typeof item !== 'string') {
            continue
        }

        const trimmed = item.trim()
        if (trimmed.length === 0 || seen.has(trimmed)) {
            continue
        }

        seen.add(trimmed)
        normalized.push(trimmed)
    }

    return normalized
}

export const readSharedExcludedTargetIdsField = (value: unknown): string[] | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return undefined
    }

    if (!Object.prototype.hasOwnProperty.call(value, SHARED_EXCLUDED_TARGET_IDS_FIELD)) {
        return undefined
    }

    return normalizeSharedExcludedTargetIds((value as Record<string, unknown>)[SHARED_EXCLUDED_TARGET_IDS_FIELD])
}

export const resolveSharedEntityExclusionChanges = (
    currentOverrides: Array<Pick<SharedEntityOverride, 'targetObjectId' | 'isExcluded'>>,
    desiredExcludedTargetIds: string[]
): Array<{ targetObjectId: string; isExcluded: boolean }> => {
    const desiredSet = new Set(normalizeSharedExcludedTargetIds(desiredExcludedTargetIds))
    const currentExcludedSet = new Set(currentOverrides.filter((item) => item.isExcluded).map((item) => item.targetObjectId))
    const targetIds = new Set<string>([...currentExcludedSet, ...desiredSet])

    return [...targetIds]
        .sort((left, right) => left.localeCompare(right))
        .flatMap((targetObjectId) => {
            const isExcluded = desiredSet.has(targetObjectId)
            const wasExcluded = currentExcludedSet.has(targetObjectId)
            if (isExcluded === wasExcluded) {
                return []
            }

            return [{ targetObjectId, isExcluded }]
        })
}

export const syncSharedEntityExclusions = async (params: {
    metahubId: string
    entityKind: SharedEntityKind
    sharedEntityId: string
    excludedTargetIds: string[]
}): Promise<void> => {
    const currentOverrides = await listSharedEntityOverridesByEntity(params.metahubId, params.entityKind, params.sharedEntityId)
    const changes = resolveSharedEntityExclusionChanges(currentOverrides, params.excludedTargetIds)

    if (changes.length === 0) {
        return
    }

    await Promise.all(
        changes.map(({ targetObjectId, isExcluded }) =>
            upsertSharedEntityOverride(params.metahubId, {
                entityKind: params.entityKind,
                sharedEntityId: params.sharedEntityId,
                targetObjectId,
                isExcluded
            })
        )
    )
}
