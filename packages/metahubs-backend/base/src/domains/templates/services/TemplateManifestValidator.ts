import { z } from 'zod'
import {
    FIELD_DEFINITION_DATA_TYPES,
    validateComponentDependencies,
    FIXED_VALUE_DATA_TYPES,
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
const entityKindKeySchema = z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9._-]{0,63}$/, 'Kind key must be lowercase and start with a letter')

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

const seedScopedLayoutSchema = seedLayoutSchema.extend({
    baseLayoutCodename: z.string().min(1).max(100),
    scopeEntityCodename: z.string().min(1).max(100),
    scopeEntityKind: entityKindKeySchema.optional()
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

const templatePresetReferenceSchema = z.object({
    presetCodename: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/, 'Preset codename must be lowercase alphanumeric with hyphens'),
    includedByDefault: z.boolean().optional()
})

/** Schema for a child attribute inside a TABLE attribute (no nesting). */
const seedChildAttributeSchema = z.object({
    codename: z.string().min(1).max(100),
    dataType: z.enum(FIELD_DEFINITION_DATA_TYPES),
    name: vlcSchema,
    description: vlcSchema.optional(),
    isRequired: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    targetEntityCodename: z.string().optional(),
    targetEntityKind: entityKindKeySchema.optional(),
    targetConstantCodename: z.string().optional(),
    validationRules: z.record(z.unknown()).optional(),
    uiConfig: z.record(z.unknown()).optional()
})

const seedAttributeSchema = z.object({
    codename: z.string().min(1).max(100),
    dataType: z.enum(FIELD_DEFINITION_DATA_TYPES),
    name: vlcSchema,
    description: vlcSchema.optional(),
    isRequired: z.boolean().optional(),
    isDisplayAttribute: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    targetEntityCodename: z.string().optional(),
    targetEntityKind: entityKindKeySchema.optional(),
    targetConstantCodename: z.string().optional(),
    validationRules: z.record(z.unknown()).optional(),
    uiConfig: z.record(z.unknown()).optional(),
    /** Child attributes for TABLE data type (tabular parts). */
    childAttributes: z.array(seedChildAttributeSchema).optional()
})

const seedFixedValueSchema = z.object({
    codename: z.string().min(1).max(100),
    dataType: z.enum(FIXED_VALUE_DATA_TYPES),
    name: vlcSchema,
    description: vlcSchema.optional(),
    sortOrder: z.number().int().optional(),
    validationRules: z.record(z.unknown()).optional(),
    uiConfig: z.record(z.unknown()).optional(),
    value: z.unknown().optional()
})

const seedEntitySchema = z.object({
    codename: z.string().min(1).max(100),
    kind: entityKindKeySchema,
    name: vlcSchema,
    description: vlcSchema.optional(),
    localizeCodenameFromName: z.boolean().optional(),
    config: z.record(z.unknown()).optional(),
    attributes: z.array(seedAttributeSchema).optional(),
    fixedValues: z.array(seedFixedValueSchema).optional(),
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

const seedScriptSchema = z.object({
    codename: z.string().min(1).max(100),
    name: vlcSchema,
    description: vlcSchema.optional(),
    attachedToKind: entityKindKeySchema.or(z.literal('metahub')).or(z.literal('general')),
    attachedToEntityCodename: z.string().min(1).max(100).optional(),
    moduleRole: z.enum(['module', 'lifecycle', 'widget', 'library']),
    sourceKind: z.enum(['embedded', 'external', 'visual']).optional(),
    sdkApiVersion: z.string().optional(),
    sourceCode: z.string().min(1),
    capabilities: z
        .array(
            z.enum(['records.read', 'records.write', 'metadata.read', 'rpc.client', 'lifecycle', 'posting', 'ledger.read', 'ledger.write'])
        )
        .optional(),
    isActive: z.boolean().optional(),
    config: z.record(z.unknown()).optional()
})

const presetDefaultInstanceSchema = z.object({
    codename: z.string().min(1).max(100),
    name: vlcSchema,
    description: vlcSchema.optional(),
    localizeCodenameFromName: z.boolean().optional(),
    config: z.record(z.unknown()).optional(),
    attributes: z.array(seedAttributeSchema).optional(),
    fixedValues: z.array(seedFixedValueSchema).optional(),
    elements: z.array(seedElementSchema).optional(),
    optionValues: z.array(seedEnumerationValueSchema).optional(),
    hubs: z.array(z.string()).optional()
})

const seedSchema = z.object({
    layouts: z.array(seedLayoutSchema).min(1),
    scopedLayouts: z.array(seedScopedLayoutSchema).optional(),
    layoutZoneWidgets: z.record(z.array(seedZoneWidgetSchema)),
    settings: z.array(seedSettingSchema).optional(),
    entities: z.array(seedEntitySchema).optional(),
    elements: z.record(z.array(seedElementSchema)).optional(),
    optionValues: z.record(z.array(seedEnumerationValueSchema)).optional(),
    scripts: z.array(seedScriptSchema).optional()
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
    records: z.union([componentConfigSchema.extend({ maxElements: z.number().int().nullable().optional() }), z.literal(false)]),
    treeAssignment: z.union([
        componentConfigSchema.extend({
            isSingleHub: z.boolean().optional(),
            isRequiredHub: z.boolean().optional()
        }),
        z.literal(false)
    ]),
    optionValues: z.union([componentConfigSchema, z.literal(false)]),
    fixedValues: z.union([componentConfigSchema, z.literal(false)]),
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
    blockContent: z.union([
        componentConfigSchema.extend({
            storage: z.enum(['objectConfig', 'recordJsonb']),
            defaultFormat: z.literal('editorjs'),
            supportedFormats: z.array(z.string().min(1)).min(1),
            allowedBlockTypes: z.array(z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/)).min(1),
            maxBlocks: z.number().int().positive().max(5000)
        }),
        z.literal(false)
    ]),
    layoutConfig: z.union([componentConfigSchema, z.literal(false)]),
    runtimeBehavior: z.union([componentConfigSchema, z.literal(false)]),
    physicalTable: z.union([componentConfigSchema.extend({ prefix: z.string().min(1) }), z.literal(false)]),
    identityFields: z
        .union([
            componentConfigSchema.extend({
                allowNumber: z.boolean().optional(),
                allowEffectiveDate: z.boolean().optional()
            }),
            z.literal(false)
        ])
        .optional(),
    recordLifecycle: z
        .union([
            componentConfigSchema.extend({
                allowCustomStates: z.boolean().optional()
            }),
            z.literal(false)
        ])
        .optional(),
    posting: z
        .union([
            componentConfigSchema.extend({
                allowManualPosting: z.boolean().optional(),
                allowAutomaticPosting: z.boolean().optional()
            }),
            z.literal(false)
        ])
        .optional(),
    ledgerSchema: z
        .union([
            componentConfigSchema.extend({
                allowProjections: z.boolean().optional(),
                allowRegistrarPolicy: z.boolean().optional(),
                allowManualFacts: z.boolean().optional(),
                allowedModes: z.array(z.enum(['facts', 'balance', 'accounting', 'calculation'])).optional()
            }),
            z.literal(false)
        ])
        .optional()
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
                capability: z.enum(['dataSchema', 'fixedValues', 'optionValues']),
                routeSegment: z.string().min(1).max(64),
                title: vlcSchema.optional(),
                titleKey: z.string().min(1).optional(),
                fallbackTitle: z.string().min(1).optional()
            })
        )
        .optional()
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
    presets: z.array(templatePresetReferenceSchema).optional(),
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

    const scopedLayouts = manifest.seed.scopedLayouts ?? []
    for (let i = 0; i < scopedLayouts.length; i++) {
        const layout = scopedLayouts[i]
        if (layoutCodenameSet.has(layout.codename)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'scopedLayouts', i, 'codename'],
                message: `Duplicate layout codename: ${layout.codename}`
            })
        }
        layoutCodenameSet.add(layout.codename)

        if (!layoutCodenameSet.has(layout.baseLayoutCodename)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'scopedLayouts', i, 'baseLayoutCodename'],
                message: `Scoped layout references unknown base layout codename: ${layout.baseLayoutCodename}`
            })
        }
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

    const presetCodenameSet = new Set<string>()
    for (let index = 0; index < (manifest.presets?.length ?? 0); index++) {
        const preset = manifest.presets?.[index]
        if (!preset) continue
        if (presetCodenameSet.has(preset.presetCodename)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['presets', index, 'presetCodename'],
                message: `Duplicate preset reference: ${preset.presetCodename}`
            })
        }
        presetCodenameSet.add(preset.presetCodename)
    }

    const entities = manifest.seed.entities ?? []
    const entityKeySet = new Set<string>()
    const entityByCodename = new Map<string, number>()
    const entityKindsByCodename = new Map<string, Set<string>>()
    const entityByKindCodename = new Set<string>()
    const setFixedValuesByEntityCodename = new Map<string, Set<string>>()

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

        const entityFixedValues = entity.fixedValues ?? []
        if (entityFixedValues.length > 0 && entity.kind !== 'set') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'entities', i, 'fixedValues'],
                message: `constants are supported only for entities with kind "set": ${entity.codename}`
            })
        }

        const seenFixedValueCodenames = new Set<string>()
        for (let fixedValueIndex = 0; fixedValueIndex < entityFixedValues.length; fixedValueIndex++) {
            const fixedValue = entityFixedValues[fixedValueIndex]
            if (seenFixedValueCodenames.has(fixedValue.codename)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['seed', 'entities', i, 'fixedValues', fixedValueIndex, 'codename'],
                    message: `Duplicate constant codename in set "${entity.codename}": ${fixedValue.codename}`
                })
            }
            seenFixedValueCodenames.add(fixedValue.codename)
        }

        if (entity.kind === 'set') {
            setFixedValuesByEntityCodename.set(entity.codename, seenFixedValueCodenames)
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

    const optionValuesByEntity = manifest.seed.optionValues ?? {}
    for (const [entityCodename, values] of Object.entries(optionValuesByEntity)) {
        const count = entityByCodename.get(entityCodename) ?? 0
        if (count === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'optionValues', entityCodename],
                message: `optionValues references unknown entity codename: ${entityCodename}`
            })
            continue
        }

        if (count > 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'optionValues', entityCodename],
                message: `optionValues reference is ambiguous for codename: ${entityCodename}. Provide unique codenames across entity kinds.`
            })
            continue
        }

        const kinds = entityKindsByCodename.get(entityCodename)
        if (!kinds?.has('enumeration')) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'optionValues', entityCodename],
                message: `optionValues can only target entities with kind "enumeration": ${entityCodename}`
            })
            continue
        }

        const seenValueCodenames = new Set<string>()
        for (let index = 0; index < values.length; index++) {
            const value = values[index]
            if (seenValueCodenames.has(value.codename)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['seed', 'optionValues', entityCodename, index, 'codename'],
                    message: `Duplicate enumeration value codename: ${value.codename}`
                })
            }
            seenValueCodenames.add(value.codename)
        }
    }

    for (let index = 0; index < scopedLayouts.length; index += 1) {
        const layout = scopedLayouts[index]
        const hasTarget = layout.scopeEntityKind
            ? entityByKindCodename.has(`${layout.scopeEntityKind}:${layout.scopeEntityCodename}`)
            : (entityByCodename.get(layout.scopeEntityCodename) ?? 0) === 1

        if (!hasTarget) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'scopedLayouts', index, 'scopeEntityCodename'],
                message: `Scoped layout target not found or ambiguous: ${layout.scopeEntityCodename}`
            })
        }
    }

    const scripts = manifest.seed.scripts ?? []
    const scriptKeySet = new Set<string>()
    for (let index = 0; index < scripts.length; index += 1) {
        const script = scripts[index]
        const scopeKey = `${script.attachedToKind}:${script.attachedToEntityCodename ?? ''}:${script.moduleRole}:${script.codename}`
        if (scriptKeySet.has(scopeKey)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['seed', 'scripts', index, 'codename'],
                message: `Duplicate script identity: ${scopeKey}`
            })
        }
        scriptKeySet.add(scopeKey)

        if (script.attachedToKind !== 'metahub' && script.attachedToKind !== 'general') {
            const targetCodename = script.attachedToEntityCodename
            if (!targetCodename) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['seed', 'scripts', index, 'attachedToEntityCodename'],
                    message: `Script attached to ${script.attachedToKind} must declare attachedToEntityCodename`
                })
                continue
            }

            if (!entityByKindCodename.has(`${script.attachedToKind}:${targetCodename}`)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['seed', 'scripts', index, 'attachedToEntityCodename'],
                    message: `Script references unknown ${script.attachedToKind} entity codename: ${targetCodename}`
                })
            }
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
                    const targetSetConstants = setFixedValuesByEntityCodename.get(attr.targetEntityCodename)
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
    }),
    defaultInstances: z.array(presetDefaultInstanceSchema).optional()
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

    const resourceSurfaceKeyPattern = /^[a-z][a-zA-Z0-9._-]{0,63}$/
    const resourceSurfaceRoutePattern = /^[a-z][a-z0-9-]{0,63}$/
    const seenResourceSurfaceKeys = new Set<string>()
    const seenResourceSurfaceCapabilities = new Set<string>()
    const seenResourceSurfaceRouteSegments = new Set<string>()
    for (const [index, surface] of (manifest.entityType.ui.resourceSurfaces ?? []).entries()) {
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

        if (manifest.entityType.components[surface.capability] === false) {
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

        if (instance.attributes?.length && manifest.entityType.components.dataSchema === false) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultInstances', index, 'attributes'],
                message: 'Default instance attributes require the dataSchema component'
            })
        }

        if (instance.fixedValues?.length && manifest.entityType.components.fixedValues === false) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultInstances', index, 'fixedValues'],
                message: 'Default instance constants require the constants component'
            })
        }

        if (instance.elements?.length && manifest.entityType.components.records === false) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultInstances', index, 'elements'],
                message: 'Default instance elements require the records component'
            })
        }

        if (instance.optionValues?.length && manifest.entityType.components.optionValues === false) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultInstances', index, 'optionValues'],
                message: 'Default instance optionValues require the optionValues component'
            })
        }

        if (instance.hubs?.length && manifest.entityType.components.treeAssignment === false) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['defaultInstances', index, 'hubs'],
                message: 'Default instance hub references require the treeAssignment component'
            })
        }
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
