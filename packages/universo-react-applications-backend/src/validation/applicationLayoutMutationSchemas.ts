import { z } from 'zod'
import {
    applicationLayoutConfigResetMutationSchema,
    applicationLayoutCopyMutationSchema,
    applicationLayoutCreateSchema,
    applicationLayoutUpdateSchema,
    applicationLayoutWidgetConfigMutationSchema,
    applicationLayoutWidgetMoveMutationSchema,
    applicationLayoutWidgetMutationSchema,
    applicationLayoutWidgetResetBatchMutationSchema,
    applicationLayoutWidgetToggleMutationSchema,
    uuidV7Schema
} from '@universo-react/types'

/**
 * The shared type schemas predate the backend request boundary and several
 * widget mutations are intentionally non-strict there. Keep the public type
 * contract unchanged while making backend mutation envelopes reject unknown
 * fields instead of silently dropping them.
 */
export const strictApplicationLayoutCreateSchema = applicationLayoutCreateSchema.strict()
export const strictApplicationLayoutUpdateSchema = applicationLayoutUpdateSchema.strict()
export const strictApplicationLayoutConfigResetMutationSchema = applicationLayoutConfigResetMutationSchema.strict()
export const strictApplicationLayoutCopyMutationSchema = applicationLayoutCopyMutationSchema.strict()
export const strictApplicationLayoutWidgetMutationSchema = applicationLayoutWidgetMutationSchema.strict()
export const strictApplicationLayoutWidgetConfigMutationSchema = applicationLayoutWidgetConfigMutationSchema.strict()
export const strictApplicationLayoutWidgetMoveMutationSchema = applicationLayoutWidgetMoveMutationSchema.strict()
export const strictApplicationLayoutWidgetToggleMutationSchema = applicationLayoutWidgetToggleMutationSchema.strict()
export const strictApplicationLayoutWidgetResetBatchMutationSchema = applicationLayoutWidgetResetBatchMutationSchema.strict()

const strictApplicationLayoutWidgetConfigBatchItemSchema = applicationLayoutWidgetConfigMutationSchema
    .strict()
    .extend({
        layoutId: uuidV7Schema,
        widgetId: uuidV7Schema
    })
    .strict()

export const strictApplicationLayoutWidgetConfigBatchMutationSchema = z
    .object({
        updates: z
            .array(strictApplicationLayoutWidgetConfigBatchItemSchema)
            .min(1)
            .max(100)
            .superRefine((updates, context) => {
                const seen = new Set<string>()
                updates.forEach((update, index) => {
                    if (seen.has(update.widgetId)) {
                        context.addIssue({
                            code: z.ZodIssueCode.custom,
                            message: 'Duplicate widgetId',
                            path: [index, 'widgetId']
                        })
                    }
                    seen.add(update.widgetId)
                })
            })
    })
    .strict()

export type StrictApplicationLayoutCreate = z.infer<typeof strictApplicationLayoutCreateSchema>
export type StrictApplicationLayoutUpdate = z.infer<typeof strictApplicationLayoutUpdateSchema>
export type StrictApplicationLayoutWidgetMutation = z.infer<typeof strictApplicationLayoutWidgetMutationSchema>
export type StrictApplicationLayoutWidgetConfigMutation = z.infer<typeof strictApplicationLayoutWidgetConfigMutationSchema>
export type StrictApplicationLayoutWidgetConfigBatchMutation = z.infer<typeof strictApplicationLayoutWidgetConfigBatchMutationSchema>
export type StrictApplicationLayoutWidgetMoveMutation = z.infer<typeof strictApplicationLayoutWidgetMoveMutationSchema>
export type StrictApplicationLayoutWidgetToggleMutation = z.infer<typeof strictApplicationLayoutWidgetToggleMutationSchema>
