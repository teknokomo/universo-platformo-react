import { z } from 'zod'
import {
    ATTRIBUTE_DATA_TYPES,
    META_ENTITY_KINDS,
    DASHBOARD_LAYOUT_ZONES,
    DASHBOARD_LAYOUT_WIDGETS,
    DashboardLayoutWidgetKey
} from '@universo/types'

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
    config: z.record(z.unknown()).optional()
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

const seedSchema = z.object({
    layouts: z.array(seedLayoutSchema).min(1),
    layoutZoneWidgets: z.record(z.array(seedZoneWidgetSchema)),
    settings: z.array(seedSettingSchema).optional(),
    entities: z.array(seedEntitySchema).optional(),
    elements: z.record(z.array(seedElementSchema)).optional()
})

const templateMetaSchema = z.object({
    author: z.string().optional(),
    tags: z.array(z.string()).optional(),
    icon: z.string().optional(),
    previewUrl: z.string().optional()
})

/**
 * Zod schema for MetahubTemplateManifest validation.
 * Used by TemplateSeeder to validate manifest data before inserting into DB.
 */
export const templateManifestSchema = z.object({
    $schema: z.literal('metahub-template/v1'),
    codename: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Codename must be lowercase alphanumeric with hyphens'),
    version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be SemVer (e.g., 1.0.0)'),
    minStructureVersion: z.number().int().positive(),
    name: vlcSchema,
    description: vlcSchema.optional(),
    meta: templateMetaSchema.optional(),
    seed: seedSchema
})

export type ValidatedManifest = z.infer<typeof templateManifestSchema>

/**
 * Validates a template manifest object against the Zod schema.
 * Returns the validated manifest or throws with details.
 */
export function validateTemplateManifest(manifest: unknown): ValidatedManifest {
    return templateManifestSchema.parse(manifest)
}
