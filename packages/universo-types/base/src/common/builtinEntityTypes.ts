import type { EntityTypeDefinition } from './entityTypeDefinition'
import { MetaEntityKind } from './metahubs'

export const CATALOG_TYPE: EntityTypeDefinition = {
    kindKey: MetaEntityKind.CATALOG,
    isBuiltin: true,
    components: {
        dataSchema: { enabled: true },
        predefinedElements: { enabled: true },
        hubAssignment: { enabled: true },
        enumerationValues: false,
        constants: false,
        hierarchy: { enabled: true, supportsFolders: true },
        nestedCollections: false,
        relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
        actions: { enabled: true },
        events: { enabled: true },
        scripting: { enabled: true },
        layoutConfig: { enabled: true },
        runtimeBehavior: { enabled: true },
        physicalTable: { enabled: true, prefix: 'cat' }
    },
    ui: {
        iconName: 'IconDatabase',
        tabs: ['general', 'hubs', 'layout', 'scripts'],
        sidebarSection: 'objects',
        nameKey: 'metahubs:catalogs.title'
    }
}

export const SET_TYPE: EntityTypeDefinition = {
    kindKey: MetaEntityKind.SET,
    isBuiltin: true,
    components: {
        dataSchema: { enabled: true },
        predefinedElements: false,
        hubAssignment: false,
        enumerationValues: false,
        constants: { enabled: true },
        hierarchy: false,
        nestedCollections: false,
        relations: false,
        actions: { enabled: true },
        events: { enabled: true },
        scripting: { enabled: true },
        layoutConfig: { enabled: true },
        runtimeBehavior: false,
        physicalTable: false
    },
    ui: {
        iconName: 'IconFileText',
        tabs: ['general', 'scripts'],
        sidebarSection: 'objects',
        nameKey: 'metahubs:sets.title'
    }
}

export const ENUMERATION_TYPE: EntityTypeDefinition = {
    kindKey: MetaEntityKind.ENUMERATION,
    isBuiltin: true,
    components: {
        dataSchema: false,
        predefinedElements: false,
        hubAssignment: false,
        enumerationValues: { enabled: true },
        constants: false,
        hierarchy: false,
        nestedCollections: false,
        relations: false,
        actions: false,
        events: false,
        scripting: { enabled: true },
        layoutConfig: false,
        runtimeBehavior: false,
        physicalTable: false
    },
    ui: {
        iconName: 'IconFiles',
        tabs: ['general', 'scripts'],
        sidebarSection: 'objects',
        nameKey: 'metahubs:enumerations.title'
    }
}

export const HUB_TYPE: EntityTypeDefinition = {
    kindKey: MetaEntityKind.HUB,
    isBuiltin: true,
    components: {
        dataSchema: false,
        predefinedElements: false,
        hubAssignment: false,
        enumerationValues: false,
        constants: false,
        hierarchy: false,
        nestedCollections: false,
        relations: false,
        actions: false,
        events: false,
        scripting: false,
        layoutConfig: false,
        runtimeBehavior: false,
        physicalTable: false
    },
    ui: {
        iconName: 'IconHierarchy',
        tabs: ['general'],
        sidebarSection: 'objects',
        nameKey: 'metahubs:hubs.title'
    }
}

export const DOCUMENT_TYPE: EntityTypeDefinition = {
    kindKey: MetaEntityKind.DOCUMENT,
    isBuiltin: true,
    components: {
        dataSchema: { enabled: true },
        predefinedElements: { enabled: true },
        hubAssignment: { enabled: true },
        enumerationValues: false,
        constants: false,
        hierarchy: false,
        nestedCollections: { enabled: true },
        relations: { enabled: true, allowedRelationTypes: ['manyToOne', 'oneToMany'] },
        actions: { enabled: true },
        events: { enabled: true },
        scripting: { enabled: true },
        layoutConfig: { enabled: true },
        runtimeBehavior: { enabled: true },
        physicalTable: { enabled: true, prefix: 'doc' }
    },
    ui: {
        iconName: 'IconLayoutDashboard',
        tabs: ['general', 'hubs', 'layout', 'scripts'],
        sidebarSection: 'objects',
        nameKey: 'metahubs:documents.title'
    }
}

export const BUILTIN_ENTITY_TYPES = [CATALOG_TYPE, SET_TYPE, ENUMERATION_TYPE, HUB_TYPE, DOCUMENT_TYPE] as const

export const BUILTIN_ENTITY_TYPE_REGISTRY = new Map(BUILTIN_ENTITY_TYPES.map((definition) => [definition.kindKey, definition]))
