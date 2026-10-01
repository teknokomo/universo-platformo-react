import { z } from 'zod'
import { LEDGER_MODES, type LedgerMode } from './ledgerModes'

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
    'modules',
    'blockContent',
    'layoutConfig',
    'runtimeBehavior',
    'physicalTable',
    'identityFields',
    'recordLifecycle',
    'posting',
    'ledgerSchema',
    'projectBinding'
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

/** Providers that can back an external-project binding resource surface. */
export const PROJECT_BINDING_PROVIDERS = ['playcanvasEditor'] as const

export type ProjectBindingProvider = (typeof PROJECT_BINDING_PROVIDERS)[number]

/**
 * Binds an entity instance to a single external authoring project (e.g. a
 * PlayCanvas Editor project). Generic by design: the `provider` field carries
 * the concrete system so the capability stays reusable.
 */
export interface ProjectBindingCapabilityConfig extends CapabilityConfig {
    provider: ProjectBindingProvider
    cardinality: 'single'
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
    modules: CapabilityConfig | false
    blockContent: BlockContentCapabilityConfig | false
    layoutConfig: CapabilityConfig | false
    runtimeBehavior: CapabilityConfig | false
    physicalTable: PhysicalTableCapabilityConfig | false
    identityFields?: IdentityFieldsCapabilityConfig | false
    recordLifecycle?: RecordLifecycleCapabilityConfig | false
    posting?: PostingCapabilityConfig | false
    ledgerSchema?: LedgerSchemaCapabilityConfig | false
    projectBinding?: ProjectBindingCapabilityConfig | false
}

const capabilityConfigSchema = z.object({ enabled: z.boolean() }).strict()
const dataSchemaCapabilitySchema = z.union([
    z.literal(false),
    z.object({ enabled: z.boolean(), maxComponents: z.number().int().nullable().optional() }).strict()
])
const recordsCapabilitySchema = z.union([
    z.literal(false),
    z.object({ enabled: z.boolean(), maxElements: z.number().int().nullable().optional() }).strict()
])
const treeAssignmentCapabilitySchema = z.union([
    z.literal(false),
    z
        .object({
            enabled: z.boolean(),
            isSingleHub: z.boolean().optional(),
            isRequiredHub: z.boolean().optional()
        })
        .strict()
])
const hierarchyCapabilitySchema = z.union([
    z.literal(false),
    z.object({ enabled: z.boolean(), supportsFolders: z.boolean().optional() }).strict()
])
const nestedCollectionsCapabilitySchema = z.union([
    z.literal(false),
    z.object({ enabled: z.boolean(), maxCollections: z.number().int().nullable().optional() }).strict()
])
const relationsCapabilitySchema = z.union([
    z.literal(false),
    z.object({ enabled: z.boolean(), allowedRelationTypes: z.array(z.string()).optional() }).strict()
])
const blockContentCapabilitySchema = z.union([
    z.literal(false),
    z
        .object({
            enabled: z.boolean(),
            storage: z.enum(['objectConfig', 'recordJsonb']),
            defaultFormat: z.literal('editorjs'),
            supportedFormats: z.array(z.string().min(1)).min(1),
            allowedBlockTypes: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).min(1),
            maxBlocks: z.number().int().positive().max(5000)
        })
        .strict()
])
const physicalTableCapabilitySchema = z.union([z.literal(false), z.object({ enabled: z.boolean(), prefix: z.string().min(1) }).strict()])
const identityFieldsCapabilitySchema = z.union([
    z.literal(false),
    z
        .object({
            enabled: z.boolean(),
            allowNumber: z.boolean().optional(),
            allowEffectiveDate: z.boolean().optional()
        })
        .strict()
])
const recordLifecycleCapabilitySchema = z.union([
    z.literal(false),
    z.object({ enabled: z.boolean(), allowCustomStates: z.boolean().optional() }).strict()
])
const postingCapabilitySchema = z.union([
    z.literal(false),
    z
        .object({
            enabled: z.boolean(),
            allowManualPosting: z.boolean().optional(),
            allowAutomaticPosting: z.boolean().optional()
        })
        .strict()
])
const ledgerSchemaCapabilitySchema = z.union([
    z.literal(false),
    z
        .object({
            enabled: z.boolean(),
            allowProjections: z.boolean().optional(),
            allowRegistrarPolicy: z.boolean().optional(),
            allowManualFacts: z.boolean().optional(),
            allowedModes: z.array(z.enum(LEDGER_MODES)).optional()
        })
        .strict()
])
const projectBindingCapabilitySchema = z.union([
    z.literal(false),
    z
        .object({
            enabled: z.boolean(),
            provider: z.enum(PROJECT_BINDING_PROVIDERS),
            cardinality: z.literal('single')
        })
        .strict()
])

/** Complete serializable capability contract shared by entity APIs and services. */
export const entityTypeCapabilitiesSchema: z.ZodType<EntityTypeCapabilities> = z
    .object({
        dataSchema: dataSchemaCapabilitySchema,
        records: recordsCapabilitySchema,
        treeAssignment: treeAssignmentCapabilitySchema,
        optionValues: z.union([z.literal(false), capabilityConfigSchema]),
        fixedValues: z.union([z.literal(false), capabilityConfigSchema]),
        hierarchy: hierarchyCapabilitySchema,
        nestedCollections: nestedCollectionsCapabilitySchema,
        relations: relationsCapabilitySchema,
        actions: z.union([z.literal(false), capabilityConfigSchema]),
        events: z.union([z.literal(false), capabilityConfigSchema]),
        modules: z.union([z.literal(false), capabilityConfigSchema]),
        blockContent: blockContentCapabilitySchema,
        layoutConfig: z.union([z.literal(false), capabilityConfigSchema]),
        runtimeBehavior: z.union([z.literal(false), capabilityConfigSchema]),
        physicalTable: physicalTableCapabilitySchema,
        identityFields: identityFieldsCapabilitySchema.optional(),
        recordLifecycle: recordLifecycleCapabilitySchema.optional(),
        posting: postingCapabilitySchema.optional(),
        ledgerSchema: ledgerSchemaCapabilitySchema.optional(),
        projectBinding: projectBindingCapabilitySchema.optional()
    })
    .strict()

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
    modules: [],
    blockContent: [],
    layoutConfig: [],
    runtimeBehavior: ['layoutConfig'],
    physicalTable: [],
    identityFields: ['records'],
    recordLifecycle: ['records', 'identityFields'],
    posting: ['recordLifecycle', 'modules'],
    ledgerSchema: ['dataSchema', 'physicalTable'],
    projectBinding: []
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
