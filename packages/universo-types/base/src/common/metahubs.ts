// Shared metahubs metadata types and constants.
// Keep runtime-safe values for validation and enum-like usage.

import type { VersionedLocalizedContent } from './admin'

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

export interface MetaPresentation {
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string>
}

export interface MetaFieldDefinition {
    id: string
    codename: string
    dataType: AttributeDataType
    isRequired: boolean
    targetEntityId?: string | null
    presentation: MetaPresentation
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
}

export interface MetaEntityDefinition {
    id: string
    kind: MetaEntityKind
    codename: string
    presentation: MetaPresentation
    fields: MetaFieldDefinition[]
}
