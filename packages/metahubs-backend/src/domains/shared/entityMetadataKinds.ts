import {
    buildEntitySurfaceSettingKey,
    isBuiltinEntityKind,
    resolveEntitySurfaceKey,
    type ResolvedEntityType,
    type BuiltinEntityKind
} from '@universo/types'

import type { EntityTypeService } from '../entities/services/EntityTypeService'
import { MetahubValidationError } from './domainErrors'

export type EntityMetadataKind = BuiltinEntityKind

type EntityMetadataTypeLike = Pick<ResolvedEntityType, 'kindKey'> & {
    config?: Record<string, unknown> | null
}

const normalizeKindKey = (value?: string | null): string => (typeof value === 'string' ? value.trim() : '')

export const getEntityMetadataKind = (kind: unknown): EntityMetadataKind | null => {
    if (typeof kind !== 'string') {
        return null
    }

    const normalizedKind = kind.trim()
    return isBuiltinEntityKind(normalizedKind) ? normalizedKind : null
}

export const createEntityMetadataKindSet = (kinds: readonly string[]): Set<string> =>
    new Set(kinds.map((kind) => normalizeKindKey(kind)).filter((kind) => kind.length > 0))

export const resolveEntityMetadataKinds = async (
    _entityTypeService: Pick<EntityTypeService, 'listEditableTypes'>,
    _metahubId: string,
    metadataKind: EntityMetadataKind,
    _userId?: string
): Promise<string[]> => [metadataKind]

export const resolveEntityMetadataKindsInSchema = async (
    _entityTypeService: Pick<EntityTypeService, 'listEditableTypesInSchema'>,
    _schemaName: string,
    metadataKind: EntityMetadataKind,
    _db?: unknown
): Promise<string[]> => [metadataKind]

export const resolveRequestedEntityMetadataKind = async (
    _entityTypeService: Pick<EntityTypeService, 'resolveType'>,
    _metahubId: string,
    metadataKind: EntityMetadataKind,
    requestedKindKey?: string | null,
    _userId?: string
): Promise<string> => {
    const normalizedRequestedKindKey = normalizeKindKey(requestedKindKey)
    if (!normalizedRequestedKindKey || normalizedRequestedKindKey === metadataKind) {
        return metadataKind
    }

    throw new MetahubValidationError('Requested kindKey is not compatible with the expected entity metadata surface', {
        requestedKindKey: normalizedRequestedKindKey,
        metadataKind
    })
}

export const resolveRequestedEntityMetadataKinds = async (
    entityTypeService: Pick<EntityTypeService, 'listEditableTypes' | 'resolveType'>,
    metahubId: string,
    metadataKind: EntityMetadataKind,
    requestedKindKey?: string | null,
    userId?: string
): Promise<string[]> => [await resolveRequestedEntityMetadataKind(entityTypeService, metahubId, metadataKind, requestedKindKey, userId)]

export const resolveStoredEntityMetadataKind = async (
    _entityTypeService: Pick<EntityTypeService, 'resolveType'>,
    _metahubId: string,
    storedKind: string | null | undefined,
    _userId?: string
): Promise<EntityMetadataKind | null> => getEntityMetadataKind(storedKind)

export const isStoredEntityMetadataKind = async (
    entityTypeService: Pick<EntityTypeService, 'resolveType'>,
    metahubId: string,
    storedKind: string | null | undefined,
    metadataKind: EntityMetadataKind,
    userId?: string
): Promise<boolean> => {
    const resolvedMetadataKind = await resolveStoredEntityMetadataKind(entityTypeService, metahubId, storedKind, userId)
    return resolvedMetadataKind === metadataKind
}

export const isEntityMetadataEntityType = (row: EntityMetadataTypeLike, metadataKind: EntityMetadataKind): boolean =>
    row.kindKey === metadataKind

export const isEntityMetadataResolvedType = (row: EntityMetadataTypeLike | null | undefined, metadataKind: EntityMetadataKind): boolean =>
    Boolean(row && isEntityMetadataEntityType(row, metadataKind))

export const resolveEntityMetadataSettingKey = (
    resolvedType: EntityMetadataTypeLike | null | undefined,
    settingSuffix: string
): string | null => {
    const metadataKind = resolvedType ? getEntityMetadataKind(resolvedType.kindKey) : null
    const metadataSurface = metadataKind ? resolveEntitySurfaceKey(metadataKind) : null
    return metadataSurface ? buildEntitySurfaceSettingKey(metadataSurface, settingSuffix) : null
}

export const resolveEntityMetadataAclPermission = (
    _resolvedType: EntityMetadataTypeLike,
    operation: 'create' | 'edit' | 'delete'
): 'createContent' | 'editContent' | 'deleteContent' => {
    if (operation === 'delete') {
        return 'deleteContent'
    }

    return operation === 'create' ? 'createContent' : 'editContent'
}
