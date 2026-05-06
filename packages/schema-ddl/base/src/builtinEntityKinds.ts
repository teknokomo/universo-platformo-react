import { isBuiltinEntityKind } from '@universo/types'

export type SchemaBuiltinEntityKind = 'catalog' | 'hub' | 'set' | 'enumeration' | 'page'

const isSchemaBuiltinEntityKind = (kind: unknown): kind is SchemaBuiltinEntityKind =>
    kind === 'catalog' || kind === 'hub' || kind === 'set' || kind === 'enumeration' || kind === 'page'

export const resolveSchemaBuiltinEntityKind = (kind: unknown): SchemaBuiltinEntityKind | null =>
    typeof kind === 'string' && isBuiltinEntityKind(kind) && isSchemaBuiltinEntityKind(kind) ? kind : null

export const isNonPhysicalStandardEntity = (entity: { kind: unknown }): boolean => {
    const standardKind = resolveSchemaBuiltinEntityKind(entity.kind)
    return standardKind === 'hub' || standardKind === 'set' || standardKind === 'enumeration' || standardKind === 'page'
}

export const hasPhysicalRuntimeTable = (entity: { kind: unknown; physicalTableEnabled?: boolean | null }): boolean => {
    if (typeof entity.physicalTableEnabled === 'boolean') {
        return entity.physicalTableEnabled
    }

    if (entity.kind === 'hub' || entity.kind === 'set' || entity.kind === 'enumeration' || entity.kind === 'page') {
        return false
    }

    return true
}

export const isStandardEnumerationKind = (kind: unknown): boolean => resolveSchemaBuiltinEntityKind(kind) === 'enumeration'

export const isStandardSetKind = (kind: unknown): boolean => resolveSchemaBuiltinEntityKind(kind) === 'set'
