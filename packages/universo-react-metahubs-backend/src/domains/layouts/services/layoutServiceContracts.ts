import { z } from 'zod'
import {
    DASHBOARD_LAYOUT_ZONES,
    LAYOUT_WIDGET_DEFINITIONS,
    MARKETING_LAYOUT_ZONES,
    getLayoutWidgetDefinition,
    decodeLayoutConfigEnvelope,
    decodeWidgetConfigEnvelope,
    encodeLayoutConfigEnvelope,
    getLayoutZoneSettingDefault,
    RESERVED_LAYOUT_METADATA_KEY,
    applicationLayoutWidgetKeySchema,
    applicationLayoutZoneSchema,
    layoutInstanceKeySchema,
    type ApplicationLayoutWidgetKey,
    type ApplicationLayoutZone,
    type LayoutLogicalPlacement,
    applicationTemplateKeySchema,
    type ApplicationTemplateKey,
    type LayoutWidgetDefinition,
    type PersistedLayoutNeutralMetadata,
    type VersionedLocalizedContent
} from '@universo-react/types'
import { uuidV7Schema } from '@universo-react/utils'
import { requireLayoutWidgetOwnership, resolveLayoutWidgetPlacementPolicy, type LayoutWidgetPlacementPolicy } from '../widgetOwnership'
export type LayoutTemplateKey = ApplicationTemplateKey

export interface MetahubLayoutRow {
    id: string
    scopeEntityId: string | null
    baseLayoutId: string | null
    templateKey: LayoutTemplateKey
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    config: Record<string, unknown>
    neutral: PersistedLayoutNeutralMetadata
    isActive: boolean
    isDefault: boolean
    sortOrder: number
    version: number
    createdAt: string
    updatedAt: string
}

export interface LayoutZoneWidgetRow {
    id: string
    layoutId: string
    zone: ApplicationLayoutZone
    widgetKey: ApplicationLayoutWidgetKey
    instanceKey: string
    parentInstanceKey: string | null
    slotKey: string | null
    placementPolicy: LayoutWidgetPlacementPolicy
    sortOrder: number
    config: Record<string, unknown>
    placement?: LayoutLogicalPlacement
    isActive: boolean
    isInherited?: boolean
    isOverridden?: boolean
    version: number
    createdAt: string
    updatedAt: string
}

export interface LayoutWidgetScopeVisibilityRow {
    scopeEntityId: string
    kind: string
    codename: unknown
    name: unknown
    layoutId: string | null
    layoutName: unknown
    version: number
    isVisible: boolean
    isOverridden: boolean
}

export interface LayoutListOptions {
    limit?: number
    offset?: number
    sortBy?: 'name' | 'created' | 'updated'
    sortOrder?: 'asc' | 'desc'
    search?: string
    scopeEntityId?: string
    includeDeleted?: boolean
}

export type DbRow = Record<string, unknown>

export type ZoneSortOrderRow = {
    id: string
    sort_order?: number
}

export type ZoneWidgetConfigRow = {
    widget_key: unknown
    zone: unknown
    is_active?: boolean
}

export type LayoutScopeRow = {
    id: string
    scope_entity_id?: string | null
    base_layout_id?: string | null
    template_key?: unknown
    config?: unknown
    version?: number
}

export type LayoutWidgetOverrideDbRow = {
    id: string
    layout_id: string
    base_widget_id: string
    zone?: unknown
    sort_order?: unknown
    config?: unknown
    is_active?: unknown
    is_deleted_override?: unknown
    _upl_created_at?: unknown
    _upl_updated_at?: unknown
    _upl_version?: unknown
}

export type ScopeEntityComponentRow = {
    id: string
    kind: string
    capabilities?: unknown
}

export type LayoutCapableScopeEntityRow = ScopeEntityComponentRow & {
    codename?: unknown
    presentation?: unknown
    config?: unknown
}

export type ResolvedLayoutWidgetState = {
    id: string
    layoutId: string
    templateKey: LayoutTemplateKey
    widgetKey: ApplicationLayoutWidgetKey
    instanceKey: string
    parentWidgetId: string | null
    parentInstanceKey: string | null
    slotKey: string | null
    zone: ApplicationLayoutZone
    sortOrder: number
    config: Record<string, unknown>
    isActive: boolean
    createdAt: string
    updatedAt: string
    isInherited: boolean
    isOverridden: boolean
    baseWidgetId: string | null
    baseZone: ApplicationLayoutZone | null
    baseSortOrder: number | null
    baseIsActive: boolean | null
    baseVersion?: number
    version: number
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const resolveWidgetPlacementOverridePolicy = (
    templateKey: LayoutTemplateKey,
    widgetKey: ApplicationLayoutWidgetKey,
    config: Record<string, unknown>
) => {
    const definition = requireLayoutWidgetOwnership(templateKey, widgetKey, config)
    return resolveLayoutWidgetPlacementPolicy(definition)
}

export const layoutTemplateKeySchema = applicationTemplateKeySchema
export const layoutZoneSchema = applicationLayoutZoneSchema
export const layoutWidgetKeySchema = applicationLayoutWidgetKeySchema

export const LAYOUT_ZONES_BY_TEMPLATE: Readonly<Record<LayoutTemplateKey, readonly ApplicationLayoutZone[]>> = {
    dashboard: DASHBOARD_LAYOUT_ZONES,
    'marketing-page': MARKETING_LAYOUT_ZONES
}

export const getWidgetDefinition = (widgetKey: ApplicationLayoutWidgetKey): LayoutWidgetDefinition | undefined =>
    LAYOUT_WIDGET_DEFINITIONS.find((widget) => widget.key === widgetKey)

export const rendererConfigInputSchema = z.record(z.string(), z.unknown()).superRefine((value, context) => {
    if (Object.prototype.hasOwnProperty.call(value, RESERVED_LAYOUT_METADATA_KEY)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [RESERVED_LAYOUT_METADATA_KEY],
            message: 'Reserved layout metadata must be changed through the dedicated layout API.'
        })
    }
})
export const rejectSharedBehaviorConfig = (value: Record<string, unknown>, context: z.RefinementCtx): void => {
    if (Object.prototype.hasOwnProperty.call(value, 'sharedBehavior')) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['sharedBehavior'],
            message: 'Widget placement policy must be changed through placement metadata.'
        })
    }
}
export const widgetRendererConfigInputSchema = rendererConfigInputSchema.superRefine(rejectSharedBehaviorConfig)
export const widgetAssignmentConfigInputSchema = z.record(z.string(), z.unknown()).superRefine(rejectSharedBehaviorConfig)

export const layoutZoneSettingKeySchema = z.string().trim().min(1).max(128)
export const layoutZoneSettingValueSchema = z.string().trim().min(1).max(128)

export const updateLayoutZoneSettingSchema = z
    .object({
        zone: layoutZoneSchema,
        settingKey: layoutZoneSettingKeySchema,
        value: layoutZoneSettingValueSchema,
        expectedVersion: z.number().int().positive()
    })
    .strict()

export const resetLayoutZoneSettingSchema = z
    .object({
        zone: layoutZoneSchema,
        settingKey: layoutZoneSettingKeySchema,
        expectedVersion: z.number().int().positive()
    })
    .strict()

export const decodeLayoutForStorage = (templateKey: LayoutTemplateKey, config: unknown) =>
    decodeLayoutConfigEnvelope(config, { templateKey, allowSourceZoneSettings: false })

export const decodeWidgetForStorage = (
    templateKey: LayoutTemplateKey,
    widgetKey: ApplicationLayoutWidgetKey,
    zone: ApplicationLayoutZone,
    config: unknown
) => decodeWidgetConfigEnvelope(config ?? {}, { templateKey, widgetKey, zone, requireBindings: true })

export const withIndependentLayoutComposition = (
    templateKey: LayoutTemplateKey,
    config: unknown,
    options: { materializeDefaults?: boolean } = {}
): Record<string, unknown> => {
    const decoded = decodeLayoutForStorage(templateKey, config)
    const neutral = {
        ...decoded.neutral,
        composition: { mode: 'independent' as const, baseLayoutId: null }
    }
    if (options.materializeDefaults !== false && templateKey === 'marketing-page') {
        neutral.zoneSettings = {
            ...(neutral.zoneSettings ?? {}),
            'marketing-header': {
                ...(neutral.zoneSettings?.['marketing-header'] ?? {}),
                position:
                    neutral.zoneSettings?.['marketing-header']?.position ??
                    ((getLayoutZoneSettingDefault(templateKey, 'marketing-header', 'position') ?? 'fixed') as 'fixed' | 'flow')
            }
        }
    }
    return encodeLayoutConfigEnvelope({ rendererConfig: decoded.rendererConfig, neutral }, { templateKey })
}

export const withOverlayLayoutComposition = (
    templateKey: LayoutTemplateKey,
    config: unknown,
    baseLayoutId: string
): Record<string, unknown> => {
    const decoded = decodeLayoutForStorage(templateKey, config)
    if (!uuidV7Schema.safeParse(baseLayoutId).success) throw new Error('APPLICATION_LAYOUT_COMPOSITION_INVALID')
    const neutral = {
        ...decoded.neutral,
        composition: { mode: 'overlay' as const, baseLayoutId }
    }
    return encodeLayoutConfigEnvelope({ rendererConfig: decoded.rendererConfig, neutral }, { templateKey })
}

export const patchSparseZoneSetting = (
    templateKey: LayoutTemplateKey,
    config: unknown,
    zone: ApplicationLayoutZone,
    settingKey: string,
    value: string | undefined
): Record<string, unknown> => {
    const decoded = decodeLayoutForStorage(templateKey, config)
    const zoneSettings = { ...(decoded.neutral.zoneSettings ?? {}) }
    const currentZoneSettings = { ...(zoneSettings[zone] ?? {}) } as Record<string, unknown>
    if (value === undefined) {
        delete currentZoneSettings[settingKey]
    } else {
        currentZoneSettings[settingKey] = value
    }

    if (Object.keys(currentZoneSettings).length === 0) delete zoneSettings[zone]
    else zoneSettings[zone] = currentZoneSettings as never

    const neutral = { ...decoded.neutral }
    if (Object.keys(zoneSettings).length === 0) delete neutral.zoneSettings
    else neutral.zoneSettings = zoneSettings
    return encodeLayoutConfigEnvelope({ rendererConfig: decoded.rendererConfig, neutral }, { templateKey })
}

export const createLayoutSchema = z
    .object({
        scopeEntityId: uuidV7Schema.optional(),
        baseLayoutId: uuidV7Schema.optional(),
        // Omitted keys inherit the base layout for scoped layouts and default to
        // dashboard only for a new global layout. Keeping this optional prevents
        // an omitted value from silently changing a marketing layout into a
        // dashboard when a scoped layout is created from it.
        templateKey: layoutTemplateKeySchema.optional(),
        name: z.any(),
        description: z.any().optional().nullable(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        config: rendererConfigInputSchema.optional()
    })
    .strict()

export const updateLayoutSchema = z
    .object({
        templateKey: layoutTemplateKeySchema.optional(),
        name: z.any().optional(),
        description: z.any().optional().nullable(),
        namePrimaryLocale: z.string().optional(),
        descriptionPrimaryLocale: z.string().optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
        config: rendererConfigInputSchema.optional(),
        expectedVersion: z.number().int().positive()
    })
    .strict()

export const assignLayoutZoneWidgetSchema = z
    .object({
        zone: layoutZoneSchema,
        widgetKey: layoutWidgetKeySchema,
        sortOrder: z.number().int().positive().optional(),
        parentInstanceKey: layoutInstanceKeySchema.optional(),
        slotKey: z
            .string()
            .trim()
            .min(1)
            .max(96)
            .regex(/^[A-Za-z][A-Za-z0-9._:-]*$/u)
            .optional(),
        config: widgetAssignmentConfigInputSchema.optional(),
        expectedVersion: z.number().int().positive()
    })
    .strict()
    .superRefine((value, context) => {
        const definition = getLayoutWidgetDefinition(value.widgetKey, value.config)
        if (definition?.sourcePolicy.sourceMode === 'required' && value.config === undefined) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['config'],
                message: 'A complete binding configuration is required for this widget.'
            })
        }
        if ((value.parentInstanceKey === undefined) !== (value.slotKey === undefined)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['slotKey'],
                message: 'Nested placement requires both a parent and a slot.'
            })
        }
        if (value.config === undefined) return
        const templateKey = (['dashboard', 'marketing-page'] as const).find((key) =>
            definition?.allowedZonesByTemplate[key]?.includes(value.zone)
        )
        if (!definition || !templateKey) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['config'],
                message: 'Widget configuration context is invalid.'
            })
            return
        }
        try {
            decodeWidgetConfigEnvelope(value.config, {
                templateKey,
                widgetKey: value.widgetKey,
                zone: value.zone,
                requireBindings: definition.sourcePolicy.sourceMode === 'required'
            })
        } catch {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['config'],
                message: 'Widget configuration is invalid.'
            })
        }
    })

export const moveLayoutZoneWidgetSchema = z
    .object({
        widgetId: uuidV7Schema,
        targetZone: layoutZoneSchema.optional(),
        targetIndex: z.number().int().min(0).optional(),
        targetParentInstanceKey: layoutInstanceKeySchema.optional(),
        targetSlotKey: z
            .string()
            .trim()
            .min(1)
            .max(96)
            .regex(/^[A-Za-z][A-Za-z0-9._:-]*$/u)
            .optional(),
        expectedVersion: z.number().int().positive()
    })
    .strict()
    .superRefine((value, context) => {
        if ((value.targetParentInstanceKey === undefined) !== (value.targetSlotKey === undefined)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['targetSlotKey'],
                message: 'Reparenting requires both a parent and a slot.'
            })
        }
    })

export const duplicateLayoutZoneWidgetSchema = z
    .object({
        widgetId: uuidV7Schema,
        expectedVersion: z.number().int().positive(),
        expectedLayoutVersion: z.number().int().positive()
    })
    .strict()

export const updateLayoutZoneWidgetConfigSchema = z
    .object({
        config: widgetRendererConfigInputSchema,
        expectedVersion: z.number().int().positive()
    })
    .strict()

export const toggleLayoutZoneWidgetActiveSchema = z
    .object({
        isActive: z.boolean(),
        expectedVersion: z.number().int().positive()
    })
    .strict()
