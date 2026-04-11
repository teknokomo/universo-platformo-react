import { COMPONENT_DEPENDENCIES, getEnabledComponentKeys, type ComponentManifest } from '@universo/types'

export interface BackendComponentDescriptor {
    key: keyof ComponentManifest
    tables: string[]
    dependencies: string[]
    requiresPhysicalTable: boolean
    physicalTablePrefix?: string
    supportedKinds: string[] | null
}

export const COMPONENT_REGISTRY: Record<keyof ComponentManifest, BackendComponentDescriptor> = {
    dataSchema: {
        key: 'dataSchema',
        tables: ['_mhb_attributes'],
        dependencies: [...COMPONENT_DEPENDENCIES.dataSchema],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    predefinedElements: {
        key: 'predefinedElements',
        tables: ['_mhb_elements'],
        dependencies: [...COMPONENT_DEPENDENCIES.predefinedElements],
        requiresPhysicalTable: false,
        supportedKinds: ['catalog', 'document']
    },
    hubAssignment: {
        key: 'hubAssignment',
        tables: [],
        dependencies: [...COMPONENT_DEPENDENCIES.hubAssignment],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    enumerationValues: {
        key: 'enumerationValues',
        tables: ['_mhb_values'],
        dependencies: [...COMPONENT_DEPENDENCIES.enumerationValues],
        requiresPhysicalTable: false,
        supportedKinds: ['enumeration']
    },
    constants: {
        key: 'constants',
        tables: ['_mhb_constants'],
        dependencies: [...COMPONENT_DEPENDENCIES.constants],
        requiresPhysicalTable: false,
        supportedKinds: ['set']
    },
    hierarchy: {
        key: 'hierarchy',
        tables: [],
        dependencies: [...COMPONENT_DEPENDENCIES.hierarchy],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    nestedCollections: {
        key: 'nestedCollections',
        tables: ['_mhb_attributes'],
        dependencies: [...COMPONENT_DEPENDENCIES.nestedCollections],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    relations: {
        key: 'relations',
        tables: ['_mhb_attributes'],
        dependencies: [...COMPONENT_DEPENDENCIES.relations],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    actions: {
        key: 'actions',
        tables: ['_mhb_actions'],
        dependencies: [...COMPONENT_DEPENDENCIES.actions],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    events: {
        key: 'events',
        tables: ['_mhb_event_bindings'],
        dependencies: [...COMPONENT_DEPENDENCIES.events],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    scripting: {
        key: 'scripting',
        tables: ['_mhb_scripts'],
        dependencies: [...COMPONENT_DEPENDENCIES.scripting],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    layoutConfig: {
        key: 'layoutConfig',
        tables: ['_mhb_layouts', '_mhb_widgets', '_mhb_catalog_widget_overrides'],
        dependencies: [...COMPONENT_DEPENDENCIES.layoutConfig],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    runtimeBehavior: {
        key: 'runtimeBehavior',
        tables: [],
        dependencies: [...COMPONENT_DEPENDENCIES.runtimeBehavior],
        requiresPhysicalTable: false,
        supportedKinds: ['catalog', 'document']
    },
    physicalTable: {
        key: 'physicalTable',
        tables: [],
        dependencies: [...COMPONENT_DEPENDENCIES.physicalTable],
        requiresPhysicalTable: true,
        supportedKinds: null
    }
}

export const getEnabledComponents = (manifest: ComponentManifest): Array<keyof ComponentManifest> => getEnabledComponentKeys(manifest)
