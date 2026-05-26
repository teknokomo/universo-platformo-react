import {
    BuiltinEntityKinds,
    TEMPLATE_MANAGED_ENTITY_TYPE_CONFIG_KEY,
    buildEntitySurfaceSettingKey,
    isEnabledCapabilityConfig,
    isBuiltinEntityKind,
    resolveEntitySurfaceKey,
    type ResolvedEntityType,
    type BuiltinEntityKind
} from '@universo-react/types'

import type { EntityTypeService } from '../entities/services/EntityTypeService'
import { MetahubValidationError } from './domainErrors'
import { isRegisteredBuiltinEntityTypePresetKind } from '../templates/data'

export type EntityMetadataKind = BuiltinEntityKind

type EntityMetadataTypeLike = Pick<ResolvedEntityType, 'kindKey'> & {
    config?: Record<string, unknown> | null
    capabilities: ResolvedEntityType['capabilities']
}

const normalizeKindKey = (value?: string | null): string => (typeof value === 'string' ? value.trim() : '')

export const getEntityMetadataKind = (kind: unknown): EntityMetadataKind | null => {
    if (typeof kind !== 'string') {
        return null
    }

    const normalizedKind = kind.trim()
    return isBuiltinEntityKind(normalizedKind) ? normalizedKind : null
}

const isTemplateManagedType = (row: EntityMetadataTypeLike): boolean => {
    const templatePreset = row.config?.[TEMPLATE_MANAGED_ENTITY_TYPE_CONFIG_KEY]
    return Boolean(
        templatePreset &&
            typeof templatePreset === 'object' &&
            !Array.isArray(templatePreset) &&
            (templatePreset as { managed?: unknown }).managed === true &&
            (templatePreset as { source?: unknown }).source === 'entity_type_preset' &&
            typeof (templatePreset as { presetCodename?: unknown }).presetCodename === 'string' &&
            isRegisteredBuiltinEntityTypePresetKind(row.kindKey)
    )
}

const isTemplateManagedObjectLikeType = (row: EntityMetadataTypeLike): boolean =>
    isTemplateManagedType(row) &&
    isEnabledCapabilityConfig(row.capabilities.dataSchema) &&
    isEnabledCapabilityConfig(row.capabilities.records) &&
    isEnabledCapabilityConfig(row.capabilities.physicalTable) &&
    !isEnabledCapabilityConfig(row.capabilities.optionValues) &&
    !isEnabledCapabilityConfig(row.capabilities.fixedValues) &&
    !isEnabledCapabilityConfig(row.capabilities.blockContent)

export const resolveEntityMetadataKindFromType = (row: EntityMetadataTypeLike | null | undefined): EntityMetadataKind | null => {
    if (!row) {
        return null
    }

    const builtinKind = getEntityMetadataKind(row.kindKey)
    if (builtinKind) {
        return builtinKind
    }

    return isTemplateManagedObjectLikeType(row) ? BuiltinEntityKinds.OBJECT : null
}

export const createEntityMetadataKindSet = (kinds: readonly string[]): Set<string> =>
    new Set(kinds.map((kind) => normalizeKindKey(kind)).filter((kind) => kind.length > 0))

export const resolveEntityMetadataKinds = async (
    entityTypeService: Pick<EntityTypeService, 'listEditableTypes'>,
    metahubId: string,
    metadataKind: EntityMetadataKind,
    userId?: string
): Promise<string[]> => {
    const types = await entityTypeService.listEditableTypes(metahubId, userId)
    const kinds = types
        .filter((type) => resolveEntityMetadataKindFromType(type) === metadataKind)
        .map((type) => normalizeKindKey(type.kindKey))
        .filter((kind) => kind.length > 0)
    return [...new Set(kinds.length > 0 ? kinds : [metadataKind])]
}

export const resolveEntityMetadataKindsInSchema = async (
    entityTypeService: Pick<EntityTypeService, 'listEditableTypesInSchema'>,
    schemaName: string,
    metadataKind: EntityMetadataKind,
    db?: Parameters<EntityTypeService['listEditableTypesInSchema']>[1]
): Promise<string[]> => {
    const types = await entityTypeService.listEditableTypesInSchema(schemaName, db)
    const kinds = types
        .filter((type) => resolveEntityMetadataKindFromType(type) === metadataKind)
        .map((type) => normalizeKindKey(type.kindKey))
        .filter((kind) => kind.length > 0)
    return [...new Set(kinds.length > 0 ? kinds : [metadataKind])]
}

export const resolveRequestedEntityMetadataKind = async (
    entityTypeService: Pick<EntityTypeService, 'resolveType'>,
    metahubId: string,
    metadataKind: EntityMetadataKind,
    requestedKindKey?: string | null,
    userId?: string
): Promise<string> => {
    const normalizedRequestedKindKey = normalizeKindKey(requestedKindKey)
    if (!normalizedRequestedKindKey || normalizedRequestedKindKey === metadataKind) {
        return metadataKind
    }

    const requestedType = await entityTypeService.resolveType(metahubId, normalizedRequestedKindKey, userId)
    if (resolveEntityMetadataKindFromType(requestedType) === metadataKind) {
        return normalizedRequestedKindKey
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
    entityTypeService: Pick<EntityTypeService, 'resolveType'>,
    metahubId: string,
    storedKind: string | null | undefined,
    userId?: string
): Promise<EntityMetadataKind | null> => {
    const builtinKind = getEntityMetadataKind(storedKind)
    if (builtinKind) {
        return builtinKind
    }

    const normalizedStoredKind = normalizeKindKey(storedKind)
    if (!normalizedStoredKind) {
        return null
    }

    return resolveEntityMetadataKindFromType(await entityTypeService.resolveType(metahubId, normalizedStoredKind, userId))
}

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
    resolveEntityMetadataKindFromType(row) === metadataKind

export const isEntityMetadataResolvedType = (row: EntityMetadataTypeLike | null | undefined, metadataKind: EntityMetadataKind): boolean =>
    Boolean(row && isEntityMetadataEntityType(row, metadataKind))

export const resolveEntityMetadataSettingKey = (
    resolvedType: EntityMetadataTypeLike | null | undefined,
    settingSuffix: string
): string | null => {
    if (resolvedType?.kindKey && !isBuiltinEntityKind(resolvedType.kindKey)) {
        return `entity.${resolvedType.kindKey}.${settingSuffix}`
    }

    const metadataKind = resolveEntityMetadataKindFromType(resolvedType)
    const metadataSurface = metadataKind ? resolveEntitySurfaceKey(metadataKind) : null
    return metadataSurface ? buildEntitySurfaceSettingKey(metadataSurface, settingSuffix) : null
}

export const resolveEntityMetadataSettingKeys = (
    resolvedType: EntityMetadataTypeLike | null | undefined,
    settingSuffix: string
): string[] => {
    const keys: string[] = []
    if (resolvedType?.kindKey && !isBuiltinEntityKind(resolvedType.kindKey)) {
        keys.push(`entity.${resolvedType.kindKey}.${settingSuffix}`)
    }

    const metadataKind = resolveEntityMetadataKindFromType(resolvedType)
    const metadataSurface = metadataKind ? resolveEntitySurfaceKey(metadataKind) : null
    if (metadataSurface) {
        keys.push(buildEntitySurfaceSettingKey(metadataSurface, settingSuffix))
    }

    return [...new Set(keys)]
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
