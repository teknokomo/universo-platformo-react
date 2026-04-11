import { z } from 'zod'
import {
    ATTRIBUTE_DATA_TYPES,
    validateComponentDependencies,
    CONSTANT_DATA_TYPES,
    META_ENTITY_KINDS,
    DASHBOARD_LAYOUT_ZONES,
    DASHBOARD_LAYOUT_WIDGETS,
    DashboardLayoutWidgetKey
} from '@universo/types'
import {
    CURRENT_STRUCTURE_VERSION,
    CURRENT_STRUCTURE_VERSION_SEMVER,
    semverToStructureVersion
} from '../../metahubs/services/structureVersions'

const widgetKeys = DASHBOARD_LAYOUT_WIDGETS.map((w) => w.key) as [DashboardLayoutWidgetKey, ...DashboardLayoutWidgetKey[]]

/** VLC schema — validates VersionedLocalizedContent<string> structure. */
const vlcSchema = z.object({
    _schema: z.literal('1'),
    _primary: z.string(),
    locales: z.record(
        z.object({
            content: z.string(),
            version: z.number(),
            isActive: z.boolean(),
            createdAt: z.string(),
            updatedAt: z.string()
        })
    )
})

const seedLayoutSchema = z.object({
    codename: z.string().min(1).max(100),
    templateKey: z.string().min(1),
    name: vlcSchema,
    description: vlcSchema.nullable().optional(),
    isDefault: z.boolean(),
    isActive: z.boolean(),
    sortOrder: z.number().int(),
    config: z.record(z.unknown()).optional()
})

const seedZoneWidgetSchema = z.object({
    zone: z.enum(DASHBOARD_LAYOUT_ZONES),
    widgetKey: z.enum(widgetKeys),
    sortOrder: z.number().int(),
    config: z.record(z.unknown()).optional(),
    isActive: z.boolean().optional()
})

const seedSettingSchema = z.object({
    key: z.string().min(1),
    value: z.union([z.record(z.unknown()), z.string(), z.number(), z.boolean()])
})

/** Schema for a child attribute inside a TABLE attribute (no nesting). */
const seedChildAttributeSchema = z.object({
    codename: z.string().min(1).max(100),
    dataType: z.enum(ATTRIBUTE_DATA_TYPES),
    name: vlcSchema,
    description: vlcSchema.optional(),
    isRequired: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    targetEntityCodename: z.string().optional(),
    targetEntityKind: z.enum(META_ENTITY_KINDS).optional(),
    targetConstantCodename: z.string().optional(),
    validationRules: z.record(z.unknown()).optional(),
    uiConfig: z.record(z.unknown()).optional()
})

const seedAttributeSchema = z.object({
    codename: z.string().min(1).max(100),
    dataType: z.enum(ATTRIBUTE_DATA_TYPES),
    name: vlcSchema,
    description: vlcSchema.optional(),
    isRequired: z.boolean().optional(),
    isDisplayAttribute: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    targetEntityCodename: z.string().optional(),
    targetEntityKind: z.enum(META_ENTITY_KINDS).optional(),
    targetConstantCodename: z.string().optional(),
    validationRules: z.record(z.unknown()).optional(),
    uiConfig: z.record(z.unknown()).optional(),
    /** Child attributes for TABLE data type (tabular parts). */
    childAttributes: z.array(seedChildAttributeSchema).optional()
})

const seedConstantSchema = z.object({
    codename: z.string().min(1).max(100),
    dataType: z.enum(CONSTANT_DATA_TYPES),
    name: vlcSchema,
    description: vlcSchema.optional(),
    sortOrder: z.number().int().optional(),
    validationRules: z.record(z.unknown()).optional(),
    uiConfig: z.record(z.unknown()).optional(),
    value: z.unknown().optional()
})

const seedEntitySchema = z.object({
    codename: z.string().min(1).max(100),
    kind: z.enum(META_ENTITY_KINDS),
    name: vlcSchema,
    description: vlcSchema.optional(),
    config: z.record(z.unknown()).optional(),
    attributes: z.array(seedAttributeSchema).optional(),
    constants: z.array(seedConstantSchema).optional(),
    hubs: z.array(z.string()).optional()
})

const seedElementSchema = z.object({
    codename: z.string().min(1).max(100),
    data: z.record(z.unknown()),
    sortOrder: z.number().int()
})

const seedEnumerationValueSchema = z.object({
    codename: z.string().min(1).max(100),
    name: vlcSchema,
    description: vlcSchema.optional(),
    sortOrder: z.number().int().optional(),
    isDefault: z.boolean().optional()
})

const seedSchema = z.object({
    layouts: z.array(seedLayoutSchema).min(1),
    layoutZoneWidgets: z.record(z.array(seedZoneWidgetSchema)),
    settings: z.array(seedSettingSchema).optional(),
    entities: z.array(seedEntitySchema).optional(),
    elements: z.record(z.array(seedElementSchema)).optional(),
    enumerationValues: z.record(z.array(seedEnumerationValueSchema)).optional()
})

const templateMetaSchema = z.object({
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
    icon: z.string().optional(),
    previewUrl: z.string().optional()
})

const componentConfigSchema = z.object({ enabled: z.boolean() })

const componentManifestSchema = z.object({
    dataSchema: z.union([componentConfigSchema.extend({ maxAttributes: z.number().int().nullable().optional() }), z.literal(false)]),
    predefinedElements: z.union([componentConfigSchema.extend({ maxElements: z.number().int().nullable().optional() }), z.literal(false)]),
    hubAssignment: z.union([
        componentConfigSchema.extend({
            isSingleHub: z.boolean().optional(),
            isRequiredHub: z.boolean().optional()
        }),
        z.literal(false)
    ]),
    enumerationValues: z.union([componentConfigSchema, z.literal(false)]),
    constants: z.union([componentConfigSchema, z.literal(false)]),
    hierarchy: z.union([componentConfigSchema.extend({ supportsFolders: z.boolean().optional() }), z.literal(false)]),
    nestedCollections: z.union([
        componentConfigSchema.extend({ maxCollections: z.number().int().nullable().optional() }),
        z.literal(false)
    ]),
    relations: z.union([
        componentConfigSchema.extend({
            allowedRelationTypes: z.array(z.string()).optional()
        }),
        z.literal(false)
    ]),
    actions: z.union([componentConfigSchema, z.literal(false)]),
    events: z.union([componentConfigSchema, z.literal(false)]),
    scripting: z.union([componentConfigSchema, z.literal(false)]),
    layoutConfig: z.union([componentConfigSchema, z.literal(false)]),
    runtimeBehavior: z.union([componentConfigSchema, z.literal(false)]),
    physicalTable: z.union([componentConfigSchema.extend({ prefix: z.string().min(1) }), z.literal(false)])
})

const entityTypeUiSchema = z.object({
    iconName: z.string().min(1),
    tabs: z.array(z.string().min(1)).min(1),
    sidebarSection: z.enum(['objects', 'admin']),
    nameKey: z.string().min(1),
    descriptionKey: z.string().min(1).optional()
})

const baseTemplateManifestSchema = z.object({
    $schema: z.literal('metahub-template/v1'),
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
    seed: seedSchema
})

/**
 * Zod schema for MetahubTemplateManifest validation.
 * Used by TemplateSeeder to validate manifest data before inserting into DB.
 */
export const templateManifestSchema = baseTemplateManifestSchema.superRefine((manifest, ctx) => {
    if (semverToStructureVersion(manifest.minStructureVersion) > CURRENT_STRUCTURE_VERSION) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['minStructureVersion'],
            message: `Template requires structure version ${manifest.minStructureVersion}, but current platform supports only ${CURRENT_STRUCTURE_VERSION_SEMVER}`
        })
    }

    const layoutCodenameSet = new Set<string>()
    const layoutTemplateKeySet = new Set<string>()

    for (let i = 0; i < manifest.seed.layouts.length; i++) {
        const layout = manifest.seed.layouts[i]
        if (layoutCodenameSet.has(layout.codename)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'layouts', i, 'codename'],
                message: `Duplicate layout codename: ${layout.codename}`
            })
        }
        layoutCodenameSet.add(layout.codename)

        if (layoutTemplateKeySet.has(layout.templateKey)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'layouts', i, 'templateKey'],
                message: `Duplicate layout templateKey: ${layout.templateKey}`
            })
        }
        layoutTemplateKeySet.add(layout.templateKey)
    }

    for (const layoutCodename of Object.keys(manifest.seed.layoutZoneWidgets)) {
        if (!layoutCodenameSet.has(layoutCodename)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'layoutZoneWidgets', layoutCodename],
                message: `layoutZoneWidgets references unknown layout codename: ${layoutCodename}`
            })
        }
    }

    const entities = manifest.seed.entities ?? []
    const entityKeySet = new Set<string>()
    const entityByCodename = new Map<string, number>()
    const entityKindsByCodename = new Map<string, Set<string>>()
    const entityByKindCodename = new Set<string>()
    const setConstantsByEntityCodename = new Map<string, Set<string>>()

    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]
        const key = `${entity.kind}:${entity.codename}`
        if (entityKeySet.has(key)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'entities', i, 'codename'],
                message: `Duplicate entity identity: ${key}`
            })
        }
        entityKeySet.add(key)
        entityByKindCodename.add(key)
        entityByCodename.set(entity.codename, (entityByCodename.get(entity.codename) ?? 0) + 1)
        const kinds = entityKindsByCodename.get(entity.codename) ?? new Set<string>()
        kinds.add(entity.kind)
        entityKindsByCodename.set(entity.codename, kinds)

        const entityConstants = entity.constants ?? []
        if (entityConstants.length > 0 && entity.kind !== 'set') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'entities', i, 'constants'],
                message: `constants are supported only for entities with kind "set": ${entity.codename}`
            })
        }

        const seenConstantCodenames = new Set<string>()
        for (let constantIndex = 0; constantIndex < entityConstants.length; constantIndex++) {
            const constant = entityConstants[constantIndex]
            if (seenConstantCodenames.has(constant.codename)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['seed', 'entities', i, 'constants', constantIndex, 'codename'],
                    message: `Duplicate constant codename in set "${entity.codename}": ${constant.codename}`
                })
            }
            seenConstantCodenames.add(constant.codename)
        }

        if (entity.kind === 'set') {
            setConstantsByEntityCodename.set(entity.codename, seenConstantCodenames)
        }
    }

    const elementsByEntity = manifest.seed.elements ?? {}
    for (const entityCodename of Object.keys(elementsByEntity)) {
        const count = entityByCodename.get(entityCodename) ?? 0
        if (count === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'elements', entityCodename],
                message: `elements references unknown entity codename: ${entityCodename}`
            })
            continue
        }
        if (count > 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'elements', entityCodename],
                message: `elements reference is ambiguous for codename: ${entityCodename}. Provide unique codenames across entity kinds.`
            })
        }
    }

    const enumerationValuesByEntity = manifest.seed.enumerationValues ?? {}
    for (const [entityCodename, values] of Object.entries(enumerationValuesByEntity)) {
        const count = entityByCodename.get(entityCodename) ?? 0
        if (count === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'enumerationValues', entityCodename],
                message: `enumerationValues references unknown entity codename: ${entityCodename}`
            })
            continue
        }

        if (count > 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'enumerationValues', entityCodename],
                message: `enumerationValues reference is ambiguous for codename: ${entityCodename}. Provide unique codenames across entity kinds.`
            })
            continue
        }

        const kinds = entityKindsByCodename.get(entityCodename)
        if (!kinds?.has('enumeration')) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'enumerationValues', entityCodename],
                message: `enumerationValues can only target entities with kind "enumeration": ${entityCodename}`
            })
            continue
        }

        const seenValueCodenames = new Set<string>()
        for (let index = 0; index < values.length; index++) {
            const value = values[index]
            if (seenValueCodenames.has(value.codename)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['seed', 'enumerationValues', entityCodename, index, 'codename'],
                    message: `Duplicate enumeration value codename: ${value.codename}`
                })
            }
            seenValueCodenames.add(value.codename)
        }
    }

    for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]
        for (let attrIndex = 0; attrIndex < (entity.attributes?.length ?? 0); attrIndex++) {
            const attribute = entity.attributes?.[attrIndex]
            if (!attribute) continue

            const attrPath = ['seed', 'entities', i, 'attributes', attrIndex] as (string | number)[]
            const nestedAttributes = attribute.childAttributes ?? []

            const attributesToValidate: Array<{
                attribute: typeof attribute | (typeof nestedAttributes)[number]
                path: (string | number)[]
            }> = [{ attribute, path: attrPath }]

            for (let childIndex = 0; childIndex < nestedAttributes.length; childIndex++) {
                attributesToValidate.push({
                    attribute: nestedAttributes[childIndex],
                    path: [...attrPath, 'childAttributes', childIndex]
                })
            }

            for (const { attribute: attr, path } of attributesToValidate) {
                if (attr.targetEntityCodename) {
                    const hasTarget = attr.targetEntityKind
                        ? entityByKindCodename.has(`${attr.targetEntityKind}:${attr.targetEntityCodename}`)
                        : (entityByCodename.get(attr.targetEntityCodename) ?? 0) === 1

                    if (!hasTarget) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: [...path, 'targetEntityCodename'],
                            message: `Attribute target not found or ambiguous: ${attr.targetEntityCodename}`
                        })
                    }
                }

                if (attr.targetConstantCodename && attr.dataType !== 'REF') {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [...path, 'targetConstantCodename'],
                        message: 'targetConstantCodename is only supported for REF attributes'
                    })
                }

                if (!attr.targetConstantCodename && attr.targetEntityKind === 'set' && attr.dataType === 'REF') {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [...path, 'targetConstantCodename'],
                        message: 'REF attributes targeting set must define targetConstantCodename'
                    })
                }

                if (attr.targetConstantCodename && attr.targetEntityKind !== 'set') {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [...path, 'targetConstantCodename'],
                        message: 'targetConstantCodename requires targetEntityKind="set"'
                    })
                }

                if (attr.targetConstantCodename && !attr.targetEntityCodename) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: [...path, 'targetEntityCodename'],
                        message: 'targetEntityCodename is required when targetConstantCodename is provided'
                    })
                    continue
                }

                if (attr.targetConstantCodename && attr.targetEntityCodename) {
                    const targetSetConstants = setConstantsByEntityCodename.get(attr.targetEntityCodename)
                    if (!targetSetConstants || !targetSetConstants.has(attr.targetConstantCodename)) {
                        ctx.addIssue({
                            code: z.ZodIssueCode.custom,
                            path: [...path, 'targetConstantCodename'],
                            message: `Set constant not found: ${attr.targetEntityCodename}.${attr.targetConstantCodename}`
                        })
                    }
                }
            }
        }
    }
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
        components: componentManifestSchema,
        ui: entityTypeUiSchema,
        presentation: z.record(z.unknown()).optional(),
        config: z.record(z.unknown()).optional()
    })
})

export const entityTypePresetManifestSchema = entityTypePresetManifestSchemaBase.superRefine((manifest, ctx) => {
    if (semverToStructureVersion(manifest.minStructureVersion) > CURRENT_STRUCTURE_VERSION) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['minStructureVersion'],
            message: `Template requires structure version ${manifest.minStructureVersion}, but current platform supports only ${CURRENT_STRUCTURE_VERSION_SEMVER}`
        })
    }

    const dependencyErrors = validateComponentDependencies(manifest.entityType.components)
    for (const [index, error] of dependencyErrors.entries()) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['entityType', 'components', index],
            message: error
        })
    }
})

export type ValidatedManifest = z.infer<typeof templateManifestSchema>
export type ValidatedEntityTypePresetManifest = z.infer<typeof entityTypePresetManifestSchema>

/**
 * Validates a template manifest object against the Zod schema.
 * Returns the validated manifest or throws with details.
 */
export function validateTemplateManifest(manifest: unknown): ValidatedManifest {
    return templateManifestSchema.parse(manifest)
}

export function validateEntityTypePresetManifest(manifest: unknown): ValidatedEntityTypePresetManifest {
    return entityTypePresetManifestSchema.parse(manifest)
}
