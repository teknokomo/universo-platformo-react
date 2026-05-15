import type { LedgerMode } from './ledgers'

export const ENTITY_CAPABILITY_KEYS = [
    'dataSchema',
    'records',
    'treeAssignment',
    'optionValues',
    'fixedValues',
    'hierarchy',
    'nestedCollections',
    'relations',
    'actions',
    'events',
    'scripting',
    'blockContent',
    'layoutConfig',
    'runtimeBehavior',
    'physicalTable',
    'identityFields',
    'recordLifecycle',
    'posting',
    'ledgerSchema'
] as const

export type EntityCapabilityKey = (typeof ENTITY_CAPABILITY_KEYS)[number]

export interface CapabilityConfig {
    enabled: boolean
}

export interface DataSchemaCapabilityConfig extends CapabilityConfig {
    maxComponents?: number | null
}

export interface RecordsCapabilityConfig extends CapabilityConfig {
    maxElements?: number | null
}

export interface TreeAssignmentCapabilityConfig extends CapabilityConfig {
    isSingleHub?: boolean
    isRequiredHub?: boolean
}

export interface HierarchyCapabilityConfig extends CapabilityConfig {
    supportsFolders?: boolean
}

export interface NestedCollectionsCapabilityConfig extends CapabilityConfig {
    maxCollections?: number | null
}

export interface RelationsCapabilityConfig extends CapabilityConfig {
    allowedRelationTypes?: string[]
}

export interface ActionsCapabilityConfig extends CapabilityConfig {}

export interface EventsCapabilityConfig extends CapabilityConfig {}

export interface BlockContentCapabilityConfig extends CapabilityConfig {
    storage: 'objectConfig' | 'recordJsonb'
    defaultFormat: 'editorjs'
    supportedFormats: readonly string[]
    allowedBlockTypes: readonly string[]
    maxBlocks: number
}

export interface PhysicalTableCapabilityConfig extends CapabilityConfig {
    prefix: string
}

export interface IdentityFieldsCapabilityConfig extends CapabilityConfig {
    allowNumber?: boolean
    allowEffectiveDate?: boolean
}

export interface RecordLifecycleCapabilityConfig extends CapabilityConfig {
    allowCustomStates?: boolean
}

export interface PostingCapabilityConfig extends CapabilityConfig {
    allowManualPosting?: boolean
    allowAutomaticPosting?: boolean
}

export interface LedgerSchemaCapabilityConfig extends CapabilityConfig {
    allowProjections?: boolean
    allowRegistrarPolicy?: boolean
    allowManualFacts?: boolean
    allowedModes?: readonly LedgerMode[]
}

export interface EntityTypeCapabilities {
    dataSchema: DataSchemaCapabilityConfig | false
    records: RecordsCapabilityConfig | false
    treeAssignment: TreeAssignmentCapabilityConfig | false
    optionValues: CapabilityConfig | false
    fixedValues: CapabilityConfig | false
    hierarchy: HierarchyCapabilityConfig | false
    nestedCollections: NestedCollectionsCapabilityConfig | false
    relations: RelationsCapabilityConfig | false
    actions: ActionsCapabilityConfig | false
    events: EventsCapabilityConfig | false
    scripting: CapabilityConfig | false
    blockContent: BlockContentCapabilityConfig | false
    layoutConfig: CapabilityConfig | false
    runtimeBehavior: CapabilityConfig | false
    physicalTable: PhysicalTableCapabilityConfig | false
    identityFields?: IdentityFieldsCapabilityConfig | false
    recordLifecycle?: RecordLifecycleCapabilityConfig | false
    posting?: PostingCapabilityConfig | false
    ledgerSchema?: LedgerSchemaCapabilityConfig | false
}

export const CAPABILITY_DEPENDENCIES: Record<EntityCapabilityKey, readonly EntityCapabilityKey[]> = {
    dataSchema: [],
    records: ['dataSchema'],
    treeAssignment: [],
    optionValues: [],
    fixedValues: [],
    hierarchy: ['dataSchema'],
    nestedCollections: ['dataSchema'],
    relations: ['dataSchema'],
    actions: [],
    events: ['actions'],
    scripting: [],
    blockContent: [],
    layoutConfig: [],
    runtimeBehavior: ['layoutConfig'],
    physicalTable: [],
    identityFields: ['records'],
    recordLifecycle: ['records', 'identityFields'],
    posting: ['recordLifecycle', 'scripting'],
    ledgerSchema: ['dataSchema', 'physicalTable']
}

export const isEnabledCapabilityConfig = (config: CapabilityConfig | false | null | undefined): config is CapabilityConfig =>
    Boolean(config && typeof config === 'object' && config.enabled)

export const supportsRecordBehavior = (
    capabilities: Pick<EntityTypeCapabilities, 'identityFields' | 'recordLifecycle' | 'posting'> | null | undefined
): boolean =>
    Boolean(
        isEnabledCapabilityConfig(capabilities?.identityFields) ||
            isEnabledCapabilityConfig(capabilities?.recordLifecycle) ||
            isEnabledCapabilityConfig(capabilities?.posting)
    )

export const supportsLedgerSchema = (capabilities: Pick<EntityTypeCapabilities, 'ledgerSchema'> | null | undefined): boolean =>
    isEnabledCapabilityConfig(capabilities?.ledgerSchema)

export const isLedgerSchemaCapableEntity = (
    capabilities: Pick<EntityTypeCapabilities, 'dataSchema' | 'physicalTable' | 'ledgerSchema'> | null | undefined
): boolean =>
    Boolean(
        isEnabledCapabilityConfig(capabilities?.ledgerSchema) &&
            isEnabledCapabilityConfig(capabilities?.dataSchema) &&
            isEnabledCapabilityConfig(capabilities?.physicalTable)
    )

export const getEnabledCapabilityKeys = (manifest: EntityTypeCapabilities): EntityCapabilityKey[] =>
    ENTITY_CAPABILITY_KEYS.filter((key) => isEnabledCapabilityConfig(manifest[key]))

export const validateCapabilityDependencies = (manifest: EntityTypeCapabilities): string[] => {
    const errors: string[] = []

    for (const key of ENTITY_CAPABILITY_KEYS) {
        if (!isEnabledCapabilityConfig(manifest[key])) {
            continue
        }

        for (const dependency of CAPABILITY_DEPENDENCIES[key]) {
            if (!isEnabledCapabilityConfig(manifest[dependency])) {
                errors.push(`Capability "${key}" requires "${dependency}" to be enabled`)
            }
        }
    }

    return errors
}
