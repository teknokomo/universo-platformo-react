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
    'layoutConfig',
    'runtimeBehavior',
    'physicalTable'
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

export interface PhysicalTableComponentConfig extends ComponentConfig {
    prefix: string
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
    layoutConfig: ComponentConfig | false
    runtimeBehavior: ComponentConfig | false
    physicalTable: PhysicalTableComponentConfig | false
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
    layoutConfig: [],
    runtimeBehavior: ['layoutConfig'],
    physicalTable: []
}

export const isEnabledComponentConfig = (config: ComponentConfig | false | null | undefined): config is ComponentConfig =>
    Boolean(config && typeof config === 'object' && config.enabled)

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
