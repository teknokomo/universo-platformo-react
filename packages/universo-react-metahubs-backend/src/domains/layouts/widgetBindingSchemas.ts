import {
    marketingCollectionVariantSchema,
    marketingWidgetKeySchema,
    replaceLayoutZoneWidgetBindingsInputSchema,
    widgetBindingSelectionInputSchema,
    widgetBindingSelectorInputSchema,
    widgetBindingSourceKeySchema,
    widgetBindingSourceProvisionPayloadSchema,
    type MarketingWidgetKey,
    type WidgetBindingSlotDefinition
} from '@universo-react/types'
import { z } from 'zod'
import { uuidV7Schema } from '@universo-react/utils'
import type { DbExecutor, SqlQueryable } from '@universo-react/utils/database'
import type { BindingObjectRow } from './widgetBindingsStore'

export const sourceKeySchema = widgetBindingSourceKeySchema
export { widgetBindingSelectionInputSchema, widgetBindingSelectorInputSchema }
export const MAX_WIDGET_BINDING_OFFSET = 10000
export const normalizedSearchInputSchema = z
    .preprocess(
        (value) => (typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ') : value),
        z.string().max(128).optional()
    )
    .transform((value) => value || undefined)
export const updateLayoutZoneWidgetBindingSchema = replaceLayoutZoneWidgetBindingsInputSchema
export const recordPageInputSchema = z
    .object({
        layoutId: uuidV7Schema,
        widgetId: uuidV7Schema,
        slot: z.string().trim().min(1).max(64),
        widgetKey: marketingWidgetKeySchema.optional(),
        variant: marketingCollectionVariantSchema.optional(),
        sourceKey: sourceKeySchema,
        locale: z.string().trim().min(2).max(16).default('en'),
        offset: z.number().int().min(0).max(MAX_WIDGET_BINDING_OFFSET).default(0),
        search: normalizedSearchInputSchema,
        selectedSemanticKey: z.string().trim().min(1).max(128).optional()
    })
    .strict()
export const sourcePageInputSchema = z
    .object({
        layoutId: uuidV7Schema,
        widgetId: uuidV7Schema,
        slot: z.string().trim().min(1).max(64),
        widgetKey: marketingWidgetKeySchema.optional(),
        variant: marketingCollectionVariantSchema.optional(),
        locale: z.string().trim().min(2).max(16).default('en'),
        offset: z.number().int().min(0).max(MAX_WIDGET_BINDING_OFFSET).default(0),
        search: normalizedSearchInputSchema,
        parentSourceKey: sourceKeySchema.optional(),
        selectedSourceKey: sourceKeySchema.optional()
    })
    .strict()
export const readBindingInputSchema = z
    .object({
        layoutId: uuidV7Schema,
        widgetId: uuidV7Schema,
        locale: z.string().trim().min(2).max(16).default('en')
    })
    .strict()
export const discoveryPageInputShape = z
    .object({
        layoutId: uuidV7Schema,
        templateKey: z.literal('marketing-page'),
        widgetKey: marketingWidgetKeySchema,
        slot: z.string().trim().min(1).max(64),
        variant: marketingCollectionVariantSchema.optional(),
        locale: z.string().trim().min(2).max(16).default('en'),
        offset: z.number().int().min(0).max(MAX_WIDGET_BINDING_OFFSET).default(0),
        search: normalizedSearchInputSchema,
        parentSourceKey: sourceKeySchema.optional(),
        selectedSourceKey: sourceKeySchema.optional()
    })
    .strict()
const validateDiscoveryVariant = (
    input: { widgetKey: MarketingWidgetKey; variant?: z.infer<typeof marketingCollectionVariantSchema> },
    issueContext: z.RefinementCtx
): void => {
    if (input.widgetKey === 'marketing.collection' && input.variant === undefined) {
        issueContext.addIssue({ code: z.ZodIssueCode.custom, path: ['variant'], message: 'A collection variant is required.' })
    }
    if (input.widgetKey !== 'marketing.collection' && input.variant !== undefined) {
        issueContext.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['variant'],
            message: 'This widget does not support a collection variant.'
        })
    }
}
export const discoverSourcePageInputSchema = discoveryPageInputShape.superRefine(validateDiscoveryVariant)
export const discoverRecordPageInputSchema = discoveryPageInputShape
    .extend({ sourceKey: sourceKeySchema, selectedSemanticKey: z.string().trim().min(1).max(128).optional() })
    .superRefine(validateDiscoveryVariant)
export { widgetBindingSourceProvisionPayloadSchema }
export const provisionSourceInputSchema = z
    .object({
        layoutId: uuidV7Schema,
        templateKey: z.literal('marketing-page'),
        widgetKey: marketingWidgetKeySchema,
        slot: z.string().trim().min(1).max(64),
        variant: marketingCollectionVariantSchema.optional(),
        locale: z.string().trim().min(2).max(16).default('en'),
        templateSourceKey: sourceKeySchema,
        parentSourceKey: sourceKeySchema.optional(),
        name: widgetBindingSourceProvisionPayloadSchema.shape.name
    })
    .strict()
    .superRefine(validateDiscoveryVariant)

/** Pass the executor returned by getRequestDbExecutor for this request. */
export interface WidgetBindingRequestContext {
    readonly executor: DbExecutor
    readonly metahubId: string
    readonly userId?: string | null
}

export interface WidgetBindingSourceProvisionRequest {
    readonly db: SqlQueryable
    readonly metahubId: string
    readonly userId?: string | null
    readonly schemaName: string
    readonly templateSource: BindingObjectRow
    readonly slot: WidgetBindingSlotDefinition
    readonly name: string
    readonly locale: string
    readonly parentObject?: BindingObjectRow
}

export type WidgetBindingSourceProvisioner = (
    input: WidgetBindingSourceProvisionRequest
) => Promise<{ readonly sourceKey: string; readonly label: string; readonly recordsCount: number }>

export type {
    ReplaceLayoutZoneWidgetBindingsInput,
    ReplaceLayoutZoneWidgetBindingsResult,
    WidgetBindingReadDto,
    WidgetBindingReadItem,
    WidgetBindingRecordOption,
    WidgetBindingRecordsDto,
    WidgetBindingSelectedSourceOption,
    WidgetBindingSelectionInput,
    WidgetBindingSelectorInput,
    WidgetBindingSourceOption,
    WidgetBindingSourceProvisionInput,
    WidgetBindingSourceProvisionResult,
    WidgetBindingSourcesDto
} from '@universo-react/types'
