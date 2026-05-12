import type { LedgerMode } from './ledgers'

export const ENTITY_COMPONENT_KEYS = [
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

export type EntityComponentKey = (typeof ENTITY_COMPONENT_KEYS)[number]

export interface ComponentConfig {
    enabled: boolean
}

export interface DataSchemaComponentConfig extends ComponentConfig {
    maxAttributes?: number | null
}

export interface RecordsComponentConfig extends ComponentConfig {
    maxElements?: number | null
}

export interface TreeAssignmentComponentConfig extends ComponentConfig {
    isSingleHub?: boolean
    isRequiredHub?: boolean
}

export interface HierarchyComponentConfig extends ComponentConfig {
    supportsFolders?: boolean
}

export interface NestedCollectionsComponentConfig extends ComponentConfig {
    maxCollections?: number | null
}

export interface RelationsComponentConfig extends ComponentConfig {
    allowedRelationTypes?: string[]
}

export interface ActionsComponentConfig extends ComponentConfig {}

export interface EventsComponentConfig extends ComponentConfig {}

export interface BlockContentComponentConfig extends ComponentConfig {
    storage: 'objectConfig' | 'recordJsonb'
    defaultFormat: 'editorjs'
    supportedFormats: readonly string[]
    allowedBlockTypes: readonly string[]
    maxBlocks: number
}

export interface PhysicalTableComponentConfig extends ComponentConfig {
    prefix: string
}

export interface IdentityFieldsComponentConfig extends ComponentConfig {
    allowNumber?: boolean
    allowEffectiveDate?: boolean
}

export interface RecordLifecycleComponentConfig extends ComponentConfig {
    allowCustomStates?: boolean
}

export interface PostingComponentConfig extends ComponentConfig {
    allowManualPosting?: boolean
    allowAutomaticPosting?: boolean
}

export interface LedgerSchemaComponentConfig extends ComponentConfig {
    allowProjections?: boolean
    allowRegistrarPolicy?: boolean
    allowManualFacts?: boolean
    allowedModes?: readonly LedgerMode[]
}

export interface ComponentManifest {
    dataSchema: DataSchemaComponentConfig | false
    records: RecordsComponentConfig | false
    treeAssignment: TreeAssignmentComponentConfig | false
    optionValues: ComponentConfig | false
    fixedValues: ComponentConfig | false
    hierarchy: HierarchyComponentConfig | false
    nestedCollections: NestedCollectionsComponentConfig | false
    relations: RelationsComponentConfig | false
    actions: ActionsComponentConfig | false
    events: EventsComponentConfig | false
    scripting: ComponentConfig | false
    blockContent: BlockContentComponentConfig | false
    layoutConfig: ComponentConfig | false
    runtimeBehavior: ComponentConfig | false
    physicalTable: PhysicalTableComponentConfig | false
    identityFields?: IdentityFieldsComponentConfig | false
    recordLifecycle?: RecordLifecycleComponentConfig | false
    posting?: PostingComponentConfig | false
    ledgerSchema?: LedgerSchemaComponentConfig | false
}

export const COMPONENT_DEPENDENCIES: Record<EntityComponentKey, readonly EntityComponentKey[]> = {
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

export const isEnabledComponentConfig = (config: ComponentConfig | false | null | undefined): config is ComponentConfig =>
    Boolean(config && typeof config === 'object' && config.enabled)

export const supportsRecordBehavior = (
    components: Pick<ComponentManifest, 'identityFields' | 'recordLifecycle' | 'posting'> | null | undefined
): boolean =>
    Boolean(
        isEnabledComponentConfig(components?.identityFields) ||
            isEnabledComponentConfig(components?.recordLifecycle) ||
            isEnabledComponentConfig(components?.posting)
    )

export const supportsLedgerSchema = (components: Pick<ComponentManifest, 'ledgerSchema'> | null | undefined): boolean =>
    isEnabledComponentConfig(components?.ledgerSchema)

export const isLedgerSchemaCapableEntity = (
    components: Pick<ComponentManifest, 'dataSchema' | 'physicalTable' | 'ledgerSchema'> | null | undefined
): boolean =>
    Boolean(
        isEnabledComponentConfig(components?.ledgerSchema) &&
            isEnabledComponentConfig(components?.dataSchema) &&
            isEnabledComponentConfig(components?.physicalTable)
    )

export const getEnabledComponentKeys = (manifest: ComponentManifest): EntityComponentKey[] =>
    ENTITY_COMPONENT_KEYS.filter((key) => isEnabledComponentConfig(manifest[key]))

export const validateComponentDependencies = (manifest: ComponentManifest): string[] => {
    const errors: string[] = []

    for (const key of ENTITY_COMPONENT_KEYS) {
        if (!isEnabledComponentConfig(manifest[key])) {
            continue
        }

        for (const dependency of COMPONENT_DEPENDENCIES[key]) {
            if (!isEnabledComponentConfig(manifest[dependency])) {
                errors.push(`Component "${key}" requires "${dependency}" to be enabled`)
            }
        }
    }

    return errors
}
