// Shared metahubs metadata types and constants.
// Keep runtime-safe values for validation and enum-like usage.

export const ATTRIBUTE_DATA_TYPES = [
    'STRING',
    'NUMBER',
    'BOOLEAN',
    'DATE',
    'DATETIME',
    'REF',
    'JSON',
] as const

export type AttributeDataType = (typeof ATTRIBUTE_DATA_TYPES)[number]

export const AttributeDataType = ATTRIBUTE_DATA_TYPES.reduce(
    (acc, value) => {
        acc[value] = value
        return acc
    },
    {} as Record<AttributeDataType, AttributeDataType>
)

export const MetaEntityKind = {
    CATALOG: 'catalog',
    HUB: 'hub',
    DOCUMENT: 'document',
} as const

export type MetaEntityKind = (typeof MetaEntityKind)[keyof typeof MetaEntityKind]

export interface MetaFieldDefinition {
    id: string
    codename: string
    dataType: AttributeDataType
    isRequired: boolean
    targetEntityId?: string | null
}

export interface MetaEntityDefinition {
    id: string
    kind: MetaEntityKind
    codename: string
    fields: MetaFieldDefinition[]
}
