import { isBuiltinEntityKind } from '@universo/types'

export type SchemaBuiltinEntityKind = 'catalog' | 'hub' | 'set' | 'enumeration'

const isSchemaBuiltinEntityKind = (kind: unknown): kind is SchemaBuiltinEntityKind =>
    kind === 'catalog' || kind === 'hub' || kind === 'set' || kind === 'enumeration'

export const resolveSchemaBuiltinEntityKind = (kind: unknown): SchemaBuiltinEntityKind | null =>
    typeof kind === 'string' && isBuiltinEntityKind(kind) && isSchemaBuiltinEntityKind(kind) ? kind : null

export const isNonPhysicalStandardEntity = (entity: { kind: unknown }): boolean => {
    const standardKind = resolveSchemaBuiltinEntityKind(entity.kind)
    return standardKind === 'hub' || standardKind === 'set' || standardKind === 'enumeration'
}

export const isStandardEnumerationKind = (kind: unknown): boolean => resolveSchemaBuiltinEntityKind(kind) === 'enumeration'

export const isStandardSetKind = (kind: unknown): boolean => resolveSchemaBuiltinEntityKind(kind) === 'set'