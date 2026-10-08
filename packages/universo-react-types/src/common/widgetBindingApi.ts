import { z } from 'zod'
import { uuidV7Schema } from './applicationLayouts'
import { MAX_WIDGET_BINDING_SLOTS, widgetBindingVariantKeySchema, type WidgetBindingSelector } from './widgetBindings'

/** Semantic Object codename used by the widget-binding HTTP contract. */
export const widgetBindingSourceKeySchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u, 'Expected a semantic source key.')

export const marketingWidgetRecordCopyIntentSchema = z
    .object({
        entityId: uuidV7Schema,
        recordId: uuidV7Schema,
        sourceKey: widgetBindingSourceKeySchema,
        sourceSemanticKey: z.string().trim().min(1).max(128),
        slot: z.string().trim().min(1).max(64)
    })
    .strict()

export const widgetBindingSelectorInputSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('semantic-key'), value: z.string().trim().min(1).max(128) }).strict(),
    z.object({ kind: z.literal('record-set') }).strict(),
    z.object({ kind: z.literal('relation-set') }).strict()
])

export const widgetBindingSelectionInputSchema = z
    .object({
        slot: z.string().trim().min(1).max(64),
        sourceKey: widgetBindingSourceKeySchema,
        selector: widgetBindingSelectorInputSchema
    })
    .strict()

const containsControlCharacter = (value: string): boolean => {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        if (code <= 0x1f || code === 0x7f) return true
    }
    return false
}

export const widgetBindingSourceProvisionPayloadSchema = z
    .object({
        variant: widgetBindingVariantKeySchema.optional(),
        locale: z.string().trim().min(2).max(16).default('en'),
        templateSourceKey: widgetBindingSourceKeySchema,
        parentSourceKey: widgetBindingSourceKeySchema.optional(),
        name: z
            .string()
            .trim()
            .min(1)
            .max(128)
            .refine((value) => !containsControlCharacter(value), 'Source name contains unsupported characters.')
    })
    .strict()

export const replaceLayoutZoneWidgetBindingsInputSchema = z
    .object({
        bindings: z.array(widgetBindingSelectionInputSchema).max(MAX_WIDGET_BINDING_SLOTS),
        locale: z.string().trim().min(2).max(16).optional(),
        rendererConfig: z.record(z.string(), z.unknown()).optional(),
        expectedVersion: z.number().int().positive()
    })
    .strict()

export type WidgetBindingSelectorInput = z.infer<typeof widgetBindingSelectorInputSchema>
export type MarketingWidgetRecordCopyIntent = z.infer<typeof marketingWidgetRecordCopyIntentSchema>
export type WidgetBindingSelectionInput = z.infer<typeof widgetBindingSelectionInputSchema>
export type WidgetBindingSourceProvisionInput = z.input<typeof widgetBindingSourceProvisionPayloadSchema>
export type ReplaceLayoutZoneWidgetBindingsInput = z.infer<typeof replaceLayoutZoneWidgetBindingsInputSchema>
export type WidgetBindingSelectorKind = WidgetBindingSelector['kind']

export interface WidgetBindingSourceOption {
    /** Stable semantic Object codename; never a physical database identifier. */
    readonly sourceKey: string
    readonly label: string
    readonly recordsCount: number
    readonly selectorKinds: readonly WidgetBindingSelectorKind[]
}

export interface WidgetBindingSelectedSourceOption extends WidgetBindingSourceOption {
    readonly compatible: boolean
}

export interface WidgetBindingSourcesDto {
    readonly widgetKey: string
    readonly slot: string
    readonly selectorKinds: readonly WidgetBindingSelectorKind[]
    readonly sources: readonly WidgetBindingSourceOption[]
    readonly selectedSource?: WidgetBindingSelectedSourceOption | null
    readonly nextOffset: number | null
    readonly truncated: boolean
}

export interface WidgetBindingRecordOption {
    /** Registry-owned semantic key; physical record UUIDs never cross this boundary. */
    readonly semanticKey: string
    readonly label: string
}

export interface WidgetBindingRecordsDto {
    readonly widgetKey: string
    readonly slot: string
    readonly sourceKey: string
    readonly records: readonly WidgetBindingRecordOption[]
    readonly selectedRecord?: WidgetBindingRecordOption | null
    readonly nextOffset: number | null
    readonly truncated: boolean
}

export interface WidgetBindingReadItem {
    readonly slot: string
    readonly sourceKey: string
    readonly sourceName: string
    readonly selectorKind: WidgetBindingSelectorKind
    readonly selectionLabel: string
    readonly semanticKey?: string
}

export interface WidgetBindingReadDto {
    readonly widgetKey: string
    readonly version: number
    readonly bindings: readonly WidgetBindingReadItem[]
}

export interface ReplaceLayoutZoneWidgetBindingsResult {
    readonly widgetKey: string
    readonly version: number
}

export interface WidgetBindingSourceProvisionResult {
    readonly widgetKey: string
    readonly slot: string
    readonly source: WidgetBindingSourceOption
}
