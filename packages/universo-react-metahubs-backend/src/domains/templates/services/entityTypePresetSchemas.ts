import { z } from 'zod'
import {
    ENTITY_BEHAVIOR_CONFIG_KEYS,
    entityBehaviorConfigSchema,
    entityTypeCapabilitiesSchema,
    validateCapabilityDependencies
} from '@universo-react/types'
import {
    CURRENT_STRUCTURE_VERSION,
    CURRENT_STRUCTURE_VERSION_SEMVER,
    semverToStructureVersion
} from '../../metahubs/services/structureVersions'

type EntityTypePresetSchemaDependencies<
    TVersionedLocalizedContent extends z.ZodTypeAny,
    TSeedComponent extends z.ZodTypeAny,
    TSeedFixedValue extends z.ZodTypeAny,
    TSeedElement extends z.ZodTypeAny,
    TSeedEnumerationValue extends z.ZodTypeAny
> = {
    vlcSchema: TVersionedLocalizedContent
    seedComponentSchema: TSeedComponent
    seedFixedValueSchema: TSeedFixedValue
    seedElementSchema: TSeedElement
    seedEnumerationValueSchema: TSeedEnumerationValue
}

export const behaviorConfigKindByKey: Record<(typeof ENTITY_BEHAVIOR_CONFIG_KEYS)[number], string> = {
    singleValue: 'singleValue',
    catalogBehavior: 'catalog',
    documentBehavior: 'document',
    documentPosting: 'documentPosting',
    journalBehavior: 'journal',
    registerBehavior: 'register',
    accountChartBehavior: 'accountChart',
    dynamicCharacteristic: 'dynamicCharacteristic',
    calculationTypeGraph: 'calculationTypeGraph'
}

function validateTypedBehaviorConfig(
    config: Record<string, unknown> | undefined,
    ctx: z.RefinementCtx,
    path: Array<string | number>
): void {
    for (const key of ENTITY_BEHAVIOR_CONFIG_KEYS) {
        const value = config?.[key]
        if (value === undefined) {
            continue
        }
        const result = entityBehaviorConfigSchema.safeParse(value)
        if (!result.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, key],
                message: `Invalid typed behavior config: ${key}`
            })
            continue
        }

        if (behaviorConfigKindByKey[key] !== result.data.kind) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...path, key, 'kind'],
                message: `Typed behavior config key "${key}" does not match kind "${result.data.kind}"`
            })
        }
    }
}

/**
 * Builds the Entity Type preset schemas using the seed schemas owned by the template manifest validator.
 */
export function createEntityTypePresetSchemas<
    TVersionedLocalizedContent extends z.ZodTypeAny,
    TSeedComponent extends z.ZodTypeAny,
    TSeedFixedValue extends z.ZodTypeAny,
    TSeedElement extends z.ZodTypeAny,
    TSeedEnumerationValue extends z.ZodTypeAny
>(
    dependencies: EntityTypePresetSchemaDependencies<
        TVersionedLocalizedContent,
        TSeedComponent,
        TSeedFixedValue,
        TSeedElement,
        TSeedEnumerationValue
    >
) {
    const { vlcSchema, seedComponentSchema, seedFixedValueSchema, seedElementSchema, seedEnumerationValueSchema } = dependencies

    const templateMetaSchema = z.object({
        author: z.string().optional(),
        tags: z.array(z.string()).optional(),
        icon: z.string().optional(),
        previewUrl: z.string().optional()
    })

    const entityTypeUiSchema = z.object({
        iconName: z.string().min(1),
        tabs: z.array(z.string().min(1)).min(1),
        sidebarSection: z.enum(['objects', 'admin']),
        sidebarOrder: z.number().int().min(0).optional(),
        nameKey: z.string().min(1),
        descriptionKey: z.string().min(1).optional(),
        resourceSurfaces: z
            .array(
                z.object({
                    key: z.string().min(1).max(64),
                    capability: z.enum(['dataSchema', 'fixedValues', 'optionValues', 'projectBinding']),
                    routeSegment: z.string().min(1).max(64),
                    title: vlcSchema.optional(),
                    titleKey: z.string().min(1).optional(),
                    fallbackTitle: z.string().min(1).optional(),
                    sharedTitle: vlcSchema.optional(),
                    sharedTitleKey: z.string().min(1).optional(),
                    fallbackSharedTitle: z.string().min(1).optional()
                })
            )
            .optional(),
        treeAssignmentLabels: z.record(z.string(), vlcSchema).optional()
    })

    const presetDefaultInstanceSchema = z.object({
        codename: z.string().min(1).max(100),
        name: vlcSchema,
        description: vlcSchema.optional(),
        localizeCodenameFromName: z.boolean().optional(),
        config: z.record(z.unknown()).optional(),
        components: z.array(seedComponentSchema).optional(),
        fixedValues: z.array(seedFixedValueSchema).optional(),
        elements: z.array(seedElementSchema).optional(),
        optionValues: z.array(seedEnumerationValueSchema).optional(),
        hubs: z.array(z.string()).optional()
    })

    const entityTypePresetManifestSchemaBase = z.object({
        $schema: z.literal('entity-type-preset/v1'),
        codename: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-z0-9-]+$/, 'Codename must be lowercase alphanumeric with hyphens'),
        version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be SemVer (e.g., 1.0.0)'),
        minStructureVersion: z.string().regex(/^\d+\.\d+\.\d+$/, 'Structure version must be SemVer (e.g., 0.1.0)'),
        name: vlcSchema,
        description: vlcSchema.optional(),
        meta: templateMetaSchema.optional(),
        entityType: z.object({
            kindKey: z
                .string()
                .min(1)
                .max(64)
                .regex(/^[a-z][a-z0-9._-]{0,63}$/, 'Kind key must be lowercase and start with a letter'),
            codename: vlcSchema.optional(),
            capabilities: entityTypeCapabilitiesSchema,
            ui: entityTypeUiSchema,
            presentation: z.record(z.unknown()).optional(),
            config: z.record(z.unknown()).optional()
        }),
        defaultInstances: z.array(presetDefaultInstanceSchema).optional()
    })

    const entityTypePresetManifestSchema = entityTypePresetManifestSchemaBase.superRefine((manifest, ctx) => {
        // The base Zod object requires this key; its inferred refinement input type marks it optional.
        const entityType = manifest.entityType!

        if (semverToStructureVersion(manifest.minStructureVersion) > CURRENT_STRUCTURE_VERSION) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['minStructureVersion'],
                message: `Template requires structure version ${manifest.minStructureVersion}, but current platform supports only ${CURRENT_STRUCTURE_VERSION_SEMVER}`
            })
        }

        const dependencyErrors = validateCapabilityDependencies(entityType.capabilities)
        for (const [index, error] of dependencyErrors.entries()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['entityType', 'capabilities', index],
                message: error
            })
        }

        validateTypedBehaviorConfig(entityType.config, ctx, ['entityType', 'config'])

        const resourceSurfaceKeyPattern = /^[a-z][a-zA-Z0-9._-]{0,63}$/
        const resourceSurfaceRoutePattern = /^[a-z][a-z0-9-]{0,63}$/
        const seenResourceSurfaceKeys = new Set<string>()
        const seenResourceSurfaceCapabilities = new Set<string>()
        const seenResourceSurfaceRouteSegments = new Set<string>()
        for (const [index, surface] of (entityType.ui.resourceSurfaces ?? []).entries()) {
            if (!resourceSurfaceKeyPattern.test(surface.key)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['entityType', 'ui', 'resourceSurfaces', index, 'key'],
                    message: `Resource surface key must start with a letter and use only letters, digits, dots, underscores, or hyphens: ${surface.key}`
                })
            }

            if (seenResourceSurfaceKeys.has(surface.key)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['entityType', 'ui', 'resourceSurfaces', index, 'key'],
                    message: `Duplicate resource surface key: ${surface.key}`
                })
            }
            seenResourceSurfaceKeys.add(surface.key)

            if (seenResourceSurfaceCapabilities.has(surface.capability)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['entityType', 'ui', 'resourceSurfaces', index, 'capability'],
                    message: `Duplicate resource surface capability: ${surface.capability}`
                })
            }
            seenResourceSurfaceCapabilities.add(surface.capability)

            if (!resourceSurfaceRoutePattern.test(surface.routeSegment)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['entityType', 'ui', 'resourceSurfaces', index, 'routeSegment'],
                    message: `Resource surface routeSegment must be lowercase kebab-case: ${surface.routeSegment}`
                })
            }

            if (seenResourceSurfaceRouteSegments.has(surface.routeSegment)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['entityType', 'ui', 'resourceSurfaces', index, 'routeSegment'],
                    message: `Duplicate resource surface routeSegment: ${surface.routeSegment}`
                })
            }
            seenResourceSurfaceRouteSegments.add(surface.routeSegment)

            if (entityType.capabilities[surface.capability] === false) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['entityType', 'ui', 'resourceSurfaces', index, 'capability'],
                    message: `Resource surface capability ${surface.capability} requires the matching entity component to be enabled`
                })
            }
        }

        const defaultInstanceCodenameSet = new Set<string>()
        for (let index = 0; index < (manifest.defaultInstances?.length ?? 0); index++) {
            const instance = manifest.defaultInstances?.[index]
            if (!instance) continue

            if (defaultInstanceCodenameSet.has(instance.codename)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['defaultInstances', index, 'codename'],
                    message: `Duplicate default instance codename: ${instance.codename}`
                })
            }
            defaultInstanceCodenameSet.add(instance.codename)
            validateTypedBehaviorConfig(instance.config, ctx, ['defaultInstances', index, 'config'])

            if (instance.components?.length && entityType.capabilities.dataSchema === false) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['defaultInstances', index, 'components'],
                    message: 'Default instance components require the dataSchema component'
                })
            }

            if (instance.fixedValues?.length && entityType.capabilities.fixedValues === false) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['defaultInstances', index, 'fixedValues'],
                    message: 'Default instance constants require the constants component'
                })
            }

            if (instance.elements?.length && entityType.capabilities.records === false) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['defaultInstances', index, 'elements'],
                    message: 'Default instance elements require the records component'
                })
            }

            if (instance.optionValues?.length && entityType.capabilities.optionValues === false) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['defaultInstances', index, 'optionValues'],
                    message: 'Default instance optionValues require the optionValues component'
                })
            }

            if (instance.hubs?.length && entityType.capabilities.treeAssignment === false) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['defaultInstances', index, 'hubs'],
                    message: 'Default instance hub references require the treeAssignment component'
                })
            }
        }
    })

    return { templateMetaSchema, entityTypePresetManifestSchema }
}
