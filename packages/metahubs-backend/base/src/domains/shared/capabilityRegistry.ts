import { CAPABILITY_DEPENDENCIES, getEnabledCapabilityKeys, type EntityTypeCapabilities } from '@universo/types'

export interface BackendCapabilityDescriptor {
    key: keyof EntityTypeCapabilities
    tables: string[]
    dependencies: string[]
    requiresPhysicalTable: boolean
    physicalTablePrefix?: string
    supportedKinds: string[] | null
}

export const CAPABILITY_REGISTRY: Record<keyof EntityTypeCapabilities, BackendCapabilityDescriptor> = {
    dataSchema: {
        key: 'dataSchema',
        tables: ['_mhb_components'],
        dependencies: [...CAPABILITY_DEPENDENCIES.dataSchema],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    records: {
        key: 'records',
        tables: ['_mhb_elements'],
        dependencies: [...CAPABILITY_DEPENDENCIES.records],
        requiresPhysicalTable: false,
        supportedKinds: ['object']
    },
    treeAssignment: {
        key: 'treeAssignment',
        tables: [],
        dependencies: [...CAPABILITY_DEPENDENCIES.treeAssignment],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    optionValues: {
        key: 'optionValues',
        tables: ['_mhb_values'],
        dependencies: [...CAPABILITY_DEPENDENCIES.optionValues],
        requiresPhysicalTable: false,
        supportedKinds: ['enumeration']
    },
    fixedValues: {
        key: 'fixedValues',
        tables: ['_mhb_constants'],
        dependencies: [...CAPABILITY_DEPENDENCIES.fixedValues],
        requiresPhysicalTable: false,
        supportedKinds: ['set']
    },
    hierarchy: {
        key: 'hierarchy',
        tables: [],
        dependencies: [...CAPABILITY_DEPENDENCIES.hierarchy],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    nestedCollections: {
        key: 'nestedCollections',
        tables: ['_mhb_components'],
        dependencies: [...CAPABILITY_DEPENDENCIES.nestedCollections],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    relations: {
        key: 'relations',
        tables: ['_mhb_components'],
        dependencies: [...CAPABILITY_DEPENDENCIES.relations],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    actions: {
        key: 'actions',
        tables: ['_mhb_actions'],
        dependencies: [...CAPABILITY_DEPENDENCIES.actions],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    events: {
        key: 'events',
        tables: ['_mhb_event_bindings'],
        dependencies: [...CAPABILITY_DEPENDENCIES.events],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    scripting: {
        key: 'scripting',
        tables: ['_mhb_scripts'],
        dependencies: [...CAPABILITY_DEPENDENCIES.scripting],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    blockContent: {
        key: 'blockContent',
        tables: ['_mhb_objects'],
        dependencies: [...CAPABILITY_DEPENDENCIES.blockContent],
        requiresPhysicalTable: false,
        supportedKinds: ['page']
    },
    layoutConfig: {
        key: 'layoutConfig',
        tables: ['_mhb_layouts', '_mhb_widgets', '_mhb_layout_widget_overrides'],
        dependencies: [...CAPABILITY_DEPENDENCIES.layoutConfig],
        requiresPhysicalTable: false,
        supportedKinds: null
    },
    runtimeBehavior: {
        key: 'runtimeBehavior',
        tables: [],
        dependencies: [...CAPABILITY_DEPENDENCIES.runtimeBehavior],
        requiresPhysicalTable: false,
        supportedKinds: ['object']
    },
    physicalTable: {
        key: 'physicalTable',
        tables: [],
        dependencies: [...CAPABILITY_DEPENDENCIES.physicalTable],
        requiresPhysicalTable: true,
        supportedKinds: null
    },
    identityFields: {
        key: 'identityFields',
        tables: ['_mhb_components'],
        dependencies: [...CAPABILITY_DEPENDENCIES.identityFields],
        requiresPhysicalTable: true,
        supportedKinds: ['object']
    },
    recordLifecycle: {
        key: 'recordLifecycle',
        tables: ['_mhb_objects'],
        dependencies: [...CAPABILITY_DEPENDENCIES.recordLifecycle],
        requiresPhysicalTable: true,
        supportedKinds: ['object']
    },
    posting: {
        key: 'posting',
        tables: ['_mhb_scripts'],
        dependencies: [...CAPABILITY_DEPENDENCIES.posting],
        requiresPhysicalTable: true,
        supportedKinds: ['object']
    },
    ledgerSchema: {
        key: 'ledgerSchema',
        tables: ['_mhb_components'],
        dependencies: [...CAPABILITY_DEPENDENCIES.ledgerSchema],
        requiresPhysicalTable: true,
        supportedKinds: null
    }
}

export const getEnabledCapabilities = (manifest: EntityTypeCapabilities): Array<keyof EntityTypeCapabilities> =>
    getEnabledCapabilityKeys(manifest)
