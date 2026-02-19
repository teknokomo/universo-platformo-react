import { z } from 'zod'
import {
    ATTRIBUTE_DATA_TYPES,
    META_ENTITY_KINDS,
    DASHBOARD_LAYOUT_ZONES,
    DASHBOARD_LAYOUT_WIDGETS,
    DashboardLayoutWidgetKey
} from '@universo/types'
import { CURRENT_STRUCTURE_VERSION } from '../../metahubs/services/structureVersions'

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
    validationRules: z.record(z.unknown()).optional(),
    uiConfig: z.record(z.unknown()).optional()
})

const seedEntitySchema = z.object({
    codename: z.string().min(1).max(100),
    kind: z.enum(META_ENTITY_KINDS),
    name: vlcSchema,
    description: vlcSchema.optional(),
    config: z.record(z.unknown()).optional(),
    attributes: z.array(seedAttributeSchema).optional(),
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

const baseTemplateManifestSchema = z.object({
    $schema: z.literal('metahub-template/v1'),
    codename: z
        .string()
        .min(1)
        .max(100)
        .regex(/^[a-z0-9-]+$/, 'Codename must be lowercase alphanumeric with hyphens'),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be SemVer (e.g., 1.0.0)'),
    minStructureVersion: z.number().int().positive(),
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
    if (manifest.minStructureVersion > CURRENT_STRUCTURE_VERSION) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['minStructureVersion'],
            message: `Template requires structure version ${manifest.minStructureVersion}, but current platform supports only ${CURRENT_STRUCTURE_VERSION}`
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
            if (!attribute?.targetEntityCodename) {
                continue
            }

            const hasTarget = attribute.targetEntityKind
                ? entityByKindCodename.has(`${attribute.targetEntityKind}:${attribute.targetEntityCodename}`)
                : (entityByCodename.get(attribute.targetEntityCodename) ?? 0) === 1

            if (!hasTarget) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['seed', 'entities', i, 'attributes', attrIndex, 'targetEntityCodename'],
                    message: `Attribute target not found or ambiguous: ${attribute.targetEntityCodename}`
                })
            }
        }
    }
})

export type ValidatedManifest = z.infer<typeof templateManifestSchema>

/**
 * Validates a template manifest object against the Zod schema.
 * Returns the validated manifest or throws with details.
 */
export function validateTemplateManifest(manifest: unknown): ValidatedManifest {
    return templateManifestSchema.parse(manifest)
}
