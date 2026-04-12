import {
    getLegacyCompatibleObjectKind,
    getLegacyCompatibleObjectKindForKindKey,
    type LegacyCompatibleObjectKind,
    type ResolvedEntityType
} from '@universo/types'
import type { SqlQueryable } from '@universo/utils/database'

import type { EntityTypeService } from '../entities/services/EntityTypeService'
import { MetahubValidationError } from './domainErrors'

export type ManagedLegacyCompatibleKind = Exclude<LegacyCompatibleObjectKind, 'document'>

type CompatibleTypeLike = Pick<ResolvedEntityType, 'kindKey'> & {
    config?: Record<string, unknown> | null
}

const LEGACY_SETTINGS_PREFIX_MAP: Record<ManagedLegacyCompatibleKind, string> = {
    catalog: 'catalogs',
    hub: 'hubs',
    set: 'sets',
    enumeration: 'enumerations'
}

const normalizeKindKey = (value?: string | null): string => (typeof value === 'string' ? value.trim() : '')

export const isLegacyCompatibleEntityType = (row: CompatibleTypeLike, legacyKind: ManagedLegacyCompatibleKind): boolean =>
    getLegacyCompatibleObjectKind(row.config) === legacyKind

export const isLegacyCompatibleResolvedType = (
    row: CompatibleTypeLike | null | undefined,
    legacyKind: ManagedLegacyCompatibleKind
): boolean => Boolean(row && isLegacyCompatibleEntityType(row, legacyKind))

export const createLegacyCompatibleKindSet = (kinds: readonly string[]): Set<string> =>
    new Set(kinds.map((kind) => normalizeKindKey(kind)).filter((kind) => kind.length > 0))

export const resolveLegacyCompatibleKinds = async (
    entityTypeService: Pick<EntityTypeService, 'listCustomTypes'>,
    metahubId: string,
    legacyKind: ManagedLegacyCompatibleKind,
    userId?: string
): Promise<string[]> => {
    const customTypes = await entityTypeService.listCustomTypes(metahubId, userId)
    return [legacyKind, ...customTypes.filter((row) => isLegacyCompatibleEntityType(row, legacyKind)).map((row) => row.kindKey)]
}

export const resolveLegacyCompatibleKindsInSchema = async (
    entityTypeService: Pick<EntityTypeService, 'listCustomTypesInSchema'>,
    schemaName: string,
    legacyKind: ManagedLegacyCompatibleKind,
    db?: SqlQueryable
): Promise<string[]> => {
    const customTypes = await entityTypeService.listCustomTypesInSchema(schemaName, db)
    return [legacyKind, ...customTypes.filter((row) => isLegacyCompatibleEntityType(row, legacyKind)).map((row) => row.kindKey)]
}

export const resolveRequestedLegacyCompatibleKind = async (
    entityTypeService: Pick<EntityTypeService, 'resolveType'>,
    metahubId: string,
    legacyKind: ManagedLegacyCompatibleKind,
    requestedKindKey?: string | null,
    userId?: string
): Promise<string> => {
    const normalizedRequestedKindKey = normalizeKindKey(requestedKindKey)
    if (!normalizedRequestedKindKey) {
        return legacyKind
    }

    if (normalizedRequestedKindKey === legacyKind) {
        return legacyKind
    }

    const resolvedType = await entityTypeService.resolveType(metahubId, normalizedRequestedKindKey, userId)
    if (!resolvedType || resolvedType.source !== 'custom' || getLegacyCompatibleObjectKind(resolvedType.config) !== legacyKind) {
        throw new MetahubValidationError('Requested kindKey is not compatible with the expected legacy surface', {
            requestedKindKey: normalizedRequestedKindKey,
            legacyKind
        })
    }

    return normalizedRequestedKindKey
}

export const resolveRequestedLegacyCompatibleKinds = async (
    entityTypeService: Pick<EntityTypeService, 'listCustomTypes' | 'resolveType'>,
    metahubId: string,
    legacyKind: ManagedLegacyCompatibleKind,
    requestedKindKey?: string | null,
    userId?: string
): Promise<string[]> => {
    const normalizedRequestedKindKey = normalizeKindKey(requestedKindKey)
    if (!normalizedRequestedKindKey) {
        return resolveLegacyCompatibleKinds(entityTypeService, metahubId, legacyKind, userId)
    }

    await resolveRequestedLegacyCompatibleKind(entityTypeService, metahubId, legacyKind, normalizedRequestedKindKey, userId)
    return resolveLegacyCompatibleKinds(entityTypeService, metahubId, legacyKind, userId)
}

export const resolveStoredLegacyCompatibleKind = async (
    entityTypeService: Pick<EntityTypeService, 'resolveType'>,
    metahubId: string,
    storedKind: string | null | undefined,
    userId?: string
): Promise<ManagedLegacyCompatibleKind | null> => {
    const normalizedStoredKind = normalizeKindKey(storedKind)
    if (!normalizedStoredKind) {
        return null
    }

    if (normalizedStoredKind === 'catalog' || normalizedStoredKind === 'hub' || normalizedStoredKind === 'set' || normalizedStoredKind === 'enumeration') {
        return normalizedStoredKind
    }

    const builtinCompatibleKind = getLegacyCompatibleObjectKindForKindKey(normalizedStoredKind)
    if (builtinCompatibleKind && builtinCompatibleKind !== 'document') {
        return builtinCompatibleKind
    }

    const resolvedType = await entityTypeService.resolveType(metahubId, normalizedStoredKind, userId)
    if (!resolvedType || resolvedType.source !== 'custom') {
        return null
    }

    const resolvedLegacyKind = getLegacyCompatibleObjectKind(resolvedType.config)
    if (!resolvedLegacyKind || resolvedLegacyKind === 'document') {
        return null
    }

    return resolvedLegacyKind
}

export const isStoredLegacyCompatibleKind = async (
    entityTypeService: Pick<EntityTypeService, 'resolveType'>,
    metahubId: string,
    storedKind: string | null | undefined,
    legacyKind: ManagedLegacyCompatibleKind,
    userId?: string
): Promise<boolean> => {
    const resolvedLegacyKind = await resolveStoredLegacyCompatibleKind(entityTypeService, metahubId, storedKind, userId)
    return resolvedLegacyKind === legacyKind
}

export const resolveLegacySettingsPrefix = (resolvedType: CompatibleTypeLike | null | undefined): string | null => {
    const legacyKind = resolvedType ? getLegacyCompatibleObjectKind(resolvedType.config) : null
    if (!legacyKind || legacyKind === 'document') {
        return null
    }

    return LEGACY_SETTINGS_PREFIX_MAP[legacyKind]
}

export const resolveLegacyAclPermission = (
    resolvedType: CompatibleTypeLike,
    operation: 'write' | 'delete'
): 'editContent' | 'deleteContent' | 'manageMetahub' => {
    const settingsPrefix = resolveLegacySettingsPrefix(resolvedType)
    if (!settingsPrefix) {
        return 'manageMetahub'
    }

    return operation === 'delete' ? 'deleteContent' : 'editContent'
}