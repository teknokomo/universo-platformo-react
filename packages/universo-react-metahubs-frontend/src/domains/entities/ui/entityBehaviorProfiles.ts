import type { EntityTypeCapabilities } from '@universo-react/types'

export type EntityBehaviorProfileKey = 'singleValue' | 'catalog' | 'document' | 'journal' | 'informationRegister' | 'accumulationRegister'

export type SupportedEntityTab = 'general' | 'behavior' | 'ledgerSchema' | 'treeEntities' | 'layout' | 'modules'

export type EntityBehaviorProfileDefinition = {
    key: EntityBehaviorProfileKey
    labelKey: string
    defaultLabel: string
    capabilities: EntityTypeCapabilities
    config: Record<string, unknown>
    tabs: SupportedEntityTab[]
}

export const DEFAULT_ENTITY_TYPE_CAPABILITIES: EntityTypeCapabilities = {
    dataSchema: { enabled: true },
    records: false,
    treeAssignment: false,
    optionValues: false,
    fixedValues: false,
    hierarchy: false,
    nestedCollections: false,
    relations: false,
    actions: { enabled: true },
    events: { enabled: true },
    modules: { enabled: true },
    blockContent: false,
    layoutConfig: { enabled: true },
    runtimeBehavior: { enabled: true },
    physicalTable: { enabled: true, prefix: 'obj' },
    identityFields: false,
    recordLifecycle: false,
    posting: false,
    ledgerSchema: false
}

export const DEFAULT_ENTITY_TYPE_PRESENTATION: Record<string, unknown> = {}
export const DEFAULT_ENTITY_TYPE_CONFIG: Record<string, unknown> = {}

export const ENTITY_BEHAVIOR_PROFILES: readonly EntityBehaviorProfileDefinition[] = [
    {
        key: 'singleValue',
        labelKey: 'entities.behaviorProfiles.singleValue',
        defaultLabel: 'Single-value settings',
        capabilities: {
            ...DEFAULT_ENTITY_TYPE_CAPABILITIES,
            records: false,
            treeAssignment: false,
            hierarchy: false,
            nestedCollections: false,
            relations: false,
            actions: false,
            events: false,
            modules: false,
            identityFields: false,
            recordLifecycle: false,
            posting: false,
            ledgerSchema: false,
            physicalTable: { enabled: true, prefix: 'const' }
        },
        config: {
            singleValue: {
                kind: 'singleValue',
                dataType: 'STRING',
                scope: 'workspace',
                periodicity: 'none',
                allowRuntimeEdit: true,
                auditChanges: true
            }
        },
        tabs: ['general', 'layout']
    },
    {
        key: 'catalog',
        labelKey: 'entities.behaviorProfiles.catalog',
        defaultLabel: 'Reference catalog',
        capabilities: {
            ...DEFAULT_ENTITY_TYPE_CAPABILITIES,
            records: { enabled: true },
            treeAssignment: { enabled: true },
            hierarchy: { enabled: true, supportsFolders: true },
            relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
            identityFields: { enabled: true, allowNumber: true, allowEffectiveDate: false },
            recordLifecycle: false,
            posting: false,
            ledgerSchema: false,
            physicalTable: { enabled: true, prefix: 'cat' }
        },
        config: {
            catalogBehavior: {
                kind: 'catalog',
                code: { enabled: true, autoNumbering: true, unique: true, periodicity: 'none' },
                hierarchy: { mode: 'groups-and-items', ownerSubordination: false },
                predefinedRows: []
            }
        },
        tabs: ['general', 'treeEntities', 'layout', 'modules']
    },
    {
        key: 'document',
        labelKey: 'entities.behaviorProfiles.document',
        defaultLabel: 'Transactional document',
        capabilities: {
            ...DEFAULT_ENTITY_TYPE_CAPABILITIES,
            records: { enabled: true },
            treeAssignment: { enabled: true },
            nestedCollections: { enabled: true },
            relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
            identityFields: { enabled: true, allowNumber: true, allowEffectiveDate: true },
            recordLifecycle: { enabled: true, allowCustomStates: true },
            posting: { enabled: true, allowManualPosting: true, allowAutomaticPosting: true },
            physicalTable: { enabled: true, prefix: 'doc' }
        },
        config: {
            documentBehavior: { kind: 'document', number: {}, date: {}, lifecycle: {}, immutability: 'posted' },
            documentPosting: { kind: 'documentPosting', movements: [], repostPolicy: 'replace-existing-batch' }
        },
        tabs: ['general', 'behavior', 'treeEntities', 'layout', 'modules']
    },
    {
        key: 'journal',
        labelKey: 'entities.behaviorProfiles.journal',
        defaultLabel: 'Document journal',
        capabilities: {
            ...DEFAULT_ENTITY_TYPE_CAPABILITIES,
            records: { enabled: true },
            treeAssignment: { enabled: true },
            relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
            identityFields: { enabled: true, allowNumber: true, allowEffectiveDate: true },
            physicalTable: { enabled: true, prefix: 'jrnl' }
        },
        config: {
            journalBehavior: { kind: 'journal', sources: [], defaultSort: [{ field: 'Date', direction: 'desc' }] }
        },
        tabs: ['general', 'treeEntities', 'layout', 'modules']
    },
    {
        key: 'informationRegister',
        labelKey: 'entities.behaviorProfiles.informationRegister',
        defaultLabel: 'Information register',
        capabilities: {
            ...DEFAULT_ENTITY_TYPE_CAPABILITIES,
            records: { enabled: true },
            treeAssignment: { enabled: true },
            relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
            identityFields: false,
            recordLifecycle: false,
            posting: false,
            ledgerSchema: { enabled: true, allowProjections: true, allowRegistrarPolicy: true, allowManualFacts: false },
            physicalTable: { enabled: true, prefix: 'ireg' }
        },
        config: {
            registerBehavior: {
                kind: 'register',
                mode: 'facts',
                periodicity: 'instant',
                registrarPolicy: 'both',
                movementDirection: 'none',
                dimensions: [],
                resources: [],
                projections: []
            }
        },
        tabs: ['general', 'ledgerSchema', 'treeEntities', 'layout', 'modules']
    },
    {
        key: 'accumulationRegister',
        labelKey: 'entities.behaviorProfiles.accumulationRegister',
        defaultLabel: 'Accumulation register',
        capabilities: {
            ...DEFAULT_ENTITY_TYPE_CAPABILITIES,
            records: { enabled: true },
            treeAssignment: { enabled: true },
            relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
            identityFields: false,
            recordLifecycle: false,
            posting: false,
            ledgerSchema: { enabled: true, allowProjections: true, allowRegistrarPolicy: true, allowManualFacts: false },
            physicalTable: { enabled: true, prefix: 'areg' }
        },
        config: {
            registerBehavior: {
                kind: 'register',
                mode: 'balance',
                periodicity: 'instant',
                registrarPolicy: 'registrar',
                movementDirection: 'in-out',
                dimensions: [],
                resources: [],
                projections: []
            }
        },
        tabs: ['general', 'ledgerSchema', 'treeEntities', 'layout', 'modules']
    }
] as const

export const getEntityBehaviorProfile = (profileKey: string): EntityBehaviorProfileDefinition | undefined =>
    ENTITY_BEHAVIOR_PROFILES.find((profile) => profile.key === profileKey)
